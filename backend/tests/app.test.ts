import { beforeAll, describe, expect, it } from 'vitest';

process.env.APPWRITE_ENDPOINT = 'https://example.invalid/v1';
process.env.APPWRITE_PROJECT_ID = 'test';
process.env.APPWRITE_API_KEY = 'test';
process.env.NODE_ENV = 'test';

describe('app shell', () => {
  let app: Awaited<ReturnType<typeof import('../src/app')['createApp']>>;
  beforeAll(async () => {
    app = (await import('../src/app')).createApp();
  });

  it('answers health with the envelope', async () => {
    const res = await app.fetch(new Request('http://x/healthz'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { ok: boolean }; error: null; requestId: string };
    expect(body.data.ok).toBe(true);
    expect(body.error).toBeNull();
    expect(body.requestId).toBeTruthy();
  });

  it('401s protected routes without a token', async () => {
    const res = await app.fetch(new Request('http://x/v1/me'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });

  it('404s unknown routes with a stable code', async () => {
    const res = await app.fetch(new Request('http://x/v1/nope'));
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('route_not_found');
  });
});
