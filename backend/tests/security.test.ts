import { beforeAll, describe, expect, it } from 'vitest';

process.env.APPWRITE_ENDPOINT = 'https://example.invalid/v1';
process.env.APPWRITE_PROJECT_ID = 'test';
process.env.APPWRITE_API_KEY = 'test';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'http://localhost:8071';

describe('http hardening', () => {
  let app: Awaited<ReturnType<typeof import('../src/app')['createApp']>>;
  let limit: number;
  beforeAll(async () => {
    const mod = await import('../src/app');
    app = mod.createApp();
    limit = mod.BODY_LIMIT_BYTES;
  });

  it('rejects oversized bodies with 413 and a stable code', async () => {
    const body = JSON.stringify({ text: 'x'.repeat(limit + 1024) });
    const res = await app.fetch(new Request('http://x/v1/conversations/c1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'content-length': String(body.length) }, body,
    }));
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('payload_too_large');
  });

  it('sets security headers on every response', async () => {
    const res = await app.fetch(new Request('http://x/healthz'));
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('referrer-policy')).toBeTruthy();
  });

  it('does not echo disallowed CORS origins', async () => {
    const res = await app.fetch(new Request('http://x/healthz', { headers: { origin: 'https://evil.example' } }));
    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
  });

  it('echoes allow-listed CORS origins', async () => {
    const res = await app.fetch(new Request('http://x/healthz', { headers: { origin: 'http://localhost:8071' } }));
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8071');
  });
});
