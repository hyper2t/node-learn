import { Query, Teams } from 'node-appwrite';
import { getConfig } from '../config';
import { getAdminClient } from '../db/client';

const TTL_MS = 60_000;
const cache = new Map<string, { value: boolean; expiresAt: number }>();

/**
 * Admin = member of the Appwrite team APPWRITE_ADMIN_TEAM_ID. Unset team id ⇒ nobody is admin.
 * Cached per user for 60s: memberships change rarely and the check runs on every /v1/me.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const teamId = getConfig().appwrite.adminTeamId;
  if (!teamId) return false;
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  let value = false;
  try {
    const res = await new Teams(getAdminClient()).listMemberships({ teamId, queries: [Query.equal('userId', userId), Query.limit(1)] });
    value = res.memberships.some((m) => m.userId === userId && m.confirm);
  } catch {
    value = false; // fail closed
  }
  cache.set(userId, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export function resetAdminCache(): void {
  cache.clear();
}
