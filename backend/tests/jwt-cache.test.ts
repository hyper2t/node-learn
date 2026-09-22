import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.APPWRITE_ENDPOINT = 'https://example.invalid/v1';
process.env.APPWRITE_PROJECT_ID = 'test';
process.env.APPWRITE_API_KEY = 'test';
process.env.NODE_ENV = 'test';

const get = vi.fn();
vi.mock('node-appwrite', async (orig) => {
  const real = await orig<typeof import('node-appwrite')>();
  return { ...real, Account: class { get = get; } };
});

describe('resolveUserByJwt cache', () => {
  beforeEach(() => { vi.useFakeTimers(); get.mockReset(); });
  afterEach(() => { vi.useRealTimers(); vi.resetModules(); });

  it('verifies once per token within the TTL and re-verifies after it expires', async () => {
    const { resolveUserByJwt } = await import('../src/services/identity');
    get.mockResolvedValue({ $id: 'u1', email: 'a@b.c' });
    await resolveUserByJwt('token-a');
    await resolveUserByJwt('token-a');
    expect(get).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(61_000);
    await resolveUserByJwt('token-a');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('keeps distinct tokens apart', async () => {
    const { resolveUserByJwt } = await import('../src/services/identity');
    get.mockResolvedValue({ $id: 'u1' });
    await resolveUserByJwt('token-a');
    await resolveUserByJwt('token-b');
    expect(get).toHaveBeenCalledTimes(2);
  });
});
