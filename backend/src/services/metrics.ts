import { Query } from 'node-appwrite';
import type { AdminMetrics } from '../contracts/api';
import { listAllRows } from '../db/paginate';
import type { EvidenceItemRow, FeedbackEntryRow, LearningRelationRow, LearningRequestRow, ProfileRow, QaAnswerRow, QaQuestionRow, RoleMembershipRow, TeacherReviewRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { log } from '../log';
import { computeMetrics } from './metrics-calc';

/** Optional regex over emails, e.g. `@example\.com$|\+test@`. Matching accounts and all their activity are excluded. */
function excludePattern(): RegExp | null {
  const raw = process.env.METRICS_EXCLUDE_EMAILS?.trim();
  if (!raw) return null;
  try { return new RegExp(raw, 'i'); } catch { log('warn', 'metrics_bad_exclude_pattern', {}); return null; }
}

export async function loadMetrics(weeks = 12, now = Date.now()): Promise<AdminMetrics> {
  const [profiles, roles, requests, relations, evidence, feedback, reviews, questions, answers] = await Promise.all([
    listAllRows<ProfileRow>(TABLES.profiles, [Query.select(['$id', 'email', 'displayName', 'status', 'createdAt'])]),
    listAllRows<RoleMembershipRow>(TABLES.roleMemberships, [Query.select(['$id', 'userId', 'role', 'onboarded'])]),
    listAllRows<LearningRequestRow>(TABLES.learningRequests, [Query.select(['$id', 'studentId', 'teacherId', 'status', 'relationId', 'createdAt'])]),
    listAllRows<LearningRelationRow>(TABLES.learningRelations, [Query.select(['$id', 'studentId', 'teacherId', 'status', 'startedAt', 'endedAt', 'pausedAt'])]),
    listAllRows<EvidenceItemRow>(TABLES.evidenceItems, [Query.select(['$id', 'relationId', 'title', 'status', 'submittedAt', 'updatedAt'])]),
    listAllRows<FeedbackEntryRow>(TABLES.feedbackEntries, [Query.select(['$id', 'evidenceId', 'createdAt'])]),
    listAllRows<TeacherReviewRow>(TABLES.teacherReviews, [Query.select(['$id', 'relationId', 'createdAt', 'removedAt'])]),
    listAllRows<QaQuestionRow>(TABLES.qaQuestions, [Query.select(['$id', 'authorId', 'createdAt', 'acceptedAnswerId', 'removedAt'])]),
    listAllRows<QaAnswerRow>(TABLES.qaAnswers, [Query.select(['$id', 'questionId', 'authorId', 'kind', 'createdAt', 'removedAt'])]),
  ]);
  const pattern = excludePattern();
  const excluded = new Set(profiles.filter((p) => (pattern && pattern.test(p.email ?? '')) || p.status === 'deleted').map((p) => p.$id));
  const keep = (...ids: string[]) => ids.every((id) => !excluded.has(id));
  const rels = relations.filter((r) => keep(r.studentId, r.teacherId));
  const relIds = new Set(rels.map((r) => r.$id));
  const evs = evidence.filter((e) => relIds.has(e.relationId));
  const evIds = new Set(evs.map((e) => e.$id));
  const qs = questions.filter((q) => keep(q.authorId));
  return computeMetrics({
    now, weeks,
    users: profiles.filter((p) => !excluded.has(p.$id)).map((p) => ({ id: p.$id, createdAt: p.createdAt })),
    roles: roles.filter((r) => keep(r.userId)).map((r) => ({ userId: r.userId, role: r.role, onboarded: r.onboarded })),
    requests: requests.filter((r) => keep(r.studentId, r.teacherId)).map((r) => ({ studentId: r.studentId, teacherId: r.teacherId, status: r.status, relationId: r.relationId, createdAt: r.createdAt })),
    relations: rels.map((r) => ({ id: r.$id, studentId: r.studentId, teacherId: r.teacherId, status: r.status, startedAt: r.startedAt, endedAt: r.endedAt, pausedAt: r.pausedAt ?? null })),
    evidence: evs.map((e) => ({ id: e.$id, relationId: e.relationId, title: e.title, status: e.status, submittedAt: e.submittedAt, updatedAt: e.updatedAt })),
    feedback: feedback.filter((f) => evIds.has(f.evidenceId)).map((f) => ({ evidenceId: f.evidenceId, createdAt: f.createdAt })),
    reviews: reviews.filter((r) => relIds.has(r.relationId)).map((r) => ({ relationId: r.relationId, createdAt: r.createdAt, removedAt: r.removedAt })),
    questions: qs.map((q) => ({ id: q.$id, authorId: q.authorId, createdAt: q.createdAt, acceptedAnswerId: q.acceptedAnswerId, removedAt: q.removedAt })),
    answers: answers.filter((a) => keep(a.authorId)).map((a) => ({ id: a.$id, questionId: a.questionId, authorId: a.authorId, kind: a.kind, createdAt: a.createdAt, removedAt: a.removedAt })),
    names: new Map(profiles.map((p) => [p.$id, p.displayName])),
    excludedUsers: excluded.size,
  });
}
