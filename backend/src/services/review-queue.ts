import { Query } from 'node-appwrite';
import type { ReviewQueue, ReviewQueueItem } from '../contracts/api';
import { listRows } from '../db/repo';
import type { EvidenceItemRow, LearningGoalRow, LearningRelationRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { roleRequired } from '../errors';
import { personRefs } from './profiles';

const MAX = 200;

/**
 * Everything waiting on this teacher across all active relations: evidence to review (submitted or
 * resubmitted) and goals the learner asked to confirm. Fixed query count regardless of relation count.
 */
export async function reviewQueue(actor: { user: { $id: string }; roles: string[] }): Promise<ReviewQueue> {
  if (!actor.roles.includes('teacher')) throw roleRequired('teacher');
  const rels = await listRows<LearningRelationRow>(TABLES.learningRelations, [Query.equal('teacherId', actor.user.$id), Query.equal('status', 'active'), Query.limit(MAX)]);
  if (!rels.length) return { items: [], counts: { evidence: 0, goals: 0 } };
  const ids = rels.map((r) => r.$id);
  const [evidence, goals, refs] = await Promise.all([
    listRows<EvidenceItemRow>(TABLES.evidenceItems, [Query.equal('relationId', ids), Query.equal('status', ['submitted', 'revised']), Query.limit(MAX)]),
    listRows<LearningGoalRow>(TABLES.learningGoals, [Query.equal('relationId', ids), Query.equal('status', 'active'), Query.isNotNull('completionRequestedAt'), Query.limit(MAX)]),
    personRefs(rels.map((r) => r.studentId)),
  ]);
  const studentOf = new Map(rels.map((r) => [r.$id, refs.get(r.studentId)!]));
  const items: ReviewQueueItem[] = [
    // A resubmission starts waiting again when it was revised (updatedAt), not at the original submission.
    ...evidence.map((e): ReviewQueueItem => ({ kind: 'evidence', id: e.$id, relationId: e.relationId, student: studentOf.get(e.relationId)!, title: e.title, since: e.status === 'revised' ? e.updatedAt : e.submittedAt, version: e.version ?? 1 })),
    ...goals.filter((g) => g.completionRequestedAt).map((g): ReviewQueueItem => ({ kind: 'goal', id: g.$id, relationId: g.relationId, student: studentOf.get(g.relationId)!, title: g.title, since: g.completionRequestedAt!, version: null })),
  ].filter((i) => i.student).sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : 0));
  return { items, counts: { evidence: items.filter((i) => i.kind === 'evidence').length, goals: items.filter((i) => i.kind === 'goal').length } };
}
