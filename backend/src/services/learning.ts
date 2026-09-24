import { createHash } from 'node:crypto';
import { Query } from 'node-appwrite';
import type { LearningGoal, LearningRelation, LearningTask, RelationNextAction, RelationWorkspace } from '../contracts/api';
import { createRow, getRow, listRows, updateRow } from '../db/repo';
import { isConflict, type EvidenceItemRow, type FeedbackEntryRow, type LearningGoalRow, type LearningRelationRow, type LearningTaskRow, type ProofRecordRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, forbidden, notFound, validation } from '../errors';
import { NO_ACTION, toEvidence, toGoal, toProof, toRelation, toTask } from '../mappers/learning';
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

/** Every write inside a relation (goals, tasks, evidence, feedback) requires it to be active. */
export function assertRelationWritable(rel: LearningRelationRow): void {
  if (rel.status !== 'active') throw conflict('invalid_state', rel.status === 'paused' ? 'This learning relation is paused. Resume it first.' : 'This learning relation has ended.', { reason: 'relation_not_active', status: rel.status });
}

/** Deterministic id for the goal seeded from the accepted request, so a retried accept never duplicates it. */
export const seedGoalId = (relationId: string) => createHash('sha256').update(`seed-goal:${relationId}`).digest('hex').slice(0, 32);

type RelStatus = 'active' | 'paused' | 'ended';
const TRANSITIONS: Record<RelStatus, RelStatus[]> = { active: ['paused', 'ended'], paused: ['active', 'ended'], ended: [] };

// --- next action ("whose turn is it") ------------------------------------

export type PendingWork = {
  status: string;
  awaitingReview: number;
  awaitingRevision: number;
  openTaskDueDates: (string | null)[];
  goalCompletionRequests: number;
};

/** Pure: priority order from the plan (L2.3). Earliest due date wins for student_submit. */
export function deriveNextAction(w: PendingWork): RelationNextAction {
  if (w.status !== 'active') return NO_ACTION;
  if (w.awaitingReview > 0) return { kind: 'teacher_review', count: w.awaitingReview, dueAt: null };
  if (w.awaitingRevision > 0) return { kind: 'student_revise', count: w.awaitingRevision, dueAt: null };
  if (w.openTaskDueDates.length > 0) {
    const due = w.openTaskDueDates.filter((d): d is string => !!d).sort()[0] ?? null;
    return { kind: 'student_submit', count: w.openTaskDueDates.length, dueAt: due };
  }
  if (w.goalCompletionRequests > 0) return { kind: 'teacher_confirm_goal', count: w.goalCompletionRequests, dueAt: null };
  return { kind: 'teacher_assign', count: 0, dueAt: null };
}

/** Three batched queries for a whole page of relations (only active ones need work counted). */
export async function nextActionsFor(rels: LearningRelationRow[]): Promise<Map<string, RelationNextAction>> {
  const out = new Map<string, RelationNextAction>(rels.map((r) => [r.$id, NO_ACTION]));
  const ids = rels.filter((r) => r.status === 'active').map((r) => r.$id);
  if (!ids.length) return out;
  const [evidence, tasks, goals] = await Promise.all([
    listRows<EvidenceItemRow>(TABLES.evidenceItems, [Query.equal('relationId', ids), Query.equal('status', ['submitted', 'revision_requested']), Query.limit(500)]),
    listRows<LearningTaskRow>(TABLES.learningTasks, [Query.equal('relationId', ids), Query.equal('status', 'open'), Query.limit(500)]),
    listRows<LearningGoalRow>(TABLES.learningGoals, [Query.equal('relationId', ids), Query.equal('status', 'active'), Query.limit(500)]),
  ]);
  for (const id of ids) {
    const ev = evidence.filter((e) => e.relationId === id);
    out.set(id, deriveNextAction({
      status: 'active',
      awaitingReview: ev.filter((e) => e.status === 'submitted').length,
      awaitingRevision: ev.filter((e) => e.status === 'revision_requested').length,
      openTaskDueDates: tasks.filter((t) => t.relationId === id).map((t) => t.dueAt),
      goalCompletionRequests: goals.filter((g) => g.relationId === id && (g as LearningGoalRow & { completionRequestedAt?: string | null }).completionRequestedAt).length,
    }));
  }
  return out;
}

export async function listRelations(userId: string, role: 'student' | 'teacher', status: string | undefined, limit: number, cursor?: string): Promise<{ items: LearningRelation[]; nextCursor: string | null }> {
  const q = [Query.equal(role === 'student' ? 'studentId' : 'teacherId', userId), Query.orderDesc('lastActivityAt'), Query.limit(limit + 1)];
  if (status) q.push(Query.equal('status', status));
  if (cursor) q.push(Query.cursorAfter(cursor));
  const rows = await listRows<LearningRelationRow>(TABLES.learningRelations, q);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const [refs, next] = await Promise.all([personRefs(page.flatMap((r) => [r.studentId, r.teacherId])), nextActionsFor(page)]);
  const last = page[page.length - 1];
  return { items: page.map((r) => toRelation(r, refs.get(r.studentId)!, refs.get(r.teacherId)!, next.get(r.$id))), nextCursor: hasMore && last ? last.$id : null };
}

export async function getRelation(relationId: string, userId: string): Promise<LearningRelation> {
  const rel = await requireRelationMember(relationId, userId);
  const [refs, next] = await Promise.all([personRefs([rel.studentId, rel.teacherId]), nextActionsFor([rel])]);
  return toRelation(rel, refs.get(rel.studentId)!, refs.get(rel.teacherId)!, next.get(rel.$id));
}

export async function getWorkspace(relationId: string, userId: string): Promise<RelationWorkspace> {
  const rel = await requireRelationMember(relationId, userId);
  const [refs, goals, tasks, evidence, proof, next] = await Promise.all([
    personRefs([rel.studentId, rel.teacherId]),
    listRows<LearningGoalRow>(TABLES.learningGoals, [Query.equal('relationId', relationId), Query.orderDesc('createdAt'), Query.limit(50)]),
    listRows<LearningTaskRow>(TABLES.learningTasks, [Query.equal('relationId', relationId), Query.orderDesc('createdAt'), Query.limit(100)]),
    listRows<EvidenceItemRow>(TABLES.evidenceItems, [Query.equal('relationId', relationId), Query.orderDesc('submittedAt'), Query.limit(5)]),
    getRow<ProofRecordRow>(TABLES.proofRecords, relationId),
    nextActionsFor([rel]),
  ]);
  const feedback = evidence.length ? await listRows<FeedbackEntryRow>(TABLES.feedbackEntries, [Query.equal('evidenceId', evidence.map((e) => e.$id)), Query.orderAsc('createdAt'), Query.limit(100)]) : [];
  return {
    relation: toRelation(rel, refs.get(rel.studentId)!, refs.get(rel.teacherId)!, next.get(rel.$id)),
    goals: goals.map(toGoal),
    tasks: tasks.map(toTask),
    recentEvidence: evidence.map((e) => toEvidence(e, feedback.filter((f) => f.evidenceId === e.$id))),
    proof: proof ? toProof(proof) : null,
  };
}

export async function updateRelationStatus(relationId: string, userId: string, input: { status: RelStatus; reason?: string }, requestId?: string): Promise<LearningRelation> {
  const rel = await requireRelationMember(relationId, userId);
  const from = rel.status as RelStatus;
  const to = input.status;
  if (from === 'ended') throw conflict('invalid_state', 'This learning relation has ended.');
  if (!TRANSITIONS[from]?.includes(to)) throw conflict('invalid_state', `This learning relation is already ${from}.`, { from, to });
  const reason = input.reason?.trim() ?? '';
  if (to === 'ended' && !reason) throw validation('Tell the other person why you are ending this learning relation.', [{ path: 'reason', message: 'Required' }]);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: to, version: rel.version + 1, lastActivityAt: now };
  if (to === 'paused') Object.assign(patch, { pausedBy: userId, pausedAt: now });
  if (to === 'active') Object.assign(patch, { pausedBy: null, pausedAt: null });
  if (to === 'ended') Object.assign(patch, { endedAt: now, endedBy: userId, endReason: reason.slice(0, 500) });
  await updateRow(TABLES.learningRelations, relationId, patch);
  const text = to === 'ended' ? `Learning relation ended. Reason: ${reason}` : to === 'paused' ? 'Learning relation paused.' : 'Learning relation resumed.';
  await appendMessage({ conversationId: rel.conversationId, senderId: userId, type: 'system', payload: { type: 'system', text }, requestId });
  const other = userId === rel.teacherId ? rel.studentId : rel.teacherId;
  const kind = to === 'active' ? 'resumed' : to;
  const titles = { paused: 'A learning relation was paused', resumed: 'A learning relation was resumed', ended: 'A learning relation was ended' } as const;
  await notify({
    userId: other, type: `relation.${kind}`, title: titles[kind], body: to === 'ended' ? reason.slice(0, 300) : '',
    href: `/relations/${relationId}`, refType: 'learning_relation', refId: relationId, actorId: userId, dedupeKey: `relation.${kind}:${relationId}:${rel.version + 1}`,
  });
  await emitEvent({ eventType: `relation.${to === 'active' ? 'resumed' : to}`, aggregateType: 'learning_relation', aggregateId: relationId, actorId: userId, payload: { from, reason: to === 'ended' ? reason : undefined }, requestId });
  return getRelation(relationId, userId);
}

async function touch(rel: LearningRelationRow, patch: Record<string, unknown> = {}): Promise<void> {
  await updateRow(TABLES.learningRelations, rel.$id, { lastActivityAt: new Date().toISOString(), ...patch });
}

// --- goals ---------------------------------------------------------------

export async function createGoal(rel: LearningRelationRow, actorId: string, input: { title: string; description?: string }, requestId?: string, rowId?: string): Promise<LearningGoal> {
  assertRelationWritable(rel);
  let row: LearningGoalRow;
  try {
    row = await createRow<LearningGoalRow>(TABLES.learningGoals, { relationId: rel.$id, title: input.title, description: input.description ?? '', status: 'active', createdBy: actorId }, rowId);
  } catch (err) {
    // Retried seed: the goal already exists, so skip the side effects that ran the first time.
    if (!rowId || !isConflict(err)) throw err;
    const existing = await getRow<LearningGoalRow>(TABLES.learningGoals, rowId);
    if (!existing) throw err;
    return toGoal(existing);
  }
  await touch(rel, rel.currentGoalId ? {} : { currentGoalId: row.$id });
  await appendMessage({ conversationId: rel.conversationId, senderId: actorId, type: 'goal_created', payload: { type: 'goal_created', goalId: row.$id, title: row.title }, requestId });
  await emitEvent({ eventType: 'goal.created', aggregateType: 'learning_relation', aggregateId: rel.$id, actorId, payload: { goalId: row.$id }, requestId });
  if (!rowId) {
    const other = actorId === rel.teacherId ? rel.studentId : rel.teacherId;
    await notify({ userId: other, type: 'goal.created', title: actorId === rel.studentId ? 'Your learner proposed a new goal' : 'New learning goal', body: row.title, href: `/relations/${rel.$id}`, refType: 'learning_goal', refId: row.$id, actorId, dedupeKey: `goal.created:${row.$id}` });
  }
  await recomputeProof(rel.$id);
  return toGoal(row);
}

export async function updateGoal(relationId: string, goalId: string, userId: string, patch: { title?: string; description?: string; status?: string }, requestId?: string): Promise<LearningGoal> {
  const rel = await requireRelationMember(relationId, userId);
  assertRelationWritable(rel);
  const goal = await getRow<LearningGoalRow>(TABLES.learningGoals, goalId);
  if (!goal || goal.relationId !== relationId) throw notFound('not_found', 'This goal could not be found.');
  if (patch.status && patch.status !== goal.status && userId !== rel.teacherId) throw forbidden('Only the teacher can change a goal\'s status.');
  const row = await updateRow<LearningGoalRow>(TABLES.learningGoals, goalId, patch);
  await touch(rel);
  if (patch.status === 'achieved' && goal.status !== 'achieved') {
    await appendMessage({ conversationId: rel.conversationId, senderId: userId, type: 'milestone_reached', payload: { type: 'milestone_reached', milestoneId: goalId, title: row.title }, requestId });
    await emitEvent({ eventType: 'goal.achieved', aggregateType: 'learning_relation', aggregateId: relationId, actorId: userId, payload: { goalId }, requestId });
    await notify({ userId: rel.studentId, type: 'goal.achieved', title: 'Goal achieved', body: row.title, href: `/relations/${relationId}`, refType: 'learning_goal', refId: goalId, actorId: userId, dedupeKey: `goal.achieved:${goalId}` });
  }
  await recomputeProof(relationId);
  return toGoal(row);
}

// --- tasks ---------------------------------------------------------------

export async function createTask(relationId: string, userId: string, input: { title: string; instructions?: string; goalId?: string | null; dueAt?: string | null }, requestId?: string): Promise<LearningTask> {
  const rel = await requireRelationMember(relationId, userId);
  if (rel.teacherId !== userId) throw forbidden('Only the teacher assigns tasks.');
  assertRelationWritable(rel);
  const row = await createRow<LearningTaskRow>(TABLES.learningTasks, { relationId, goalId: input.goalId ?? rel.currentGoalId, title: input.title, instructions: input.instructions ?? '', status: 'open', assignedBy: userId, dueAt: input.dueAt ?? null });
  await touch(rel, { openTasks: rel.openTasks + 1 });
  await appendMessage({ conversationId: rel.conversationId, senderId: userId, type: 'task_assigned', payload: { type: 'task_assigned', taskId: row.$id, title: row.title, dueAt: row.dueAt }, requestId });
  await emitEvent({ eventType: 'task.assigned', aggregateType: 'learning_relation', aggregateId: relationId, actorId: userId, payload: { taskId: row.$id }, requestId });
  await notify({ userId: userId === rel.teacherId ? rel.studentId : rel.teacherId, type: 'task.assigned', title: 'New task', body: row.title, href: `/relations/${relationId}`, refType: 'learning_task', refId: row.$id, actorId: userId, dedupeKey: `task.assigned:${row.$id}` });
  return toTask(row);
}

export async function updateTask(relationId: string, taskId: string, userId: string, patch: { title?: string; instructions?: string; status?: string; dueAt?: string | null }): Promise<LearningTask> {
  const rel = await requireRelationMember(relationId, userId);
  if (rel.teacherId !== userId) throw forbidden('Only the teacher can edit tasks.');
  assertRelationWritable(rel);
  const task = await getRow<LearningTaskRow>(TABLES.learningTasks, taskId);
  if (!task || task.relationId !== relationId) throw notFound('not_found', 'This task could not be found.');
  const row = await updateRow<LearningTaskRow>(TABLES.learningTasks, taskId, patch);
  const wasOpen = task.status === 'open' || task.status === 'submitted' || task.status === 'reviewed';
  const isOpen = row.status === 'open' || row.status === 'submitted' || row.status === 'reviewed';
  await touch(rel, wasOpen !== isOpen ? { openTasks: Math.max(0, rel.openTasks + (isOpen ? 1 : -1)) } : {});
  await recomputeProof(relationId);
  return toTask(row);
}
