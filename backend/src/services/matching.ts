import { Query, type Models } from 'node-appwrite';
import type { LearningRequest, Role } from '../contracts/api';
import { createRow, findOne, getRow, listRows, updateRow } from '../db/repo';
import { isConflict, pairKey, type LearningRelationRow, type LearningRequestRow, type TeacherProfileRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, forbidden, notFound } from '../errors';
import { toLearningRequest } from '../mappers/learning';
import { emitEvent } from './events';
import { appendMessage, getOrCreateConversation } from './messaging';
import { personRefs } from './profiles';
import { assertNotBlocked } from './safety';

const OPEN = ['pending'];

async function assertNoOpenPair(studentId: string, teacherId: string): Promise<void> {
  const key = pairKey(studentId, teacherId);
  const dup = await findOne<LearningRequestRow>(TABLES.learningRequests, [Query.equal('pairKey', key), Query.equal('status', OPEN)]);
  if (dup) throw conflict('duplicate_request', 'There is already an open request between you two.');
  const active = await findOne<LearningRelationRow>(TABLES.learningRelations, [Query.equal('studentId', studentId), Query.equal('teacherId', teacherId), Query.equal('status', 'active')]);
  if (active) throw conflict('duplicate_request', 'You already have an active learning relation together.');
}

export async function createLearningRequest(student: Models.User, input: { teacherId: string; goalTitle: string; message: string }, requestId?: string): Promise<LearningRequest> {
  if (input.teacherId === student.$id) throw conflict('invalid_state', 'You cannot send a request to yourself.');
  const teacher = await findOne<TeacherProfileRow>(TABLES.teacherProfiles, [Query.equal('userId', input.teacherId)]);
  if (!teacher) throw notFound('user_not_found', 'This teacher could not be found.');
  if (!teacher.acceptingRequests) throw conflict('invalid_state', 'This teacher is not accepting requests right now.');
  await assertNotBlocked(student.$id, input.teacherId);
  await assertNoOpenPair(student.$id, input.teacherId);
  const row = await createRow<LearningRequestRow>(TABLES.learningRequests, {
    kind: 'learning_request', studentId: student.$id, teacherId: input.teacherId, initiatorId: student.$id,
    goalTitle: input.goalTitle, message: input.message, status: 'pending', relationId: null, pairKey: pairKey(student.$id, input.teacherId), respondedAt: null,
  });
  await emitEvent({ eventType: 'request.created', aggregateType: 'learning_request', aggregateId: row.$id, actorId: student.$id, payload: { kind: row.kind }, requestId });
  return hydrate(row, student.$id);
}

export async function createTeacherInvitation(teacher: Models.User, input: { studentId: string; goalTitle: string; message: string }, requestId?: string): Promise<LearningRequest> {
  if (input.studentId === teacher.$id) throw conflict('invalid_state', 'You cannot invite yourself.');
  const target = await getRow(TABLES.profiles, input.studentId);
  if (!target) throw notFound('user_not_found', 'This learner could not be found.');
  await assertNotBlocked(teacher.$id, input.studentId);
  await assertNoOpenPair(input.studentId, teacher.$id);
  const row = await createRow<LearningRequestRow>(TABLES.learningRequests, {
    kind: 'teacher_invitation', studentId: input.studentId, teacherId: teacher.$id, initiatorId: teacher.$id,
    goalTitle: input.goalTitle, message: input.message, status: 'pending', relationId: null, pairKey: pairKey(input.studentId, teacher.$id), respondedAt: null,
  });
  await emitEvent({ eventType: 'request.created', aggregateType: 'learning_request', aggregateId: row.$id, actorId: teacher.$id, payload: { kind: row.kind }, requestId });
  return hydrate(row, teacher.$id);
}

export async function listRequests(userId: string, p: { role: Role; status?: string; cursor?: string; limit: number }): Promise<{ items: LearningRequest[]; nextCursor: string | null }> {
  const q = [Query.equal(p.role === 'student' ? 'studentId' : 'teacherId', userId), Query.orderDesc('createdAt'), Query.limit(p.limit + 1)];
  if (p.status) q.push(Query.equal('status', p.status));
  if (p.cursor) q.push(Query.cursorAfter(p.cursor));
  const rows = await listRows<LearningRequestRow>(TABLES.learningRequests, q);
  const hasMore = rows.length > p.limit;
  const page = hasMore ? rows.slice(0, p.limit) : rows;
  const refs = await personRefs(page.map((r) => (r.studentId === userId ? r.teacherId : r.studentId)));
  const items = page.map((r) => toLearningRequest(r, refs.get(r.studentId === userId ? r.teacherId : r.studentId)!));
  const last = page[page.length - 1];
  return { items, nextCursor: hasMore && last ? last.$id : null };
}

export async function getRequest(id: string, userId: string): Promise<LearningRequest> {
  const row = await getRow<LearningRequestRow>(TABLES.learningRequests, id);
  if (!row || (row.studentId !== userId && row.teacherId !== userId)) throw notFound('not_found', 'This request could not be found.');
  return hydrate(row, userId);
}

async function hydrate(row: LearningRequestRow, viewerId: string): Promise<LearningRequest> {
  const other = row.studentId === viewerId ? row.teacherId : row.studentId;
  return toLearningRequest(row, (await personRefs([other])).get(other)!);
}

/** Accept is idempotent: a second accept returns the same relation (unique index on sourceRequestId). */
export async function acceptRequest(id: string, actor: Models.User, requestId?: string): Promise<LearningRequest> {
  const row = await getRow<LearningRequestRow>(TABLES.learningRequests, id);
  if (!row) throw notFound('not_found', 'This request could not be found.');
  const responder = row.initiatorId === row.studentId ? row.teacherId : row.studentId;
  if (actor.$id !== responder) throw forbidden('Only the person who received this request can accept it.');
  if (row.status === 'accepted' && row.relationId) return hydrate(row, actor.$id);
  if (row.status !== 'pending') throw conflict('invalid_state', 'This request is no longer open.');
  await assertNotBlocked(row.studentId, row.teacherId);

  const conv = await getOrCreateConversation(row.studentId, row.teacherId, null);
  let relation: LearningRelationRow;
  try {
    relation = await createRow<LearningRelationRow>(TABLES.learningRelations, {
      studentId: row.studentId, teacherId: row.teacherId, sourceRequestId: row.$id, status: 'active', conversationId: conv.$id,
      currentGoalId: null, startedAt: new Date().toISOString(), endedAt: null, version: 1, openTasks: 0, evidenceCount: 0, lastActivityAt: new Date().toISOString(),
    });
  } catch (err) {
    if (!isConflict(err)) throw err;
    relation = (await findOne<LearningRelationRow>(TABLES.learningRelations, [Query.equal('sourceRequestId', row.$id)]))!;
  }
  await updateRow(TABLES.conversations, conv.$id, { relationId: relation.$id });
  // Seed the first goal from the request title so the workspace is never empty.
  const { createGoal } = await import('./learning');
  await createGoal(relation, actor.$id, { title: row.goalTitle, description: row.message ?? '' }, requestId);
  const updated = await updateRow<LearningRequestRow>(TABLES.learningRequests, row.$id, { status: 'accepted', relationId: relation.$id, respondedAt: new Date().toISOString() });
  await appendMessage({ conversationId: conv.$id, senderId: actor.$id, type: 'system', payload: { type: 'system', text: 'Learning relation started.' }, requestId });
  await emitEvent({ eventType: 'relation.created', aggregateType: 'learning_relation', aggregateId: relation.$id, actorId: actor.$id, payload: { sourceRequestId: row.$id }, requestId });
  return hydrate(updated, actor.$id);
}

export async function respondRequest(id: string, actor: Models.User, action: 'decline' | 'cancel', requestId?: string): Promise<LearningRequest> {
  const row = await getRow<LearningRequestRow>(TABLES.learningRequests, id);
  if (!row) throw notFound('not_found', 'This request could not be found.');
  const responder = row.initiatorId === row.studentId ? row.teacherId : row.studentId;
  if (action === 'decline' && actor.$id !== responder) throw forbidden('Only the recipient can decline.');
  if (action === 'cancel' && actor.$id !== row.initiatorId) throw forbidden('Only the sender can cancel.');
  if (row.status !== 'pending') throw conflict('invalid_state', 'This request is no longer open.');
  const status = action === 'decline' ? 'declined' : 'cancelled';
  const updated = await updateRow<LearningRequestRow>(TABLES.learningRequests, row.$id, { status, respondedAt: new Date().toISOString() });
  await emitEvent({ eventType: `request.${status}`, aggregateType: 'learning_request', aggregateId: row.$id, actorId: actor.$id, payload: {}, requestId });
  return hydrate(updated, actor.$id);
}
