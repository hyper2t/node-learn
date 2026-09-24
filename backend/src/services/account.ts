import { Query, type Models } from 'node-appwrite';
import type { LinkedIdentity } from '../contracts/api';
import { getConfig } from '../config';
import { deleteRow, getRow, listRows, updateRow } from '../db/repo';
import { getStorage, getUsers } from '../db/client';
import type { ProfileRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict } from '../errors';
import { audit } from './events';
import { evictUser } from './identity';

const PROVIDERS = new Set(['google', 'notion']);

/** Google / Notion identities linked to the Appwrite user. Email/password shows as 'email' when a password exists. */
export async function listIdentities(user: Models.User): Promise<LinkedIdentity[]> {
  const res = await getUsers().listIdentities({ queries: [Query.equal('userId', user.$id)] });
  const out: LinkedIdentity[] = res.identities
    .filter((i) => PROVIDERS.has(i.provider))
    .map((i) => ({ id: i.$id, provider: i.provider as LinkedIdentity['provider'], providerEmail: i.providerEmail || null, createdAt: i.$createdAt }));
  if (user.passwordUpdate) out.unshift({ id: 'email', provider: 'email', providerEmail: user.email, createdAt: user.$createdAt });
  return out;
}

/** Unlink is refused when it would leave no way to sign in. */
export async function unlinkIdentity(user: Models.User, identityId: string): Promise<LinkedIdentity[]> {
  const all = await listIdentities(user);
  if (all.length <= 1) throw conflict('invalid_state', 'Keep at least one way to sign in. Set a password first.');
  if (identityId === 'email') throw conflict('invalid_state', 'Passwords are managed from your account settings.');
  await getUsers().deleteIdentity({ identityId });
  await audit({ actorId: user.$id, action: 'identity.unlinked', resourceType: 'user', resourceId: user.$id });
  return listIdentities(user);
}

/** Data export: everything keyed to this user, as JSON. Message bodies included only for conversations they belong to. */
export async function exportData(userId: string): Promise<Record<string, unknown>> {
  const by = (table: Parameters<typeof listRows>[0], col: string) => listRows(table, [Query.equal(col, userId), Query.limit(500)]);
  const [profile, roles, student, teacher, requestsS, requestsT, relationsS, relationsT, evidence, feedback, contacts, blocks] = await Promise.all([
    getRow<ProfileRow>(TABLES.profiles, userId), by(TABLES.roleMemberships, 'userId'), by(TABLES.studentProfiles, 'userId'), by(TABLES.teacherProfiles, 'userId'),
    by(TABLES.learningRequests, 'studentId'), by(TABLES.learningRequests, 'teacherId'), by(TABLES.learningRelations, 'studentId'), by(TABLES.learningRelations, 'teacherId'),
    by(TABLES.evidenceItems, 'authorId'), by(TABLES.feedbackEntries, 'authorId'), by(TABLES.contacts, 'userId'), by(TABLES.blocks, 'blockerId'),
  ]);
  const messages = await by(TABLES.messages, 'senderId');
  return { exportedAt: new Date().toISOString(), profile, roles, studentProfile: student, teacherProfile: teacher, requests: [...requestsS, ...requestsT], relations: [...relationsS, ...relationsT], evidence, feedback, messagesSent: messages, contacts, blocks };
}

async function deleteAvatarFile(fileId: string | null | undefined): Promise<void> {
  if (!fileId) return;
  const bucketId = getConfig().appwrite.avatarBucketId;
  await getStorage().deleteFile({ bucketId, fileId }).catch(() => undefined);
}

/**
 * Account deletion = anonymise the profile, remove private rows, delete avatar/user immediately, and
 * leave messages/evidence upload intents for the scheduled retention job to purge within 30 days.
 */
export async function deleteAccount(user: Models.User, requestId?: string): Promise<void> {
  const userId = user.$id;
  const profile = await getRow<ProfileRow>(TABLES.profiles, userId);
  await updateRow(TABLES.profiles, userId, { displayName: 'Former member', handle: null, avatarFileId: null, email: `deleted+${userId}@invalid`, status: 'deleted' });
  await deleteAvatarFile(profile?.avatarFileId);
  for (const t of [TABLES.studentProfiles, TABLES.teacherProfiles, TABLES.roleMemberships, TABLES.contacts, TABLES.blocks, TABLES.notifications] as const) {
    const rows = await listRows(t, [Query.equal(t === TABLES.blocks ? 'blockerId' : 'userId', userId), Query.limit(500)]);
    await Promise.all(rows.map((r) => deleteRow(t, r.$id)));
  }
  for (const col of ['studentId', 'teacherId'] as const) {
    const rels = await listRows(TABLES.learningRelations, [Query.equal(col, userId), Query.equal('status', ['active', 'paused']), Query.limit(200)]);
    await Promise.all(rels.map((r) => updateRow(TABLES.learningRelations, r.$id, { status: 'ended', endedAt: new Date().toISOString(), endedBy: null, endReason: 'The other member deleted their account.' })));
  }
  const pend = await listRows(TABLES.learningRequests, [Query.equal('initiatorId', userId), Query.equal('status', 'pending'), Query.limit(200)]);
  await Promise.all(pend.map((r) => updateRow(TABLES.learningRequests, r.$id, { status: 'cancelled', respondedAt: new Date().toISOString() })));
  await audit({ actorId: userId, action: 'account.deleted', resourceType: 'user', resourceId: userId, requestId });
  evictUser(userId);
  await getUsers().delete({ userId });
}
