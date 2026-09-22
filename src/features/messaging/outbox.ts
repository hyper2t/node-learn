/**
 * Persistent per-user outbox for text messages. Survives reload/app restart;
 * replayed on next open with the same clientMessageId so the server dedupes.
 * Also stores lastSyncSequence per conversation for gap-free incremental sync.
 * Storage is namespaced by userId so accounts never see each other's drafts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OutboxItem = { conversationId: string; clientMessageId: string; text: string; createdAt: string; attempts: number };
type Store = { pending: OutboxItem[]; lastSync: Record<string, number> };

const key = (userId: string) => `node-learn.outbox.${userId}`;
const empty = (): Store => ({ pending: [], lastSync: {} });
const cache = new Map<string, Store>();

async function load(userId: string): Promise<Store> {
  const hit = cache.get(userId);
  if (hit) return hit;
  let s = empty();
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (raw) s = { ...empty(), ...(JSON.parse(raw) as Partial<Store>) };
  } catch { /* corrupt → start clean */ }
  cache.set(userId, s);
  return s;
}
async function save(userId: string, s: Store): Promise<void> {
  cache.set(userId, s);
  try { await AsyncStorage.setItem(key(userId), JSON.stringify(s)); } catch { /* best effort */ }
}

export const outbox = {
  async list(userId: string, conversationId?: string): Promise<OutboxItem[]> {
    const s = await load(userId);
    return conversationId ? s.pending.filter((p) => p.conversationId === conversationId) : s.pending;
  },
  async enqueue(userId: string, item: Omit<OutboxItem, 'attempts' | 'createdAt'>): Promise<OutboxItem> {
    const s = await load(userId);
    const existing = s.pending.find((p) => p.clientMessageId === item.clientMessageId);
    if (existing) return existing;
    const full: OutboxItem = { ...item, attempts: 0, createdAt: new Date().toISOString() };
    await save(userId, { ...s, pending: [...s.pending, full] });
    return full;
  },
  async markAttempt(userId: string, clientMessageId: string): Promise<void> {
    const s = await load(userId);
    await save(userId, { ...s, pending: s.pending.map((p) => (p.clientMessageId === clientMessageId ? { ...p, attempts: p.attempts + 1 } : p)) });
  },
  async remove(userId: string, clientMessageId: string): Promise<void> {
    const s = await load(userId);
    await save(userId, { ...s, pending: s.pending.filter((p) => p.clientMessageId !== clientMessageId) });
  },
  async getLastSync(userId: string, conversationId: string): Promise<number> {
    return (await load(userId)).lastSync[conversationId] ?? 0;
  },
  async setLastSync(userId: string, conversationId: string, sequence: number): Promise<void> {
    const s = await load(userId);
    if ((s.lastSync[conversationId] ?? 0) >= sequence) return;
    await save(userId, { ...s, lastSync: { ...s.lastSync, [conversationId]: sequence } });
  },
  /** Sign-out: wipe this user's queue so nothing leaks into another session. */
  async clear(userId: string): Promise<void> {
    cache.delete(userId);
    try { await AsyncStorage.removeItem(key(userId)); } catch { /* ignore */ }
  },
};
