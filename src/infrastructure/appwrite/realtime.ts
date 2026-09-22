/**
 * Appwrite Realtime as a *hint* channel. Events only tell us "something
 * changed in conversation X"; the app then pulls `/messages?afterSequence`.
 * If Realtime is unavailable the polling fallback keeps everything correct.
 * Row read permissions are granted server-side to conversation members only.
 */
import { env } from '@/infrastructure/config/env';
import { client } from './client';

export type RealtimeHint = { conversationId: string; kind: 'message' | 'conversation' };
type Listener = (h: RealtimeHint) => void;
type RealtimeStatus = 'idle' | 'connected' | 'degraded';

const DB = 'main';
const listeners = new Map<string, Set<Listener>>(); // conversationId → listeners
const statusListeners = new Set<(s: RealtimeStatus) => void>();
let unsubscribe: (() => void) | null = null;
let status: RealtimeStatus = 'idle';

function setStatus(s: RealtimeStatus) {
  if (s === status) return;
  status = s;
  statusListeners.forEach((l) => l(s));
}
export const getRealtimeStatus = () => status;
export function onRealtimeStatus(l: (s: RealtimeStatus) => void): () => void {
  statusListeners.add(l);
  return () => void statusListeners.delete(l);
}

type Payload = { conversationId?: string; $id?: string };
type RealtimeMessage = { events: string[]; payload: Payload };

function handle(msg: RealtimeMessage) {
  const table = msg.events.find((e) => e.includes('.tables.'))?.split('.tables.')[1]?.split('.')[0];
  const p = msg.payload ?? {};
  const conversationId = table === 'messages' ? p.conversationId : table === 'conversations' ? p.$id : undefined;
  if (!conversationId) return;
  const kind: RealtimeHint['kind'] = table === 'messages' ? 'message' : 'conversation';
  listeners.get(conversationId)?.forEach((l) => l({ conversationId, kind }));
  listeners.get('*')?.forEach((l) => l({ conversationId, kind }));
}

function ensureConnected() {
  if (unsubscribe) return;
  try {
    const channels = [`databases.${DB}.tables.messages.rows`, `databases.${DB}.tables.conversations.rows`];
    // Both SDKs expose the same subscribe signature.
    unsubscribe = (client as unknown as { subscribe: (c: string[], cb: (m: RealtimeMessage) => void) => () => void }).subscribe(channels, (m) => {
      setStatus('connected');
      handle(m);
    });
    setStatus('connected');
  } catch {
    unsubscribe = null;
    setStatus('degraded');
  }
}

function maybeDisconnect() {
  if (listeners.size > 0 || !unsubscribe) return;
  try { unsubscribe(); } catch { /* socket already closed */ }
  unsubscribe = null;
  setStatus('idle');
}

/** Subscribe to hints for one conversation, or '*' for any of mine. */
export function subscribeConversationHints(conversationId: string, l: Listener): () => void {
  if (!env.appwriteProjectId) return () => {};
  let set = listeners.get(conversationId);
  if (!set) listeners.set(conversationId, (set = new Set()));
  set.add(l);
  ensureConnected();
  return () => {
    set!.delete(l);
    if (set!.size === 0) listeners.delete(conversationId);
    maybeDisconnect();
  };
}

/** Called on sign-out / account switch so no socket outlives its session. */
export function resetRealtime(): void {
  listeners.clear();
  maybeDisconnect();
}
