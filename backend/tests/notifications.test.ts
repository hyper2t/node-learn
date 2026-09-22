import { beforeAll, describe, expect, it, vi } from 'vitest';

process.env.APPWRITE_ENDPOINT = 'https://example.invalid/v1';
process.env.APPWRITE_PROJECT_ID = 'test';
process.env.APPWRITE_API_KEY = 'test';
process.env.NODE_ENV = 'test';
process.env.API_DEV_BYPASS_USER_ID = 'u1';

const user = { $id: 'u1', email: 'u1@example.com', emailVerification: true } as never;
vi.mock('../src/services/identity', () => ({ resolveUserById: async () => user, resolveUserByJwt: async () => null }));
vi.mock('../src/services/roles', () => ({ getRolesOf: async () => ['student'] }));
vi.mock('../src/services/admin-check', () => ({ isAdminUser: async () => false, resetAdminCache: () => {} }));
vi.mock('../src/services/profiles', () => ({ personRefs: async () => new Map() }));

type Row = { $id: string; userId: string; type: string; title: string; body: string; href: null; refType: null; refId: null; actorId: null; dedupeKey: string | null; readAt: string | null; createdAt: string; updatedAt: string };
const rows: Row[] = [];
vi.mock('../src/db/repo', () => ({
  Query: { equal: () => 'eq', orderDesc: () => 'ord', limit: () => 'lim', isNull: () => 'null', cursorAfter: () => 'cur', select: () => 'sel' },
  createRow: async (_t: string, data: Partial<Row>) => {
    if (data.dedupeKey && rows.some((r) => r.dedupeKey === data.dedupeKey)) throw Object.assign(new Error('dup'), { code: 409, type: 'document_already_exists' });
    const r = { $id: `n${rows.length + 1}`, createdAt: 'now', updatedAt: 'now', ...data } as Row; rows.push(r); return r;
  },
  getRow: async (_t: string, id: string) => rows.find((r) => r.$id === id) ?? null,
  listRows: async () => rows.filter((r) => r.userId === 'u1' && !r.readAt),
  updateRow: async (_t: string, id: string, data: Partial<Row>) => Object.assign(rows.find((r) => r.$id === id)!, data),
}));

describe('notifications', () => {
  let app: Awaited<ReturnType<typeof import('../src/app')['createApp']>>;
  let notify: typeof import('../src/services/notifications')['notify'];
  const headers = { 'x-dev-user-id': 'u1', 'content-type': 'application/json' };
  beforeAll(async () => {
    app = (await import('../src/app')).createApp();
    notify = (await import('../src/services/notifications')).notify;
  });

  it('never notifies the actor about their own action and dedupes by key', async () => {
    await notify({ userId: 'u1', type: 'system', title: 'self', actorId: 'u1' });
    expect(rows).toHaveLength(0);
    await notify({ userId: 'u1', type: 'task.assigned', title: 'a', actorId: 'u2', dedupeKey: 'task.assigned:t1' });
    await notify({ userId: 'u1', type: 'task.assigned', title: 'a', actorId: 'u2', dedupeKey: 'task.assigned:t1' });
    await notify({ userId: 'u2', type: 'task.assigned', title: 'other user', actorId: 'u1' });
    expect(rows.filter((r) => r.userId === 'u1')).toHaveLength(1);
  });

  it('exposes unread summary and marks read only rows owned by the caller', async () => {
    const summary = await app.fetch(new Request('http://x/v1/notifications/summary', { headers }));
    expect(((await summary.json()) as { data: { unread: number } }).data.unread).toBe(1);
    const bad = await app.fetch(new Request('http://x/v1/notifications/read', { method: 'POST', headers, body: JSON.stringify({}) }));
    expect(bad.status).toBe(422);
    const other = rows.find((r) => r.userId === 'u2')!;
    const res = await app.fetch(new Request('http://x/v1/notifications/read', { method: 'POST', headers, body: JSON.stringify({ ids: [other.$id, 'n1'] }) }));
    const body = (await res.json()) as { data: { updated: number; unread: number } };
    expect(body.data).toEqual({ updated: 1, unread: 0 });
    expect(other.readAt).toBeNull();
  });
});
