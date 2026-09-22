import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey } from '@/infrastructure/api';
import { qk } from '@/state/query-keys';
import type { Conversation, LearningMessage, Page } from '@/types/api';

export const messagingApi = {
  list: () => api.get<Page<Conversation>>('/v1/conversations', { query: { limit: 50 } }),
  get: (id: string) => api.get<Conversation>(`/v1/conversations/${id}`),
  messages: (id: string, p: { afterSequence?: number; beforeSequence?: number }) => api.get<Page<LearningMessage>>(`/v1/conversations/${id}/messages`, { query: { ...p, limit: 50 } }),
  send: (id: string, text: string, clientMessageId: string) => api.post<LearningMessage>(`/v1/conversations/${id}/messages`, { clientMessageId, text }, { idempotencyKey: clientMessageId }),
  read: (id: string, sequence: number) => api.post<{ ok: true }>(`/v1/conversations/${id}/read`, { sequence }),
};

export function useConversations(enabled = true) {
  return useQuery({ queryKey: qk.conversations.list, queryFn: messagingApi.list, enabled, refetchInterval: 15_000 });
}
export function useConversation(id: string) {
  return useQuery({ queryKey: qk.conversations.detail(id), queryFn: () => messagingApi.get(id), enabled: !!id });
}

export type LocalMessage = LearningMessage & { localStatus?: 'sending' | 'failed' };

/** Message timeline: ascending by sequence; polls for new messages using afterSequence. */
export function useMessages(conversationId: string) {
  const qc = useQueryClient();
  const key = qk.conversations.messages(conversationId);
  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<LocalMessage[]> => {
      const prev = qc.getQueryData<LocalMessage[]>(key) ?? [];
      const confirmed = prev.filter((m) => !m.localStatus);
      const last = confirmed.length ? confirmed[confirmed.length - 1]!.sequence : 0;
      const page = await messagingApi.messages(conversationId, last ? { afterSequence: last } : {});
      const fresh = last ? page.items : page.items.slice().reverse();
      const merged = new Map<string, LocalMessage>();
      for (const m of confirmed) merged.set(m.id, m);
      for (const m of fresh) merged.set(m.id, m);
      const clientIds = new Set(fresh.map((m) => m.clientMessageId).filter(Boolean));
      const pending = prev.filter((m) => m.localStatus && !clientIds.has(m.clientMessageId));
      return [...Array.from(merged.values()).sort((a, b) => a.sequence - b.sequence), ...pending];
    },
    enabled: !!conversationId,
    refetchInterval: 4_000,
    staleTime: 0,
  });

  const send = useMutation({
    mutationFn: async ({ text, clientMessageId }: { text: string; clientMessageId: string }) => messagingApi.send(conversationId, text, clientMessageId),
    onMutate: ({ text, clientMessageId }) => {
      const optimistic: LocalMessage = {
        id: `local-${clientMessageId}`, conversationId, sequence: Number.MAX_SAFE_INTEGER, senderId: 'me', type: 'text', payloadVersion: 1,
        payload: { type: 'text', text }, clientMessageId, createdAt: new Date().toISOString(), removedAt: null, localStatus: 'sending',
      };
      qc.setQueryData<LocalMessage[]>(key, (old = []) => [...old.filter((m) => m.clientMessageId !== clientMessageId), optimistic]);
    },
    onSuccess: (msg, { clientMessageId }) => {
      qc.setQueryData<LocalMessage[]>(key, (old = []) => {
        const rest = old.filter((m) => m.clientMessageId !== clientMessageId && m.id !== msg.id);
        const next: LocalMessage[] = [...rest, msg];
        return next.sort((a, b) => (a.localStatus ? 1 : b.localStatus ? -1 : a.sequence - b.sequence));
      });
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

  // Mark read on the newest confirmed sequence.
  const lastSeq = (() => { const c = (query.data ?? []).filter((m) => !m.localStatus); return c.length ? c[c.length - 1]!.sequence : 0; })();
  useEffect(() => {
    if (!conversationId || !lastSeq) return;
    messagingApi.read(conversationId, lastSeq).then(() => qc.invalidateQueries({ queryKey: qk.conversations.list })).catch(() => {});
  }, [conversationId, lastSeq, qc]);

  return { ...query, sendText, retry, sending: send.isPending };
}
