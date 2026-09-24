/**
 * L5: the proof record is maintained at write time.
 * - Counters move with atomic increments on the proof row (no read-modify-write).
 * - Display fields are overwritten only by the events that affect them.
 * - `recomputeProof` is the full, paginated rebuild used for backfill and hourly reconciliation.
 */
import { Query } from 'node-appwrite';
import type { ProofRecord } from '../contracts/api';
import { listAllRows } from '../db/paginate';
import { createRow, decrementColumn, getRow, incrementColumn, listRows, updateRow } from '../db/repo';
import { isConflict, type EvidenceItemRow, type FeedbackEntryRow, type LearningGoalRow, type LearningRelationRow, type LearningTaskRow, type ProofRecordRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { notFound } from '../errors';
import { log } from '../log';
import { toProof } from '../mappers/learning';

export type ProofCounter = 'tasksDone' | 'evidenceSubmitted' | 'feedbackReceived' | 'revisions';
export type ProofDelta = Partial<Record<ProofCounter, number>>;
type DisplayFields = Partial<Pick<ProofRecordRow, 'currentFocus' | 'milestonesJson' | 'recentChange' | 'nextStep'>>;

const OPEN_TASK = new Set(['open', 'submitted', 'reviewed']);
export const isOpenTask = (status: string | null | undefined) => OPEN_TASK.has(status ?? '');

/** Pure: how a task status change moves `tasksDone` and the relation's `openTasks`. */
export function taskDeltas(before: string | null, after: string): { tasksDone: number; openTasks: number } {
  return {
    tasksDone: (after === 'done' ? 1 : 0) - (before === 'done' ? 1 : 0),
    openTasks: (isOpenTask(after) ? 1 : 0) - (isOpenTask(before) ? 1 : 0),
  };
}

/** Atomic ±n on a counter column; decrements are floored at 0. */
export async function bumpColumn(table: typeof TABLES[keyof typeof TABLES], rowId: string, column: string, delta: number): Promise<void> {
  if (!delta) return;
  if (delta > 0) await incrementColumn(table, rowId, column, delta);
  else await decrementColumn(table, rowId, column, -delta, 0);
}

const EMPTY = { currentFocus: null, milestonesJson: '[]', tasksDone: 0, evidenceSubmitted: 0, feedbackReceived: 0, revisions: 0, recentChange: null, nextStep: null };

/** Make sure the proof row exists before incrementing. Legacy relations get a full rebuild instead of zeros. */
async function ensureProofRow(relationId: string): Promise<boolean> {
  if (await getRow<ProofRecordRow>(TABLES.proofRecords, relationId)) return true;
  const hasHistory = (await listRows(TABLES.evidenceItems, [Query.equal('relationId', relationId), Query.limit(1)])).length > 0
    || (await listRows(TABLES.learningTasks, [Query.equal('relationId', relationId), Query.limit(1)])).length > 0;
  if (hasHistory) { await recomputeProof(relationId); return false; } // rebuild already includes this event
  try {
    await createRow<ProofRecordRow>(TABLES.proofRecords, { relationId, ...EMPTY, computedAt: new Date().toISOString() }, relationId);
  } catch (err) {
    if (!isConflict(err)) throw err;
  }
  return true;
}

/** Apply one event: atomic counter deltas plus (optional) display-field overwrites. Never throws into the caller's flow. */
export async function applyProofEvent(relationId: string, delta: ProofDelta, display: DisplayFields = {}): Promise<void> {
  try {
    const fresh = await ensureProofRow(relationId);
    if (fresh) for (const [col, n] of Object.entries(delta)) await bumpColumn(TABLES.proofRecords, relationId, col, n ?? 0);
    await updateRow(TABLES.proofRecords, relationId, { ...display, computedAt: new Date().toISOString() });
  } catch (err) {
    // The hourly reconciliation repairs anything missed here.
    log('warn', 'proof_event_failed', { relationId, message: err instanceof Error ? err.message : String(err) });
  }
}

/** Goals changed: focus + milestones (goals ≤100 per relation, one evidence lookup). */
export async function goalDisplay(relationId: string): Promise<DisplayFields> {
  const [rel, goals] = await Promise.all([
    getRow<LearningRelationRow>(TABLES.learningRelations, relationId),
    listRows<LearningGoalRow>(TABLES.learningGoals, [Query.equal('relationId', relationId), Query.limit(100)]),
  ]);
  const achieved = goals.filter((g) => g.status === 'achieved').slice(0, 5);
  const ev = achieved.length
    ? await listRows<EvidenceItemRow>(TABLES.evidenceItems, [Query.equal('relationId', relationId), Query.equal('goalId', achieved.map((g) => g.$id)), Query.select(['$id', 'goalId']), Query.limit(100)])
    : [];
  return focusAndMilestones(rel?.currentGoalId ?? null, goals, ev);
}

function focusAndMilestones(currentGoalId: string | null, goals: LearningGoalRow[], evidence: Pick<EvidenceItemRow, '$id' | 'goalId'>[]): DisplayFields {
  const current = goals.find((g) => g.$id === currentGoalId) ?? goals.find((g) => g.status === 'active') ?? null;
  const milestones = goals.filter((g) => g.status === 'achieved').slice(0, 5)
    .map((g) => ({ id: g.$id, title: g.title, reachedAt: g.updatedAt, evidenceId: evidence.find((e) => e.goalId === g.$id)?.$id ?? null }));
  return { currentFocus: current?.title ?? null, milestonesJson: JSON.stringify(milestones) };
}

/** Next step: the latest feedback's next step, else the earliest-due open task. Two single-row queries. */
export async function nextStepDisplay(relationId: string): Promise<DisplayFields> {
  const [fb] = await listRows<FeedbackEntryRow>(TABLES.feedbackEntries, [Query.equal('relationId', relationId), Query.orderDesc('createdAt'), Query.limit(1)]);
  if (fb?.nextStep) return { nextStep: fb.nextStep };
  const [task] = await listRows<LearningTaskRow>(TABLES.learningTasks, [Query.equal('relationId', relationId), Query.equal('status', 'open'), Query.orderAsc('dueAt'), Query.limit(1)]);
  return { nextStep: task?.title ?? null };
}

// --- full rebuild -------------------------------------------------------------

export type ProofRebuild = { proof: ProofRecord; drift: string[] };

/** Full, paginated rebuild of the proof row and the relation's counters. Reports which stored values were off. */
export async function rebuildRelation(relationId: string): Promise<ProofRebuild> {
  const [rel, goals, tasks, evidence, feedback, before] = await Promise.all([
    getRow<LearningRelationRow>(TABLES.learningRelations, relationId),
    listRows<LearningGoalRow>(TABLES.learningGoals, [Query.equal('relationId', relationId), Query.limit(100)]),
    listAllRows<LearningTaskRow>(TABLES.learningTasks, [Query.equal('relationId', relationId)]),
    listAllRows<EvidenceItemRow>(TABLES.evidenceItems, [Query.equal('relationId', relationId)]),
    listAllRows<FeedbackEntryRow>(TABLES.feedbackEntries, [Query.equal('relationId', relationId)]),
    getRow<ProofRecordRow>(TABLES.proofRecords, relationId),
  ]);
  if (!rel) throw notFound('not_found', 'This learning relation could not be found.');
  const latestFb = [...feedback].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  const latestEv = [...evidence].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];
  const nextOpen = tasks.filter((t) => t.status === 'open').sort((a, b) => ((a.dueAt ?? '9') < (b.dueAt ?? '9') ? -1 : 1))[0];
  const counts = {
    tasksDone: tasks.filter((t) => t.status === 'done').length,
    evidenceSubmitted: evidence.length,
    feedbackReceived: feedback.length,
    revisions: evidence.reduce((n, e) => n + Math.max(0, (e.version ?? 1) - 1), 0),
  };
  const data = {
    relationId, ...counts, ...focusAndMilestones(rel.currentGoalId, goals, evidence),
    recentChange: latestFb ? `Feedback on "${evidence.find((e) => e.$id === latestFb.evidenceId)?.title ?? 'evidence'}"` : latestEv ? `Submitted "${latestEv.title}"` : null,
    nextStep: latestFb?.nextStep || nextOpen?.title || null,
    computedAt: new Date().toISOString(),
  };
  const drift: string[] = [];
  if (before) for (const k of Object.keys(counts) as ProofCounter[]) if (before[k] !== counts[k]) drift.push(`proof.${k}`);
  const openTasks = tasks.filter((t) => isOpenTask(t.status)).length;
  const relFix: Record<string, number> = {};
  if (rel.openTasks !== openTasks) { relFix.openTasks = openTasks; drift.push('relation.openTasks'); }
  if (rel.evidenceCount !== evidence.length) { relFix.evidenceCount = evidence.length; drift.push('relation.evidenceCount'); }
  if (Object.keys(relFix).length) await updateRow(TABLES.learningRelations, relationId, relFix);

  let row: ProofRecordRow;
  if (before) row = await updateRow<ProofRecordRow>(TABLES.proofRecords, relationId, data);
  else {
    try {
      row = await createRow<ProofRecordRow>(TABLES.proofRecords, data, relationId);
    } catch (err) {
      if (!isConflict(err)) throw err;
      row = await updateRow<ProofRecordRow>(TABLES.proofRecords, relationId, data);
    }
  }
  return { proof: toProof(row), drift };
}

export async function recomputeProof(relationId: string): Promise<ProofRecord> {
  return (await rebuildRelation(relationId)).proof;
}

/** Read path: stored row; rebuild only when missing (legacy relations). */
export async function getProof(relationId: string): Promise<ProofRecord> {
  const row = await getRow<ProofRecordRow>(TABLES.proofRecords, relationId);
  return row ? toProof(row) : recomputeProof(relationId);
}

export type ReconcileStats = { scanned: number; drifted: number; failed: number };

/** Hourly: rebuild relations active in the last `windowMs`; log any drift found. */
export async function reconcileRecentProofs(now = new Date(), windowMs = 2 * 3_600_000, batch = 200): Promise<ReconcileStats> {
  const since = new Date(now.getTime() - windowMs).toISOString();
  const rels = await listRows<LearningRelationRow>(TABLES.learningRelations, [Query.greaterThan('lastActivityAt', since), Query.orderDesc('lastActivityAt'), Query.select(['$id']), Query.limit(batch)]);
  const stats: ReconcileStats = { scanned: rels.length, drifted: 0, failed: 0 };
  for (const r of rels) {
    try {
      const { drift } = await rebuildRelation(r.$id);
      if (drift.length) { stats.drifted++; log('warn', 'proof_drift', { relationId: r.$id, fields: drift }); }
    } catch (err) {
      stats.failed++;
      log('error', 'proof_reconcile_failed', { relationId: r.$id, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return stats;
}
