import { createMiddleware } from 'hono/factory';
import type { Models } from 'node-appwrite';
import type { AppEnv } from '../app-env';
import type { Role } from '../contracts/api';
import { getConfig } from '../config';
import { emailNotVerified, forbidden, roleRequired, unauthorized } from '../errors';
import { isAdminUser } from '../services/admin-check';
import { resolveUserById, resolveUserByJwt } from '../services/identity';
import { getRolesOf } from '../services/roles';

const BEARER = /^Bearer\s+(.+)$/i;

export async function authenticate(c: { req: { header: (n: string) => string | undefined } }): Promise<Models.User | null> {
  const config = getConfig();
  const devHeader = c.req.header('x-dev-user-id');
  if (config.devBypassUserId && devHeader === config.devBypassUserId) return resolveUserById(config.devBypassUserId);
  const header = c.req.header('authorization');
  const token = header ? BEARER.exec(header)?.[1]?.trim() : undefined;
  if (!token) return null;
  return resolveUserByJwt(token);
}

/** Rejects unauthenticated callers; attaches user + server-side roles. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = await authenticate(c);
  if (!user) throw unauthorized();
  c.set('user', user);
  c.set('roles', await getRolesOf(user.$id));
  await next();
});

/** Email verification gate for write actions that reach other people. */
export const requireVerifiedEmail = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) throw unauthorized();
  if (!user.emailVerification) throw emailNotVerified();
  await next();
});

/** Role gate. Roles are read from the DB, never from the client. */
export function requireRole(role: Role) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!c.get('roles').includes(role)) throw roleRequired(role);
    await next();
  });
}

export function currentUser(c: { get: (k: 'user') => Models.User | null }): Models.User {
  const u = c.get('user');
  if (!u) throw unauthorized();
  return u;
}

/** Moderator gate: membership of the admin team, checked server-side per request (cached). */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) throw unauthorized();
  if (!(await isAdminUser(user.$id))) throw forbidden('Moderator access is required.');
  await next();
});
