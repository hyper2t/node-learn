import { Query } from 'node-appwrite';
import type { RelationSummary } from '../contracts/api';
import { createRow, getRow, listRows, updateRow } from '../db/repo';
import { isConflict, type EvidenceItemRow, type FeedbackEntryRow, type LearningGoalRow, type LearningRelationRow, type LearningTaskRow, type RelationSummaryRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, forbidden } from '../errors';
import { log } from '../log';
import { emitEvent } from './events';
import { requireRelationMember } from './learning';
import { appendMessage } from './messaging';
import { notify } from './notifications';
import { personRefs } from './profiles';

/** The teacher can write or edit the closing note for this long after the relation ended. */
export const CLOSING_NOTE_WINDOW_MS = 14 * 24 * 3_600_000;
const WEEK_MS = 7 * 24 * 3_600_000;

type Goals = RelationSummary['goals'];
type Counts = RelationSummary['counts'];
type Milestones = RelationSummary['milestones'];

/** Pure: turn the relation's rows into the frozen snapshot fields. */
export function buildSnapshot(goals: LearningGoalRow[], tasks: LearningTaskRow[], evidence: EvidenceItemRow[], feedbackCount: number): { goals: Goals; counts: Counts; milestones: Milestones } {
  const byCreated = [...goals].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const achieved = byCreated.filter((g) => g.status === 'achieved').sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1));
  return {
    goals: {
      achieved: achieved.map((g) => ({ id: g.$id, title: g.title, achievedAt: g.updatedAt })),
      dropped: byCreated.filter((g) => g.status === 'dropped').map((g) => ({ id: g.$id, title: g.title })),
      open: byCreated.filter((g) => g.status === 'active').map((g) => ({ id: g.$id, title: g.title })),
    },
    counts: {
      tasksDone: tasks.filter((t) => t.status === 'done').length,
      evidenceSubmitted: evidence.length,
      feedbackReceived: feedbackCount,
      revisions: evidence.reduce((n, e) => n + Math.max(0, (e.version ?? 1) - 1), 0),
    },
    milestones: achieved.map((g) => ({ id: g.$id, title: g.title, reachedAt: g.updatedAt, evidenceId: evidence.find((e) => e.goalId === g.$id)?.$id ?? null })),
  };
}

const parse = <T>(raw: string | null | undefined, fallback: T): T => { try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; } };

/**
 * Create the snapshot for an ended relation (row id = relation id, so retries and races converge on one row).
 * Returns the existing row when it was already generated.
 */
export async function ensureSummary(rel: LearningRelationRow): Promise<RelationSummaryRow> {
  const existing = await getRow<RelationSummaryRow>(TABLES.relationSummaries, rel.$id);
  if (existing) return existing;
  if (rel.status !== 'ended') throw conflict('invalid_state', 'The summary is available once the learning relation has ended.', { reason: 'relation_not_ended' });
  const [goals, tasks, evidence, feedback] = await Promise.all([
    listRows<LearningGoalRow>(TABLES.learningGoals, [Query.equal('relationId', rel.$id), Query.limit(200)]),
    listRows<LearningTaskRow>(TABLES.learningTasks, [Query.equal('relationId', rel.$id), Query.limit(500)]),
    listRows<EvidenceItemRow>(TABLES.evidenceItems, [Query.equal('relationId', rel.$id), Query.limit(500)]),
    listRows<FeedbackEntryRow>(TABLES.feedbackEntries, [Query.equal('relationId', rel.$id), Query.limit(1000)]),
  ]);
  const snap = buildSnapshot(goals, tasks, evidence, feedback.length);
  const data = {
    relationId: rel.$id, studentId: rel.studentId, teacherId: rel.teacherId, startedAt: rel.startedAt, endedAt: rel.endedAt ?? rel.updatedAt,
    endedBy: rel.endedBy ?? null, endReason: rel.endReason ?? null,
    goalsJson: JSON.stringify(snap.goals), countsJson: JSON.stringify(snap.counts), milestonesJson: JSON.stringify(snap.milestones), closingNote: null, closingNoteAt: null,
  };
  try {
    return await createRow<RelationSummaryRow>(TABLES.relationSummaries, data, rel.$id);
  } catch (err) {
    if (!isConflict(err)) throw err;
    return (await getRow<RelationSummaryRow>(TABLES.relationSummaries, rel.$id))!;
  }
}

/** Called right after a relation ends. Never fails the end itself: the page regenerates lazily if this errors. */
export async function ensureSummaryQuietly(relationId: string): Promise<void> {
  try {
    const rel = await getRow<LearningRelationRow>(TABLES.learningRelations, relationId);
    if (rel) await ensureSummary(rel);
  } catch (err) {
    log('warn', 'summary_generation_failed', { relationId, message: err instanceof Error ? err.message : String(err) });
  }
}

async function toSummary(row: RelationSummaryRow): Promise<RelationSummary> {
  const refs = await personRefs([row.studentId, row.teacherId]);
  return {
    relationId: row.relationId, student: refs.get(row.studentId)!, teacher: refs.get(row.teacherId)!,
    startedAt: row.startedAt, endedAt: row.endedAt,
    weeks: Math.max(1, Math.round((Date.parse(row.endedAt) - Date.parse(row.startedAt)) / WEEK_MS)),
    endedBy: row.endedBy, endReason: row.endReason,
    goals: parse<Goals>(row.goalsJson, { achieved: [], dropped: [], open: [] }),
    counts: parse<Counts>(row.countsJson, { tasksDone: 0, evidenceSubmitted: 0, feedbackReceived: 0, revisions: 0 }),
    milestones: parse<Milestones>(row.milestonesJson, []),
    closingNote: row.closingNote || null, closingNoteAt: row.closingNoteAt,
    closingNoteEditableUntil: new Date(Date.parse(row.endedAt) + CLOSING_NOTE_WINDOW_MS).toISOString(),
    generatedAt: row.createdAt,
  };
}

export async function getSummary(relationId: string, userId: string): Promise<RelationSummary> {
  const rel = await requireRelationMember(relationId, userId);
  return toSummary(await ensureSummary(rel));
}

export async function setClosingNote(relationId: string, userId: string, note: string, requestId?: string, now = new Date()): Promise<RelationSummary> {
  const rel = await requireRelationMember(relationId, userId);
  if (rel.teacherId !== userId) throw forbidden('Only the teacher writes the closing note.');
  const row = await ensureSummary(rel);
  if (now.getTime() > Date.parse(row.endedAt) + CLOSING_NOTE_WINDOW_MS) throw conflict('invalid_state', 'The closing note can only be written within 14 days after the relation ended.', { reason: 'closing_note_window_passed' });
  const first = !row.closingNote;
  const updated = await updateRow<RelationSummaryRow>(TABLES.relationSummaries, row.$id, { closingNote: note || null, closingNoteAt: note ? now.toISOString() : null });
  if (note) {
    await emitEvent({ eventType: 'relation.closing_note', aggregateType: 'learning_relation', aggregateId: relationId, actorId: userId, payload: { first }, requestId });
    if (first) {
      await appendMessage({ conversationId: rel.conversationId, senderId: userId, type: 'system', payload: { type: 'system', text: 'Your teacher wrote a closing note in the learning summary.' }, requestId });
      await notify({ userId: rel.studentId, type: 'relation.closing_note', title: 'Your teacher left a closing note', body: note.slice(0, 140), href: `/relations/${relationId}/summary`, refType: 'learning_relation', refId: relationId, actorId: userId, dedupeKey: `relation.closing_note:${relationId}` });
    }
  }
  return toSummary(updated);
}
