import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey } from '@/infrastructure/api';
import { qk } from '@/state/query-keys';
import { useAuth } from '@/state/auth';
import { subscribeConversationHints } from '@/infrastructure/appwrite/realtime';
import { outbox, type OutboxItem } from './outbox';
import type { Conversation, LearningMessage, Page } from '@/types/api';

export const messagingApi = {
  list: () => api.get<Page<Conversation>>('/v1/conversations', { query: { limit: 50 } }),
  get: (id: string) => api.get<Conversation>(`/v1/conversations/${id}`),
  messages: (id: string, p: { afterSequence?: number; beforeSequence?: number }) => api.get<Page<LearningMessage>>(`/v1/conversations/${id}/messages`, { query: { ...p, limit: 50 } }),
  send: (id: string, text: string, clientMessageId: string) => api.post<LearningMessage>(`/v1/conversations/${id}/messages`, { clientMessageId, text }, { idempotencyKey: clientMessageId }),
  read: (id: string, sequence: number) => api.post<{ ok: true }>(`/v1/conversations/${id}/read`, { sequence }),
};

export function useConversations(enabled = true) {
  return useQuery({ queryKey: qk.conversations.list, queryFn: messagingApi.list, enabled, refetchInterval: 30_000 });
}
export function useConversation(id: string) {
  return useQuery({ queryKey: qk.conversations.detail(id), queryFn: () => messagingApi.get(id), enabled: !!id });
}

export type LocalMessage = LearningMessage & { localStatus?: 'sending' | 'failed' };

const POLL_FALLBACK_MS = 30_000;
const localFromOutbox = (o: OutboxItem, conversationId: string, status: LocalMessage['localStatus']): LocalMessage => ({
  id: `local-${o.clientMessageId}`, conversationId, sequence: Number.MAX_SAFE_INTEGER, senderId: 'me', type: 'text', payloadVersion: 1,
  payload: { type: 'text', text: o.text }, clientMessageId: o.clientMessageId, createdAt: o.createdAt, removedAt: null, localStatus: status,
});
const bySequence = (a: LocalMessage, b: LocalMessage) => (a.localStatus ? 1 : b.localStatus ? -1 : a.sequence - b.sequence);

/**
 * Message timeline for one conversation.
 *  - Confirmed messages come from the server; incremental pulls use afterSequence
 *    (persisted as lastSyncSequence so reconnects never leave gaps).
 *  - Unsent messages live in a persistent outbox and are replayed on open.
 *  - Appwrite Realtime only *triggers* a pull; a slow poll is the safety net.
 */
export function useMessages(conversationId: string) {
  const qc = useQueryClient();
  const auth = useAuth();
  const userId = auth.user?.id ?? '';
  const key = qk.conversations.messages(conversationId);
  const replayed = useRef(false);

  const query = useQuery({
    queryKey: key,
    enabled: !!conversationId && !!userId,
    refetchInterval: POLL_FALLBACK_MS,
    staleTime: 0,
    queryFn: async (): Promise<LocalMessage[]> => {
      const prev = qc.getQueryData<LocalMessage[]>(key) ?? [];
      const confirmed = prev.filter((m) => !m.localStatus);
      const inMemoryLast = confirmed.length ? confirmed[confirmed.length - 1]!.sequence : 0;
      const persistedLast = await outbox.getLastSync(userId, conversationId);
      // If memory is empty but we synced before, still fetch the latest page (we don't cache bodies) —
      // afterSequence only applies when we have the preceding messages in memory.
      const after = inMemoryLast;
      const page = await messagingApi.messages(conversationId, after ? { afterSequence: after } : {});
      const fresh = after ? page.items : page.items.slice().reverse();
      const merged = new Map<string, LocalMessage>();
      for (const m of confirmed) merged.set(m.id, m);
      for (const m of fresh) merged.set(m.id, m);
      const confirmedIds = new Set(Array.from(merged.values()).map((m) => m.clientMessageId).filter(Boolean));
      // Outbox items that the server already has (e.g. replayed before reload) are dropped.
      for (const cid of confirmedIds) if (cid) void outbox.remove(userId, cid);
      const pending = prev.filter((m) => m.localStatus && !confirmedIds.has(m.clientMessageId));
      const sorted = Array.from(merged.values()).sort((a, b) => a.sequence - b.sequence);
      const newest = sorted.length ? sorted[sorted.length - 1]!.sequence : persistedLast;
      if (newest > persistedLast) void outbox.setLastSync(userId, conversationId, newest);
      return [...sorted, ...pending];
    },
  });

  const send = useMutation({
    mutationFn: async ({ text, clientMessageId }: { text: string; clientMessageId: string }) => {
      await outbox.markAttempt(userId, clientMessageId);
      return messagingApi.send(conversationId, text, clientMessageId);
    },
    onMutate: async ({ text, clientMessageId }) => {
      const item = await outbox.enqueue(userId, { conversationId, clientMessageId, text });
      qc.setQueryData<LocalMessage[]>(key, (old = []) => [...old.filter((m) => m.clientMessageId !== clientMessageId), localFromOutbox(item, conversationId, 'sending')]);
    },
    onSuccess: async (msg, { clientMessageId }) => {
      await outbox.remove(userId, clientMessageId);
      qc.setQueryData<LocalMessage[]>(key, (old = []) => {
        const rest = old.filter((m) => m.clientMessageId !== clientMessageId && m.id !== msg.id);
        const next: LocalMessage[] = [...rest, msg];
        return next.sort(bySequence);
      });
      void outbox.setLastSync(userId, conversationId, msg.sequence);
      void qc.invalidateQueries({ queryKey: qk.conversations.list });
    },
    onError: (_e, { clientMessageId }) => {
      qc.setQueryData<LocalMessage[]>(key, (old = []) => old.map((m) => (m.clientMessageId === clientMessageId ? { ...m, localStatus: 'failed' } : m)));
    },
  });

  const sendText = useCallback((text: string) => send.mutate({ text, clientMessageId: newIdempotencyKey() }), [send]);
  const retry = useCallback((m: LocalMessage) => {
    if (m.payload.type === 'text' && m.clientMessageId) send.mutate({ text: m.payload.text, clientMessageId: m.clientMessageId });
  }, [send]);

  // Replay this conversation's persisted outbox once per mount: show as failed, then try to send.
  useEffect(() => {
    if (!userId || !conversationId || replayed.current) return;
    replayed.current = true;
    void outbox.list(userId, conversationId).then((items) => {
      if (!items.length) return;
      qc.setQueryData<LocalMessage[]>(key, (old = []) => {
        const have = new Set(old.map((m) => m.clientMessageId));
        return [...old, ...items.filter((i) => !have.has(i.clientMessageId)).map((i) => localFromOutbox(i, conversationId, 'failed'))];
      });
      for (const i of items) send.mutate({ text: i.text, clientMessageId: i.clientMessageId });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, conversationId]);

  // Realtime hint → incremental pull.
  useEffect(() => {
    if (!conversationId || !userId) return;
    return subscribeConversationHints(conversationId, () => void qc.invalidateQueries({ queryKey: key }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, userId]);

  // Mark read on the newest confirmed sequence.
  const lastSeq = (() => { const c = (query.data ?? []).filter((m) => !m.localStatus); return c.length ? c[c.length - 1]!.sequence : 0; })();
  useEffect(() => {
    if (!conversationId || !lastSeq) return;
    messagingApi.read(conversationId, lastSeq).then(() => qc.invalidateQueries({ queryKey: qk.conversations.list })).catch(() => {});
  }, [conversationId, lastSeq, qc]);

  const hasFailed = (query.data ?? []).some((m) => m.localStatus === 'failed');
  return { ...query, sendText, retry, sending: send.isPending, hasFailed };
}

/** Any-conversation hints keep the inbox list fresh without polling hard. */
export function useInboxRealtime(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return subscribeConversationHints('*', () => void qc.invalidateQueries({ queryKey: qk.conversations.list }));
  }, [enabled, qc]);
}
