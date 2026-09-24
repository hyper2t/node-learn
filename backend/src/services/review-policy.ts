import { REVIEW_ELIGIBLE_AFTER_DAYS, REVIEW_TAGS, type ReviewTag, type TeacherReview } from '../contracts/api';
import type { LearningRelationRow, TeacherReviewRow } from '../db/rows';
import type { PersonRef } from '../mappers/profile';
import { ANONYMOUS_STUDENT } from './qa-policy';

const DAY_MS = 24 * 3_600_000;

/** When the learner may first review: at the end of the relation, or after 30 days of it running. */
export function reviewEligibleFrom(rel: Pick<LearningRelationRow, 'status' | 'startedAt' | 'endedAt'>): string | null {
  if (rel.status === 'ended') return rel.endedAt ?? rel.startedAt;
  if (rel.status !== 'active' && rel.status !== 'paused') return null;
  const byTime = new Date(Date.parse(rel.startedAt) + REVIEW_ELIGIBLE_AFTER_DAYS * DAY_MS).toISOString();
  return byTime;
}

/** Pure: may this learner create/edit the review right now? */
export function canWriteReview(rel: Pick<LearningRelationRow, 'status' | 'startedAt' | 'endedAt'>, existing: Pick<TeacherReviewRow, 'editableUntil' | 'removedAt'> | null, nowMs: number): boolean {
  if (existing) return !existing.removedAt && Date.parse(existing.editableUntil) > nowMs;
  const from = reviewEligibleFrom(rel);
  return from !== null && Date.parse(from) <= nowMs;
}

export function cleanTags(tags: string[] | null | undefined): ReviewTag[] {
  return [...new Set((tags ?? []).filter((t): t is ReviewTag => (REVIEW_TAGS as readonly string[]).includes(t)))];
}

/**
 * Pure mapper. `privileged` = the viewer is the reviewed teacher or the author: they see the
 * real author and full text. Everyone else: anonymous/minor authors become "A student",
 * and minors' text is withheld.
 */
export function toTeacherReview(row: TeacherReviewRow, author: PersonRef | undefined, privileged: boolean): TeacherReview {
  const hideName = !privileged && (row.anonymous || row.studentIsMinor);
  return {
    id: row.$id, relationId: row.relationId, teacherId: row.teacherId,
    author: hideName || !author ? ANONYMOUS_STUDENT : author,
    rating: row.rating,
    body: !privileged && row.studentIsMinor ? null : row.body || null,
    tags: cleanTags(row.tags), anonymous: row.anonymous,
    reply: row.reply || null, replyAt: row.replyAt,
    createdAt: row.createdAt, updatedAt: row.updatedAt, editableUntil: row.editableUntil,
  };
}
