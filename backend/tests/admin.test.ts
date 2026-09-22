import { beforeAll, describe, expect, it, vi } from 'vitest';

process.env.APPWRITE_ENDPOINT = 'https://example.invalid/v1';
process.env.APPWRITE_PROJECT_ID = 'test';
process.env.APPWRITE_API_KEY = 'test';
process.env.NODE_ENV = 'test';
process.env.API_DEV_BYPASS_USER_ID = 'dev-user';
process.env.APPWRITE_ADMIN_TEAM_ID = 'admins';

const user = { $id: 'dev-user', email: 'dev@example.com', emailVerification: true } as never;
vi.mock('../src/services/identity', () => ({ resolveUserById: async () => user, resolveUserByJwt: async () => null }));
vi.mock('../src/services/roles', () => ({ getRolesOf: async () => ['student'] }));
const isAdmin = vi.fn(async (_id: string) => false);
vi.mock('../src/services/admin-check', () => ({ isAdminUser: (id: string) => isAdmin(id), resetAdminCache: () => {} }));
const listReports = vi.fn(async (_p: unknown) => ({ items: [] as unknown[], nextCursor: null as string | null }));
vi.mock('../src/services/admin', () => ({ listReports: (p: unknown) => listReports(p), resolveReport: async () => ({}) }));

describe('admin gate', () => {
  let app: Awaited<ReturnType<typeof import('../src/app')['createApp']>>;
  const headers = { 'x-dev-user-id': 'dev-user' };
  beforeAll(async () => { app = (await import('../src/app')).createApp(); });

  it('403s non-admins with a stable code and never touches the service', async () => {
    isAdmin.mockResolvedValueOnce(false);
    const res = await app.fetch(new Request('http://x/v1/admin/reports', { headers }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('forbidden');
    expect(listReports).not.toHaveBeenCalled();
  });

  it('lets admins through and validates the status filter', async () => {
    isAdmin.mockResolvedValueOnce(true);
    const res = await app.fetch(new Request('http://x/v1/admin/reports?status=open', { headers }));
    expect(res.status).toBe(200);
    expect(listReports).toHaveBeenCalledWith(expect.objectContaining({ status: 'open', limit: 20 }));
    isAdmin.mockResolvedValueOnce(true);
    const bad = await app.fetch(new Request('http://x/v1/admin/reports?status=weird', { headers }));
    expect(bad.status).toBe(422);
  });

  it('401s without any identity', async () => {
    const res = await app.fetch(new Request('http://x/v1/admin/reports'));
    expect(res.status).toBe(401);
  });
});
