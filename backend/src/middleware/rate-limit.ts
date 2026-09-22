import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app-env';
import { rateLimited } from '../errors';

type Bucket = { tokens: number; updatedAt: number };

/** Fixed-window bucket keyed by IP (or user). In-memory per instance — an abuse guard, not a distributed limiter. */
export function rateLimit(opts: { perMin: number; maxEntries?: number; keyPrefix?: string }) {
  const capacity = opts.perMin;
  const maxEntries = opts.maxEntries ?? 10_000;
  const buckets = new Map<string, Bucket>();
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user');
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
    const key = `${opts.keyPrefix ?? ''}:${user?.$id ?? ip}`;
    const now = Date.now();
    if (buckets.size >= maxEntries) buckets.clear();
    const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
    const elapsed = now - bucket.updatedAt;
    if (elapsed >= 60_000) {
      bucket.tokens = capacity;
      bucket.updatedAt = now;
    } else if (bucket.tokens <= 0) {
      throw rateLimited((60_000 - elapsed) / 1000);
    }
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    await next();
  });
}
