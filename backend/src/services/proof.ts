import { Query } from 'node-appwrite';
import type { EvidenceItem, Feedback, ProofRecord } from '../contracts/api';
import { createRow, getRow, listRows, updateRow } from '../db/repo';
import { isConflict, type EvidenceItemRow, type FeedbackEntryRow, type LearningGoalRow, type LearningRelationRow, type LearningTaskRow, type ProofRecordRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, notFound } from '../errors';
import { toEvidence, toFeedback, toProof } from '../mappers/learning';
import { emitEvent } from './events';
import { appendMessage } from './messaging';

export async function listEvidence(relationId: string, limit: number, cursor?: string): Promise<{ items: EvidenceItem[]; nextCursor: string | null }> {
  const q = [Query.equal('relationId', relationId), Query.orderDesc('submittedAt'), Query.limit(limit + 1)];
  if (cursor) q.push(Query.cursorAfter(cursor));
  const rows = await listRows<EvidenceItemRow>(TABLES.evidenceItems, q);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const fb = page.length ? await listRows<FeedbackEntryRow>(TABLES.feedbackEntries, [Query.equal('evidenceId', page.map((e) => e.$id)), Query.orderAsc('createdAt'), Query.limit(200)]) : [];
  const last = page[page.length - 1];
  return { items: page.map((e) => toEvidence(e, fb.filter((f) => f.evidenceId === e.$id))), nextCursor: hasMore && last ? last.$id : null };
}

export async function getEvidence(relationId: string, evidenceId: string): Promise<EvidenceItem> {
  const row = await getRow<EvidenceItemRow>(TABLES.evidenceItems, evidenceId);
  if (!row || row.relationId !== relationId) throw notFound('not_found', 'This evidence could not be found.');
  const fb = await listRows<FeedbackEntryRow>(TABLES.feedbackEntries, [Query.equal('evidenceId', evidenceId), Query.orderAsc('createdAt'), Query.limit(100)]);
  return toEvidence(row, fb);
}

export async function submitEvidence(rel: LearningRelationRow, authorId: string, input: { title: string; body: string; taskId?: string | null; goalId?: string | null; attachmentFileIds?: string[] }, requestId?: string): Promise<EvidenceItem> {
  if (rel.status !== 'active') throw conflict('invalid_state', 'This learning relation is not active.');
  let taskId = input.taskId ?? null;
  if (taskId) {
    const task = await getRow<LearningTaskRow>(TABLES.learningTasks, taskId);
    if (!task || task.relationId !== rel.$id) throw notFound('not_found', 'This task could not be found.');
    if (task.status === 'open' || task.status === 'reviewed') await updateRow(TABLES.learningTasks, taskId, { status: 'submitted' });
  }
  const row = await createRow<EvidenceItemRow>(TABLES.evidenceItems, {
    relationId: rel.$id, taskId, goalId: input.goalId ?? rel.currentGoalId, authorId, title: input.title, body: input.body,
    attachmentFileIds: input.attachmentFileIds ?? [], status: 'submitted', version: 1, submittedAt: new Date().toISOString(), reviewedAt: null,
  });
  await updateRow(TABLES.learningRelations, rel.$id, { evidenceCount: rel.evidenceCount + 1, lastActivityAt: row.submittedAt });
  await appendMessage({ conversationId: rel.conversationId, senderId: authorId, type: 'evidence_submitted', payload: { type: 'evidence_submitted', evidenceId: row.$id, title: row.title, taskId }, requestId });
  await emitEvent({ eventType: 'evidence.submitted', aggregateType: 'learning_relation', aggregateId: rel.$id, actorId: authorId, payload: { evidenceId: row.$id }, requestId });
  await recomputeProof(rel.$id);
  return toEvidence(row, []);
}

export async function addFeedback(rel: LearningRelationRow, evidenceId: string, authorId: string, input: { body: string; nextStep?: string; markTaskDone?: boolean }, requestId?: string): Promise<Feedback> {
  const ev = await getRow<EvidenceItemRow>(TABLES.evidenceItems, evidenceId);
  if (!ev || ev.relationId !== rel.$id) throw notFound('not_found', 'This evidence could not be found.');
  const fb = await createRow<FeedbackEntryRow>(TABLES.feedbackEntries, { evidenceId, relationId: rel.$id, authorId, body: input.body, nextStep: input.nextStep ?? '' });
  await updateRow(TABLES.evidenceItems, evidenceId, { status: 'reviewed', reviewedAt: fb.createdAt });
  let openDelta = 0;
  if (ev.taskId) {
    const task = await getRow<LearningTaskRow>(TABLES.learningTasks, ev.taskId);
    if (task && task.status !== 'done' && task.status !== 'dropped') {
      const next = input.markTaskDone ? 'done' : 'reviewed';
      await updateRow(TABLES.learningTasks, ev.taskId, { status: next });
      if (next === 'done') openDelta = -1;
    }
  }
  await updateRow(TABLES.learningRelations, rel.$id, { lastActivityAt: fb.createdAt, openTasks: Math.max(0, rel.openTasks + openDelta) });
  await appendMessage({ conversationId: rel.conversationId, senderId: authorId, type: 'feedback_added', payload: { type: 'feedback_added', feedbackId: fb.$id, evidenceId, excerpt: input.body.slice(0, 140) }, requestId });
  await emitEvent({ eventType: 'feedback.added', aggregateType: 'learning_relation', aggregateId: rel.$id, actorId: authorId, payload: { feedbackId: fb.$id }, requestId });
  await recomputeProof(rel.$id);
  return toFeedback(fb);
}

/** Explainable projection: plain counts + milestones that each point at real records. No composite score. */
export async function recomputeProof(relationId: string): Promise<ProofRecord> {
  const [rel, goals, tasks, evidence, feedback] = await Promise.all([
    getRow<LearningRelationRow>(TABLES.learningRelations, relationId),
    listRows<LearningGoalRow>(TABLES.learningGoals, [Query.equal('relationId', relationId), Query.limit(100)]),
    listRows<LearningTaskRow>(TABLES.learningTasks, [Query.equal('relationId', relationId), Query.limit(200)]),
    listRows<EvidenceItemRow>(TABLES.evidenceItems, [Query.equal('relationId', relationId), Query.orderDesc('submittedAt'), Query.limit(200)]),
    listRows<FeedbackEntryRow>(TABLES.feedbackEntries, [Query.equal('relationId', relationId), Query.orderDesc('createdAt'), Query.limit(200)]),
  ]);
  if (!rel) throw notFound('not_found', 'This learning relation could not be found.');
  const current = goals.find((g) => g.$id === rel.currentGoalId) ?? goals.find((g) => g.status === 'active') ?? null;
  const milestones = goals.filter((g) => g.status === 'achieved').slice(0, 5).map((g) => ({ id: g.$id, title: g.title, reachedAt: g.updatedAt, evidenceId: evidence.find((e) => e.goalId === g.$id)?.$id ?? null }));
  const latestFb = feedback[0];
  const latestEv = evidence[0];
  const nextOpen = tasks.filter((t) => t.status === 'open').sort((a, b) => (a.dueAt ?? '9') < (b.dueAt ?? '9') ? -1 : 1)[0];
  const data = {
    relationId,
    currentFocus: current?.title ?? null,
    milestonesJson: JSON.stringify(milestones),
    tasksDone: tasks.filter((t) => t.status === 'done').length,
    evidenceSubmitted: evidence.length,
    feedbackReceived: feedback.length,
    revisions: evidence.filter((e) => e.version > 1 || e.status === 'revised').length,
    recentChange: latestFb ? `Feedback on "${evidence.find((e) => e.$id === latestFb.evidenceId)?.title ?? 'evidence'}"` : latestEv ? `Submitted "${latestEv.title}"` : null,
    nextStep: latestFb?.nextStep || nextOpen?.title || null,
    computedAt: new Date().toISOString(),
  };
  let row: ProofRecordRow;
  const existing = await getRow<ProofRecordRow>(TABLES.proofRecords, relationId);
  if (existing) row = await updateRow<ProofRecordRow>(TABLES.proofRecords, relationId, data);
  else {
    try {
      row = await createRow<ProofRecordRow>(TABLES.proofRecords, data, relationId);
    } catch (err) {
      if (!isConflict(err)) throw err;
      row = await updateRow<ProofRecordRow>(TABLES.proofRecords, relationId, data);
    }
  }
  return toProof(row);
}
