import type { Role } from '../contracts/api';
import { createRow, findOne, listRows, Query, updateRow } from '../db/repo';
import { isConflict, type RoleMembershipRow } from '../db/rows';
import { TABLES } from '../db/schema';

const ROLES: Role[] = ['student', 'teacher'];
const isRole = (v: string): v is Role => (ROLES as string[]).includes(v);

export async function listMemberships(userId: string): Promise<RoleMembershipRow[]> {
  return listRows<RoleMembershipRow>(TABLES.roleMemberships, [Query.equal('userId', userId), Query.limit(10)]);
}

export async function getRolesOf(userId: string): Promise<Role[]> {
  return (await listMemberships(userId)).map((m) => m.role).filter(isRole);
}

export async function grantRole(userId: string, role: Role, activate: boolean): Promise<RoleMembershipRow[]> {
  const existing = await listMemberships(userId);
  const has = existing.find((m) => m.role === role);
  if (!has) {
    try {
      await createRow<RoleMembershipRow>(TABLES.roleMemberships, { userId, role, active: activate || existing.length === 0, onboarded: false }, `${userId}_${role}`);
    } catch (err) {
      if (!isConflict(err)) throw err;
    }
  }
  if (activate) await setActiveRole(userId, role);
  return listMemberships(userId);
}

export async function setActiveRole(userId: string, role: Role): Promise<void> {
  const all = await listMemberships(userId);
  await Promise.all(all.map((m) => (m.active !== (m.role === role) ? updateRow(TABLES.roleMemberships, m.$id, { active: m.role === role }) : null)));
}

export async function markOnboarded(userId: string, role: Role): Promise<void> {
  const m = await findOne<RoleMembershipRow>(TABLES.roleMemberships, [Query.equal('userId', userId), Query.equal('role', role)]);
  if (m && !m.onboarded) await updateRow(TABLES.roleMemberships, m.$id, { onboarded: true });
}
