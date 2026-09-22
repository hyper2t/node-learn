import { Query } from 'node-appwrite';
import type { LearningGoal, LearningRelation, LearningTask, RelationWorkspace } from '../contracts/api';
import { createRow, getRow, listRows, updateRow } from '../db/repo';
import type { EvidenceItemRow, FeedbackEntryRow, LearningGoalRow, LearningRelationRow, LearningTaskRow, ProofRecordRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, forbidden, notFound } from '../errors';
import { toEvidence, toGoal, toProof, toRelation, toTask } from '../mappers/learning';
import { emitEvent } from './events';
import { notify } from './notifications';
import { appendMessage } from './messaging';
import { personRefs } from './profiles';
import { recomputeProof } from './proof';

export async function requireRelationMember(relationId: string, userId: string): Promise<LearningRelationRow> {
  const rel = await getRow<LearningRelationRow>(TABLES.learningRelations, relationId);
  if (!rel) throw notFound('not_found', 'This learning relation could not be found.');
  if (rel.studentId !== userId && rel.teacherId !== userId) throw forbidden();
  return rel;
}

export async function listRelations(userId: string, role: 'student' | 'teacher', status: string | undefined, limit: number, cursor?: string): Promise<{ items: LearningRelation[]; nextCursor: string | null }> {
  const q = [Query.equal(role === 'student' ? 'studentId' : 'teacherId', userId), Query.orderDesc('lastActivityAt'), Query.limit(limit + 1)];
  if (status) q.push(Query.equal('status', status));
  if (cursor) q.push(Query.cursorAfter(cursor));
  const rows = await listRows<LearningRelationRow>(TABLES.learningRelations, q);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const refs = await personRefs(page.flatMap((r) => [r.studentId, r.teacherId]));
  const last = page[page.length - 1];
  return { items: page.map((r) => toRelation(r, refs.get(r.studentId)!, refs.get(r.teacherId)!)), nextCursor: hasMore && last ? last.$id : null };
}

export async function getRelation(relationId: string, userId: string): Promise<LearningRelation> {
  const rel = await requireRelationMember(relationId, userId);
  const refs = await personRefs([rel.studentId, rel.teacherId]);
  return toRelation(rel, refs.get(rel.studentId)!, refs.get(rel.teacherId)!);
}

export async function getWorkspace(relationId: string, userId: string): Promise<RelationWorkspace> {
  const rel = await requireRelationMember(relationId, userId);
  const [refs, goals, tasks, evidence, proof] = await Promise.all([
    personRefs([rel.studentId, rel.teacherId]),
    listRows<LearningGoalRow>(TABLES.learningGoals, [Query.equal('relationId', relationId), Query.orderDesc('createdAt'), Query.limit(50)]),
    listRows<LearningTaskRow>(TABLES.learningTasks, [Query.equal('relationId', relationId), Query.orderDesc('createdAt'), Query.limit(100)]),
    listRows<EvidenceItemRow>(TABLES.evidenceItems, [Query.equal('relationId', relationId), Query.orderDesc('submittedAt'), Query.limit(5)]),
    getRow<ProofRecordRow>(TABLES.proofRecords, relationId),
  ]);
  const feedback = evidence.length ? await listRows<FeedbackEntryRow>(TABLES.feedbackEntries, [Query.equal('evidenceId', evidence.map((e) => e.$id)), Query.orderAsc('createdAt'), Query.limit(100)]) : [];
  return {
    relation: toRelation(rel, refs.get(rel.studentId)!, refs.get(rel.teacherId)!),
    goals: goals.map(toGoal),
    tasks: tasks.map(toTask),
    recentEvidence: evidence.map((e) => toEvidence(e, feedback.filter((f) => f.evidenceId === e.$id))),
    proof: proof ? toProof(proof) : null,
  };
}

export async function updateRelationStatus(relationId: string, userId: string, status: 'active' | 'paused' | 'ended', requestId?: string): Promise<LearningRelation> {
  const rel = await requireRelationMember(relationId, userId);
  if (rel.status === 'ended') throw conflict('invalid_state', 'This learning relation has ended.');
  await updateRow(TABLES.learningRelations, relationId, { status, endedAt: status === 'ended' ? new Date().toISOString() : null, version: rel.version + 1 });
  await appendMessage({ conversationId: rel.conversationId, senderId: userId, type: 'system', payload: { type: 'system', text: status === 'ended' ? 'Learning relation ended.' : status === 'paused' ? 'Learning relation paused.' : 'Learning relation resumed.' }, requestId });
  await emitEvent({ eventType: `relation.${status}`, aggregateType: 'learning_relation', aggregateId: relationId, actorId: userId, payload: {}, requestId });
  return getRelation(relationId, userId);
}

async function touch(rel: LearningRelationRow, patch: Record<string, unknown> = {}): Promise<void> {
  await updateRow(TABLES.learningRelations, rel.$id, { lastActivityAt: new Date().toISOString(), ...patch });
}

// --- goals ---------------------------------------------------------------

export async function createGoal(rel: LearningRelationRow, actorId: string, input: { title: string; description?: string }, requestId?: string): Promise<LearningGoal> {
  const row = await createRow<LearningGoalRow>(TABLES.learningGoals, { relationId: rel.$id, title: input.title, description: input.description ?? '', status: 'active', createdBy: actorId });
  await touch(rel, rel.currentGoalId ? {} : { currentGoalId: row.$id });
  await appendMessage({ conversationId: rel.conversationId, senderId: actorId, type: 'goal_created', payload: { type: 'goal_created', goalId: row.$id, title: row.title }, requestId });
  await emitEvent({ eventType: 'goal.created', aggregateType: 'learning_relation', aggregateId: rel.$id, actorId, payload: { goalId: row.$id }, requestId });
  await recomputeProof(rel.$id);
  return toGoal(row);
}

export async function updateGoal(relationId: string, goalId: string, userId: string, patch: { title?: string; description?: string; status?: string }, requestId?: string): Promise<LearningGoal> {
  const rel = await requireRelationMember(relationId, userId);
  const goal = await getRow<LearningGoalRow>(TABLES.learningGoals, goalId);
  if (!goal || goal.relationId !== relationId) throw notFound('not_found', 'This goal could not be found.');
  const row = await updateRow<LearningGoalRow>(TABLES.learningGoals, goalId, patch);
  await touch(rel);
  if (patch.status === 'achieved' && goal.status !== 'achieved') {
    await appendMessage({ conversationId: rel.conversationId, senderId: userId, type: 'milestone_reached', payload: { type: 'milestone_reached', milestoneId: goalId, title: row.title }, requestId });
  }
  await recomputeProof(relationId);
  return toGoal(row);
}

// --- tasks ---------------------------------------------------------------

export async function createTask(relationId: string, userId: string, input: { title: string; instructions?: string; goalId?: string | null; dueAt?: string | null }, requestId?: string): Promise<LearningTask> {
  const rel = await requireRelationMember(relationId, userId);
  if (rel.status !== 'active') throw conflict('invalid_state', 'This learning relation is not active.');
  const row = await createRow<LearningTaskRow>(TABLES.learningTasks, { relationId, goalId: input.goalId ?? rel.currentGoalId, title: input.title, instructions: input.instructions ?? '', status: 'open', assignedBy: userId, dueAt: input.dueAt ?? null });
  await touch(rel, { openTasks: rel.openTasks + 1 });
  await appendMessage({ conversationId: rel.conversationId, senderId: userId, type: 'task_assigned', payload: { type: 'task_assigned', taskId: row.$id, title: row.title, dueAt: row.dueAt }, requestId });
  await emitEvent({ eventType: 'task.assigned', aggregateType: 'learning_relation', aggregateId: relationId, actorId: userId, payload: { taskId: row.$id }, requestId });
  await notify({ userId: userId === rel.teacherId ? rel.studentId : rel.teacherId, type: 'task.assigned', title: 'New task', body: row.title, href: `/relations/${relationId}`, refType: 'learning_task', refId: row.$id, actorId: userId, dedupeKey: `task.assigned:${row.$id}` });
  return toTask(row);
}

export async function updateTask(relationId: string, taskId: string, userId: string, patch: { title?: string; instructions?: string; status?: string; dueAt?: string | null }): Promise<LearningTask> {
  const rel = await requireRelationMember(relationId, userId);
  const task = await getRow<LearningTaskRow>(TABLES.learningTasks, taskId);
  if (!task || task.relationId !== relationId) throw notFound('not_found', 'This task could not be found.');
  const row = await updateRow<LearningTaskRow>(TABLES.learningTasks, taskId, patch);
  const wasOpen = task.status === 'open' || task.status === 'submitted' || task.status === 'reviewed';
  const isOpen = row.status === 'open' || row.status === 'submitted' || row.status === 'reviewed';
  await touch(rel, wasOpen !== isOpen ? { openTasks: Math.max(0, rel.openTasks + (isOpen ? 1 : -1)) } : {});
  await recomputeProof(relationId);
  return toTask(row);
}
