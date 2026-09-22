import { beforeAll, describe, expect, it, vi } from 'vitest';

process.env.APPWRITE_ENDPOINT = 'https://example.invalid/v1';
process.env.APPWRITE_PROJECT_ID = 'test';
process.env.APPWRITE_API_KEY = 'test';
process.env.NODE_ENV = 'test';

const listRows = vi.fn();
vi.mock('../src/db/client', () => ({ getTablesDB: () => ({ listRows }), getDatabaseId: () => 'main', getAdminClient: () => ({}), getStorage: () => ({}), getUsers: () => ({}), clientForJwt: () => ({}), resetClients: () => {} }));

describe('health + access log', () => {
  let app: Awaited<ReturnType<typeof import('../src/app')['createApp']>>;
  beforeAll(async () => { app = (await import('../src/app')).createApp(); });

  it('readyz is 503 when TablesDB is unreachable and 200 with latency when it is', async () => {
    listRows.mockRejectedValueOnce(new Error('down'));
    const bad = await app.fetch(new Request('http://x/readyz'));
    expect(bad.status).toBe(503);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe('service_unavailable');
    // cached for 10s → force a new app instance to bypass
    const fresh = (await import('../src/app')).createApp();
    listRows.mockResolvedValueOnce({ rows: [] });
    // cache is module-level; wait it out by mocking Date.now
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 11_000);
    const good = await fresh.fetch(new Request('http://x/readyz'));
    vi.restoreAllMocks();
    expect(good.status).toBe(200);
    const body = (await good.json()) as { data: { checks: { tablesDb: { ok: boolean; latencyMs: number } } } };
    expect(body.data.checks.tablesDb.ok).toBe(true);
    expect(typeof body.data.checks.tablesDb.latencyMs).toBe('number');
  });

  it('emits one structured http line per request with route + latency and echoes X-Request-Id', async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((l: string) => { lines.push(String(l)); });
    const res = await app.fetch(new Request('http://x/healthz', { headers: { 'x-request-id': 'req-123' } }));
    spy.mockRestore();
    expect(res.headers.get('x-request-id')).toBe('req-123');
    const http = lines.map((l) => { try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; } }).find((j) => j?.message === 'http');
    expect(http).toMatchObject({ requestId: 'req-123', method: 'GET', route: '/healthz', status: 200 });
    expect(typeof http?.latencyMs).toBe('number');
  });
});
