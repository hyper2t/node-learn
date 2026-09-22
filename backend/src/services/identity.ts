import { createHash } from 'node:crypto';
import { Account, AppwriteException, type Models } from 'node-appwrite';
import { clientForJwt, getUsers } from '../db/client';
import { log } from '../log';

/** JWT → user resolution, cached briefly by token hash (raw JWT never stored or logged). */
const TTL_MS = 60_000;
const MAX = 500;
const cache = new Map<string, { user: Models.User; expiresAt: number }>();

function evict(now: number): void {
  if (cache.size < MAX) return;
  for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
  while (cache.size >= MAX) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

const isUnauthorized = (e: unknown) =>
  e instanceof AppwriteException && (e.code === 401 || e.type === 'user_jwt_invalid' || e.type === 'user_invalid_credentials');

export async function resolveUserByJwt(jwt: string): Promise<Models.User | null> {
  const now = Date.now();
  const key = createHash('sha256').update(jwt).digest('hex');
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.user;
  try {
    const user = await new Account(clientForJwt(jwt)).get();
    evict(now);
    cache.set(key, { user, expiresAt: now + TTL_MS });
    return user;
  } catch (err) {
    if (isUnauthorized(err)) return null;
    log('error', 'jwt_verification_failed', { type: err instanceof AppwriteException ? err.type : undefined });
    throw err;
  }
}

export async function resolveUserById(userId: string): Promise<Models.User | null> {
  try {
    return await getUsers().get({ userId });
  } catch (err) {
    if (err instanceof AppwriteException && err.code === 404) return null;
    throw err;
  }
}

export function evictUser(userId: string): void {
  for (const [k, v] of cache) if (v.user.$id === userId) cache.delete(k);
}
export function resetIdentityCache(): void {
  cache.clear();
}
