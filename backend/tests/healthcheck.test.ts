import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/log', () => ({ log: vi.fn() }));

describe('healthcheck', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('passes when /readyz returns the expected envelope and does not alert', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { runHealthcheck } = await import('../src/services/healthcheck');

    const result = await runHealthcheck({ HEALTHCHECK_URL: 'https://api.example/readyz', ALERT_WEBHOOK_URL: 'https://hooks.example/alert' });

    expect(result.ok).toBe(true);
    expect(result.alerted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('posts a Slack-compatible webhook payload and fails the execution when unhealthy', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ok: false }, error: 'db down' }), { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { runHealthcheck } = await import('../src/services/healthcheck');

    const result = await runHealthcheck({ HEALTHCHECK_URL: 'https://api.example/readyz', ALERT_WEBHOOK_URL: 'https://hooks.example/alert', HEALTHCHECK_NAME: 'Node Learn staging' });

    expect(result.ok).toBe(false);
    expect(result.alerted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const alertCall = fetchMock.mock.calls[1];
    expect(alertCall).toBeDefined();
    expect(alertCall?.[0]).toBe('https://hooks.example/alert');
    const init = alertCall?.[1] as { method?: string; body?: unknown };
    expect(init.method).toBe('POST');
    const payload = JSON.parse(String(init.body)) as { text: string; source: string; statusCode: number };
    expect(payload.text).toContain('Node Learn staging healthcheck failed');
    expect(payload.source).toBe('node-learn-healthcheck');
    expect(payload.statusCode).toBe(503);
  });
});

