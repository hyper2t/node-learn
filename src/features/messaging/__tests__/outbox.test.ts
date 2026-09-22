import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => mem.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void mem.set(k, v)),
    removeItem: vi.fn(async (k: string) => void mem.delete(k)),
  },
}));

describe('message outbox', () => {
  beforeEach(() => { mem.clear(); vi.resetModules(); });

  it('persists queued items across module reloads and dedupes by clientMessageId', async () => {
    let { outbox } = await import('../outbox');
    await outbox.enqueue('u1', { conversationId: 'c1', clientMessageId: 'k1', text: 'hi' });
    await outbox.enqueue('u1', { conversationId: 'c1', clientMessageId: 'k1', text: 'hi again' });
    vi.resetModules();
    ({ outbox } = await import('../outbox'));
    const items = await outbox.list('u1', 'c1');
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('hi');
  });

  it('isolates users and clears on sign-out', async () => {
    const { outbox } = await import('../outbox');
    await outbox.enqueue('u1', { conversationId: 'c1', clientMessageId: 'k1', text: 'a' });
    await outbox.enqueue('u2', { conversationId: 'c1', clientMessageId: 'k2', text: 'b' });
    expect(await outbox.list('u2')).toHaveLength(1);
    await outbox.clear('u1');
    expect(await outbox.list('u1')).toHaveLength(0);
    expect(await outbox.list('u2')).toHaveLength(1);
  });

  it('tracks attempts, removal and a monotonic lastSync', async () => {
    const { outbox } = await import('../outbox');
    await outbox.enqueue('u1', { conversationId: 'c1', clientMessageId: 'k1', text: 'a' });
    await outbox.markAttempt('u1', 'k1');
    expect((await outbox.list('u1'))[0]!.attempts).toBe(1);
    await outbox.remove('u1', 'k1');
    expect(await outbox.list('u1')).toHaveLength(0);
    await outbox.setLastSync('u1', 'c1', 10);
    await outbox.setLastSync('u1', 'c1', 5);
    expect(await outbox.getLastSync('u1', 'c1')).toBe(10);
  });
});
