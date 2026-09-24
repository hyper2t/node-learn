import { createHash } from 'node:crypto';
import { Query } from 'node-appwrite';
import type { EvidenceItem, Feedback } from '../contracts/api';
import { createRow, getRow, incrementColumn, listRows, updateRow } from '../db/repo';
import { isConflict, type EvidenceItemRow, type EvidenceRevisionRow, type FeedbackEntryRow, type LearningRelationRow, type LearningTaskRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, forbidden, notFound } from '../errors';
import { toEvidence, toFeedback, toRevision } from '../mappers/learning';
import { emitEvent } from './events';
import { notify } from './notifications';
import { appendMessage } from './messaging';
import { assertEvidenceAttachments, resolveAttachments } from './uploads';
import { assertRelationWritable } from './learning';
import { applyProofEvent, bumpColumn, nextStepDisplay, taskDeltas } from './proof-projection';

export async function listEvidence(relationId: string, limit: number, cursor?: string): Promise<{ items: EvidenceItem[]; nextCursor: string | null }> {
  const q = [Query.equal('relationId', relationId), Query.orderDesc('submittedAt'), Query.limit(limit + 1)];
  if (cursor) q.push(Query.cursorAfter(cursor));
  const rows = await listRows<EvidenceItemRow>(TABLES.evidenceItems, q);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const fb = page.length ? await listRows<FeedbackEntryRow>(TABLES.feedbackEntries, [Query.equal('evidenceId', page.map((e) => e.$id)), Query.orderAsc('createdAt'), Query.limit(200)]) : [];
  const last = page[page.length - 1];
  const items = await Promise.all(page.map(async (e) => toEvidence(e, fb.filter((f) => f.evidenceId === e.$id), await resolveAttachments(e.attachmentFileIds ?? []))));
  return { items, nextCursor: hasMore && last ? last.$id : null };
}

export async function getEvidence(relationId: string, evidenceId: string): Promise<EvidenceItem> {
  const row = await getRow<EvidenceItemRow>(TABLES.evidenceItems, evidenceId);
  if (!row || row.relationId !== relationId) throw notFound('not_found', 'This evidence could not be found.');
  const [fb, revisions] = await Promise.all([
    listRows<FeedbackEntryRow>(TABLES.feedbackEntries, [Query.equal('evidenceId', evidenceId), Query.orderAsc('createdAt'), Query.limit(100)]),
    row.version > 1 ? listRows<EvidenceRevisionRow>(TABLES.evidenceRevisions, [Query.equal('evidenceId', evidenceId), Query.orderDesc('version'), Query.limit(20)]) : Promise.resolve([]),
  ]);
  return { ...toEvidence(row, fb, await resolveAttachments(row.attachmentFileIds ?? [])), revisions: revisions.map(toRevision) };
}

export async function submitEvidence(rel: LearningRelationRow, authorId: string, input: { title: string; body: string; taskId?: string | null; goalId?: string | null; attachmentFileIds?: string[] }, requestId?: string): Promise<EvidenceItem> {
  assertRelationWritable(rel);
  const attachmentFileIds = await assertEvidenceAttachments(authorId, rel.$id, input.attachmentFileIds ?? []);
  let taskId = input.taskId ?? null;
  if (taskId) {
    const task = await getRow<LearningTaskRow>(TABLES.learningTasks, taskId);
    if (!task || task.relationId !== rel.$id) throw notFound('not_found', 'This task could not be found.');
    if (task.status === 'open' || task.status === 'reviewed') await updateRow(TABLES.learningTasks, taskId, { status: 'submitted' });
  }
  const row = await createRow<EvidenceItemRow>(TABLES.evidenceItems, {
    relationId: rel.$id, taskId, goalId: input.goalId ?? rel.currentGoalId, authorId, title: input.title, body: input.body,
    attachmentFileIds, status: 'submitted', version: 1, submittedAt: new Date().toISOString(), reviewedAt: null,
  });
  await incrementColumn(TABLES.learningRelations, rel.$id, 'evidenceCount', 1);
  await updateRow(TABLES.learningRelations, rel.$id, { lastActivityAt: row.submittedAt });
  await appendMessage({ conversationId: rel.conversationId, senderId: authorId, type: 'evidence_submitted', payload: { type: 'evidence_submitted', evidenceId: row.$id, title: row.title, taskId }, requestId });
  await emitEvent({ eventType: 'evidence.submitted', aggregateType: 'learning_relation', aggregateId: rel.$id, actorId: authorId, payload: { evidenceId: row.$id }, requestId });
  await notify({ userId: authorId === rel.studentId ? rel.teacherId : rel.studentId, type: 'evidence.submitted', title: 'New evidence to review', body: row.title, href: `/relations/${rel.$id}/evidence/${row.$id}`, refType: 'evidence_item', refId: row.$id, actorId: authorId, dedupeKey: `evidence.submitted:${row.$id}` });
  await applyProofEvent(rel.$id, { evidenceSubmitted: 1 }, { recentChange: `Submitted "${row.title}"` });
  return toEvidence(row, [], await resolveAttachments(attachmentFileIds));
}

export async function addFeedback(rel: LearningRelationRow, evidenceId: string, authorId: string, input: { body: string; nextStep?: string; markTaskDone?: boolean; outcome?: 'approved' | 'needs_revision' }, requestId?: string): Promise<Feedback> {
  assertRelationWritable(rel);
  const ev = await getRow<EvidenceItemRow>(TABLES.evidenceItems, evidenceId);
  if (!ev || ev.relationId !== rel.$id) throw notFound('not_found', 'This evidence could not be found.');
  if (ev.status === 'reviewed') throw conflict('invalid_state', 'This evidence has already been reviewed.', { reason: 'evidence_reviewed' });
  if (ev.status === 'needs_revision') throw conflict('invalid_state', 'Waiting for the learner to revise this evidence.', { reason: 'evidence_awaiting_revision' });
  const outcome = input.outcome ?? 'approved';
  const fb = await createRow<FeedbackEntryRow>(TABLES.feedbackEntries, { evidenceId, relationId: rel.$id, authorId, body: input.body, nextStep: input.nextStep ?? '', outcome });
  await updateRow(TABLES.evidenceItems, evidenceId, { status: outcome === 'approved' ? 'reviewed' : 'needs_revision', reviewedAt: fb.createdAt });
  let taskDelta = { tasksDone: 0, openTasks: 0 };
  if (ev.taskId && outcome === 'approved') {
    const task = await getRow<LearningTaskRow>(TABLES.learningTasks, ev.taskId);
    if (task && task.status !== 'done' && task.status !== 'dropped') {
      const next = input.markTaskDone ? 'done' : 'reviewed';
      await updateRow(TABLES.learningTasks, ev.taskId, { status: next });
      taskDelta = taskDeltas(task.status, next);
    }
  }
  await bumpColumn(TABLES.learningRelations, rel.$id, 'openTasks', taskDelta.openTasks);
  await updateRow(TABLES.learningRelations, rel.$id, { lastActivityAt: fb.createdAt });
  await appendMessage({ conversationId: rel.conversationId, senderId: authorId, type: 'feedback_added', payload: { type: 'feedback_added', feedbackId: fb.$id, evidenceId, excerpt: input.body.slice(0, 140) }, requestId });
  await emitEvent({ eventType: outcome === 'approved' ? 'feedback.added' : 'evidence.revision_requested', aggregateType: 'learning_relation', aggregateId: rel.$id, actorId: authorId, payload: { feedbackId: fb.$id, evidenceId, outcome }, requestId });
  await notify(outcome === 'approved'
    ? { userId: ev.authorId, type: 'feedback.added', title: 'You received feedback', body: input.body.slice(0, 140), href: `/relations/${rel.$id}/evidence/${evidenceId}`, refType: 'feedback_entry', refId: fb.$id, actorId: authorId, dedupeKey: `feedback.added:${fb.$id}` }
    : { userId: ev.authorId, type: 'evidence.revision_requested', title: 'Your teacher asked for a revision', body: input.body.slice(0, 140), href: `/relations/${rel.$id}/evidence/${evidenceId}`, refType: 'feedback_entry', refId: fb.$id, actorId: authorId, dedupeKey: `evidence.revision_requested:${fb.$id}` });
  await applyProofEvent(rel.$id, { feedbackReceived: 1, tasksDone: taskDelta.tasksDone }, { recentChange: `Feedback on "${ev.title}"`, ...(await nextStepDisplay(rel.$id)) });
  return toFeedback(fb);
}

/** Deterministic snapshot id: resubmitting the same version twice cannot create two history rows. */
const revisionRowId = (evidenceId: string, version: number) => createHash('sha256').update(`evidence-rev:${evidenceId}:${version}`).digest('hex').slice(0, 32);

/** Learner resubmits evidence the teacher sent back. The previous version is kept in evidence_revisions. */
export async function reviseEvidence(rel: LearningRelationRow, evidenceId: string, authorId: string, input: { title?: string; body?: string; attachmentFileIds?: string[] }, requestId?: string): Promise<EvidenceItem> {
  assertRelationWritable(rel);
  const ev = await getRow<EvidenceItemRow>(TABLES.evidenceItems, evidenceId);
  if (!ev || ev.relationId !== rel.$id) throw notFound('not_found', 'This evidence could not be found.');
  if (ev.authorId !== authorId) throw forbidden('Only the learner who submitted this evidence can revise it.');
  if (ev.status !== 'needs_revision') throw conflict('invalid_state', 'This evidence is not waiting for a revision.', { reason: 'evidence_not_revisable' });
  const attachmentFileIds = input.attachmentFileIds !== undefined
    ? await assertEvidenceAttachments(authorId, rel.$id, input.attachmentFileIds.filter((id) => !(ev.attachmentFileIds ?? []).includes(id)))
        .then((fresh) => [...input.attachmentFileIds!.filter((id) => (ev.attachmentFileIds ?? []).includes(id)), ...fresh])
    : ev.attachmentFileIds ?? [];
  try {
    await createRow<EvidenceRevisionRow>(TABLES.evidenceRevisions, {
      evidenceId, relationId: rel.$id, authorId, version: ev.version, title: ev.title, body: ev.body ?? '', attachmentFileIds: ev.attachmentFileIds ?? [],
    }, revisionRowId(evidenceId, ev.version));
  } catch (err) {
    if (!isConflict(err)) throw err;
  }
  const row = await updateRow<EvidenceItemRow>(TABLES.evidenceItems, evidenceId, {
    title: input.title ?? ev.title, body: input.body ?? ev.body ?? '', attachmentFileIds, status: 'revised', version: ev.version + 1, reviewedAt: null,
  });
  const now = new Date().toISOString();
  await updateRow(TABLES.learningRelations, rel.$id, { lastActivityAt: now });
  await appendMessage({ conversationId: rel.conversationId, senderId: authorId, type: 'evidence_submitted', payload: { type: 'evidence_submitted', evidenceId, title: row.title, taskId: row.taskId }, requestId });
  await emitEvent({ eventType: 'evidence.revised', aggregateType: 'learning_relation', aggregateId: rel.$id, actorId: authorId, payload: { evidenceId, version: row.version }, requestId });
  await notify({ userId: rel.teacherId, type: 'evidence.revised', title: 'Revised evidence to review', body: row.title, href: `/relations/${rel.$id}/evidence/${evidenceId}`, refType: 'evidence_item', refId: evidenceId, actorId: authorId, dedupeKey: `evidence.revised:${evidenceId}:${row.version}` });
  await applyProofEvent(rel.$id, { revisions: 1 }, { recentChange: `Submitted "${row.title}"` });
  return getEvidence(rel.$id, evidenceId);
}

export { getProof, recomputeProof } from './proof-projection';
