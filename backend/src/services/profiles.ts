import { Query, type Models } from 'node-appwrite';
import type { Me, StudentProfile, TeacherProfile, UpdateMeInput, UpdateStudentProfileInput, UpdateTeacherProfileInput } from '../contracts/api';
import { getConfig } from '../config';
import { createRow, findOne, getRow, listRows, updateRow } from '../db/repo';
import { isConflict, type ProfileRow, type RoleMembershipRow, type StudentProfileRow, type TeacherProfileRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, notFound, validation } from '../errors';
import { toMe, toStudentProfile, toTeacherProfile, type PersonRef } from '../mappers/profile';
import { listMemberships, markOnboarded } from './roles';

export async function getOrCreateProfile(user: Models.User): Promise<ProfileRow> {
  const row = await getRow<ProfileRow>(TABLES.profiles, user.$id);
  if (row) return row;
  try {
    return await createRow<ProfileRow>(TABLES.profiles, {
      email: user.email, handle: null, displayName: user.name || user.email.split('@')[0] || 'learner',
      avatarFileId: null, locale: 'en', timeZone: 'UTC', ageBand: null, privacyAcceptedAt: null, status: 'active',
    }, user.$id);
  } catch (err) {
    if (!isConflict(err)) throw err;
    return (await getRow<ProfileRow>(TABLES.profiles, user.$id))!;
  }
}

export async function getMe(user: Models.User): Promise<Me> {
  const [profile, memberships] = await Promise.all([getOrCreateProfile(user), listMemberships(user.$id)]);
  return toMe(user, profile, memberships);
}

export async function updateMe(user: Models.User, patch: UpdateMeInput): Promise<Me> {
  const data: Record<string, unknown> = {};
  if (patch.handle !== undefined) {
    const handle = patch.handle.toLowerCase();
    const taken = await findOne<ProfileRow>(TABLES.profiles, [Query.equal('handle', handle)]);
    if (taken && taken.$id !== user.$id) throw conflict('handle_taken', 'That handle is already in use.');
    data.handle = handle;
  }
  if (patch.displayName !== undefined) data.displayName = patch.displayName;
  if (patch.locale !== undefined) data.locale = patch.locale;
  if (patch.timeZone !== undefined) data.timeZone = patch.timeZone;
  await getOrCreateProfile(user);
  const [profile, memberships] = await Promise.all([updateRow<ProfileRow>(TABLES.profiles, user.$id, data), listMemberships(user.$id)]);
  return toMe(user, profile, memberships);
}

const AGE_ORDER = ['under_16', '16_17', '18_plus'];
export async function applyAgeGate(user: Models.User, ageBand: string): Promise<Me> {
  const min = getConfig().minAgeBand;
  if (AGE_ORDER.indexOf(ageBand) < AGE_ORDER.indexOf(min)) {
    throw validation('KnowNode is not available for your age group yet.', [{ path: 'ageBand', message: 'below_minimum' }]);
  }
  await getOrCreateProfile(user);
  const [profile, memberships] = await Promise.all([
    updateRow<ProfileRow>(TABLES.profiles, user.$id, { ageBand, privacyAcceptedAt: new Date().toISOString() }),
    listMemberships(user.$id),
  ]);
  return toMe(user, profile, memberships);
}

export function isGated(profile: ProfileRow): boolean {
  return !profile.ageBand || !profile.privacyAcceptedAt;
}

// --- person refs (denormalised counterpart info) ---------------------------

export async function personRefs(userIds: string[]): Promise<Map<string, PersonRef>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const out = new Map<string, PersonRef>();
  if (!ids.length) return out;
  const rows = await listRows<ProfileRow>(TABLES.profiles, [Query.equal('$id', ids), Query.limit(ids.length)]);
  for (const r of rows) out.set(r.$id, { userId: r.$id, displayName: r.displayName, handle: r.handle, avatarFileId: r.avatarFileId });
  for (const id of ids) if (!out.has(id)) out.set(id, { userId: id, displayName: 'Former member', handle: null, avatarFileId: null });
  return out;
}

export async function personRef(userId: string): Promise<PersonRef> {
  return (await personRefs([userId])).get(userId)!;
}

// --- student ----------------------------------------------------------------

export async function getStudentProfile(userId: string): Promise<StudentProfile> {
  const [row, profile] = await Promise.all([findOne<StudentProfileRow>(TABLES.studentProfiles, [Query.equal('userId', userId)]), getRow<ProfileRow>(TABLES.profiles, userId)]);
  if (!profile) throw notFound('user_not_found', 'This person could not be found.');
  return toStudentProfile(profile, row);
}

export async function upsertStudentProfile(user: Models.User, patch: UpdateStudentProfileInput): Promise<StudentProfile> {
  const profile = await getOrCreateProfile(user);
  const existing = await findOne<StudentProfileRow>(TABLES.studentProfiles, [Query.equal('userId', user.$id)]);
  const row = existing
    ? await updateRow<StudentProfileRow>(TABLES.studentProfiles, existing.$id, patch)
    : await createRow<StudentProfileRow>(TABLES.studentProfiles, { userId: user.$id, headline: '', goalSummary: '', interests: [], visibility: 'relations', ...patch }, user.$id);
  await markOnboarded(user.$id, 'student');
  return toStudentProfile(profile, row);
}

// --- teacher ----------------------------------------------------------------

async function teacherSignals(userId: string): Promise<TeacherProfile['signals']> {
  const relations = await listRows(TABLES.learningRelations, [Query.equal('teacherId', userId), Query.equal('status', 'active'), Query.limit(1)]);
  const reviewed = await listRows(TABLES.feedbackEntries, [Query.equal('authorId', userId), Query.limit(1)]);
  const profile = await getRow<ProfileRow>(TABLES.profiles, userId);
  return { activeRelations: relations.length, evidenceReviewed: reviewed.length, memberSince: profile?.createdAt ?? new Date().toISOString() };
}

export async function getTeacherProfile(userId: string, user: Models.User | null): Promise<TeacherProfile> {
  const [row, profile] = await Promise.all([findOne<TeacherProfileRow>(TABLES.teacherProfiles, [Query.equal('userId', userId)]), getRow<ProfileRow>(TABLES.profiles, userId)]);
  if (!profile || !row) throw notFound('user_not_found', 'This teacher could not be found.');
  const target = user?.$id === userId ? user : null;
  const emailVerified = target ? target.emailVerification : await isEmailVerified(userId);
  return toTeacherProfile(profile, row, emailVerified, await teacherSignals(userId));
}

async function isEmailVerified(userId: string): Promise<boolean> {
  const { getUsers } = await import('../db/client');
  try {
    return (await getUsers().get({ userId })).emailVerification;
  } catch {
    return false;
  }
}

export async function upsertTeacherProfile(user: Models.User, patch: UpdateTeacherProfileInput): Promise<TeacherProfile> {
  const profile = await getOrCreateProfile(user);
  const existing = await findOne<TeacherProfileRow>(TABLES.teacherProfiles, [Query.equal('userId', user.$id)]);
  const merged = { headline: existing?.headline ?? '', bio: existing?.bio ?? '', subjects: existing?.subjects ?? [], approach: existing?.approach ?? '', ...patch };
  const searchText = [profile.displayName, profile.handle, merged.headline, ...(merged.subjects ?? [])].filter(Boolean).join(' ').toLowerCase().slice(0, 1000);
  const row = existing
    ? await updateRow<TeacherProfileRow>(TABLES.teacherProfiles, existing.$id, { ...patch, searchText })
    : await createRow<TeacherProfileRow>(TABLES.teacherProfiles, { userId: user.$id, acceptingRequests: true, visibility: 'public', ...merged, searchText }, user.$id);
  await markOnboarded(user.$id, 'teacher');
  return toTeacherProfile(profile, row, user.emailVerification, await teacherSignals(user.$id));
}

export async function searchTeachers(params: { q?: string; subject?: string; cursor?: string; limit: number }): Promise<{ rows: TeacherProfileRow[]; profiles: Map<string, ProfileRow> }> {
  const queries = [Query.equal('acceptingRequests', true), Query.equal('visibility', 'public'), Query.orderDesc('updatedAt'), Query.limit(params.limit + 1)];
  if (params.q) queries.push(Query.search('searchText', params.q.toLowerCase()));
  if (params.subject) queries.push(Query.contains('subjects', [params.subject]));
  if (params.cursor) queries.push(Query.cursorAfter(params.cursor));
  const rows = await listRows<TeacherProfileRow>(TABLES.teacherProfiles, queries);
  const ids = rows.map((r) => r.userId);
  const profiles = new Map<string, ProfileRow>();
  if (ids.length) for (const p of await listRows<ProfileRow>(TABLES.profiles, [Query.equal('$id', ids), Query.limit(ids.length)])) profiles.set(p.$id, p);
  return { rows, profiles };
}

export async function lookupByHandle(handle: string): Promise<{ profile: ProfileRow; memberships: RoleMembershipRow[] } | null> {
  const profile = await findOne<ProfileRow>(TABLES.profiles, [Query.equal('handle', handle.toLowerCase())]);
  if (!profile) return null;
  return { profile, memberships: await listMemberships(profile.$id) };
}
