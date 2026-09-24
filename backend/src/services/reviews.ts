import { Query } from 'node-appwrite';
import { REVIEW_EDITABLE_DAYS, type RelationReviewState, type TeacherReview, type TeacherReviewPage, type UpsertReviewInput } from '../contracts/api';
import { createRow, deleteRow, findOne, getRow, listRows, updateRow } from '../db/repo';
import { isConflict, type ProfileRow, type ReportRow, type TeacherProfileRow, type TeacherReviewRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, forbidden, notFound } from '../errors';
import { ratingSignals } from '../mappers/profile';
import { emitEvent } from './events';
import { requireRelationMember } from './learning';
import { notify } from './notifications';
import { personRefs } from './profiles';
import { excerpt } from './qa-policy';
import { canWriteReview, cleanTags, reviewEligibleFrom, toTeacherReview } from './review-policy';

const DAY_MS = 24 * 3_600_000;
const isMinorBand = (b: string | null | undefined) => b === 'under_16' || b === '16_17';

/** Recompute the teacher's counters from source rows (bounded; exact rather than incremental). */
export async function recomputeTeacherRating(teacherId: string): Promise<void> {
  const rows = await listRows<TeacherReviewRow>(TABLES.teacherReviews, [Query.equal('teacherId', teacherId), Query.isNull('removedAt'), Query.select(['rating']), Query.limit(5000)]);
  const tp = await findOne<TeacherProfileRow>(TABLES.teacherProfiles, [Query.equal('userId', teacherId)]);
  if (tp) await updateRow(TABLES.teacherProfiles, tp.$id, { reviewCount: rows.length, ratingSum: rows.reduce((n, r) => n + r.rating, 0) });
}

async function withAuthors(rows: TeacherReviewRow[], viewerId: string): Promise<TeacherReview[]> {
  const refs = await personRefs(rows.map((r) => r.studentId));
  return rows.map((r) => toTeacherReview(r, refs.get(r.studentId), viewerId === r.teacherId || viewerId === r.studentId));
}

export async function getRelationReview(relationId: string, viewerId: string): Promise<RelationReviewState> {
  const rel = await requireRelationMember(relationId, viewerId);
  const row = await getRow<TeacherReviewRow>(TABLES.teacherReviews, relationId);
  const visible = row && !row.removedAt ? row : null;
  const isStudent = rel.studentId === viewerId;
  return {
    review: visible ? (await withAuthors([visible], viewerId))[0]! : null,
    canWrite: isStudent && canWriteReview(rel, row, Date.now()),
    eligibleFrom: isStudent ? reviewEligibleFrom(rel) : null,
  };
}

export async function upsertReview(relationId: string, studentId: string, input: UpsertReviewInput, requestId: string): Promise<RelationReviewState> {
  const rel = await requireRelationMember(relationId, studentId);
  if (rel.studentId !== studentId) throw forbidden('Only the learner can review this teacher.');
  const existing = await getRow<TeacherReviewRow>(TABLES.teacherReviews, relationId);
  if (!canWriteReview(rel, existing, Date.now())) {
    throw conflict('invalid_state', existing ? 'This review can no longer be edited.' : 'You can review this teacher after 30 days together or when the relation ends.');
  }
  const data = { rating: input.rating, body: input.body ?? '', tags: cleanTags(input.tags), anonymous: input.anonymous ?? false };
  let created = false;
  if (existing) {
    await updateRow(TABLES.teacherReviews, relationId, data);
  } else {
    const profile = await getRow<ProfileRow>(TABLES.profiles, studentId);
    try {
      await createRow<TeacherReviewRow>(TABLES.teacherReviews, {
        ...data, relationId, teacherId: rel.teacherId, studentId, studentIsMinor: isMinorBand(profile?.ageBand),
        reply: null, replyAt: null, editableUntil: new Date(Date.now() + REVIEW_EDITABLE_DAYS * DAY_MS).toISOString(), removedAt: null, removedBy: null,
      }, relationId);
      created = true;
    } catch (err) {
      if (!isConflict(err)) throw err;
      await updateRow(TABLES.teacherReviews, relationId, data); // double-submit race
    }
  }
  await recomputeTeacherRating(rel.teacherId);
  if (created) {
    await notify({
      userId: rel.teacherId, type: 'review.received', title: 'You received a review', body: `${input.rating}/5`, href: `/teachers/${rel.teacherId}`,
      refType: 'teacher_review', refId: relationId, actorId: data.anonymous ? null : studentId, dedupeKey: `review.received:${relationId}`,
    });
  }
  await emitEvent({ eventType: created ? 'review.created' : 'review.updated', aggregateType: 'teacher_review', aggregateId: relationId, actorId: studentId, payload: { rating: input.rating }, requestId });
  return getRelationReview(relationId, studentId);
}

export async function replyToReview(reviewId: string, teacherId: string, reply: string, requestId: string): Promise<TeacherReview> {
  const row = await getRow<TeacherReviewRow>(TABLES.teacherReviews, reviewId);
  if (!row || row.removedAt) throw notFound('not_found', 'This review could not be found.');
  if (row.teacherId !== teacherId) throw forbidden('Only the reviewed teacher can reply.');
  const first = !row.reply && !!reply;
  const updated = await updateRow<TeacherReviewRow>(TABLES.teacherReviews, reviewId, { reply, replyAt: reply ? new Date().toISOString() : null });
  if (first) {
    await notify({
      userId: row.studentId, type: 'review.replied', title: 'Your teacher replied to your review', body: excerpt(reply, 120), href: `/relations/${row.relationId}`,
      refType: 'teacher_review', refId: reviewId, actorId: teacherId, dedupeKey: `review.replied:${reviewId}`,
    });
  }
  await emitEvent({ eventType: 'review.replied', aggregateType: 'teacher_review', aggregateId: reviewId, actorId: teacherId, payload: {}, requestId });
  return (await withAuthors([updated], teacherId))[0]!;
}

export async function listTeacherReviews(teacherId: string, viewerId: string, p: { limit: number; cursor?: string }): Promise<TeacherReviewPage> {
  const q = [Query.equal('teacherId', teacherId), Query.isNull('removedAt'), Query.orderDesc('createdAt'), Query.limit(p.limit + 1)];
  if (p.cursor) q.push(Query.cursorAfter(p.cursor));
  const [fetched, tp] = await Promise.all([
    listRows<TeacherReviewRow>(TABLES.teacherReviews, q),
    findOne<TeacherProfileRow>(TABLES.teacherProfiles, [Query.equal('userId', teacherId)]),
  ]);
  const rows = fetched.slice(0, p.limit);
  const s = ratingSignals(tp?.reviewCount ?? 0, tp?.ratingSum ?? 0);
  return { items: await withAuthors(rows, viewerId), nextCursor: fetched.length > p.limit ? rows[rows.length - 1]!.$id : null, summary: { count: s.reviewCount, avgRating: s.avgRating } };
}

export async function reportReview(reporterId: string, reviewId: string, input: { reason: string; details?: string }): Promise<{ reported: true }> {
  const row = await getRow<TeacherReviewRow>(TABLES.teacherReviews, reviewId);
  if (!row || row.removedAt) throw notFound('not_found', 'This review could not be found.');
  if (row.studentId === reporterId) throw conflict('invalid_state', 'You cannot report your own review.');
  await createRow<ReportRow>(TABLES.reports, {
    reporterId, targetUserId: row.studentId, reason: input.reason, details: input.details ?? '', status: 'open', targetType: 'teacher_review', targetId: reviewId,
  });
  return { reported: true };
}

/** Admin removal from report resolution. Idempotent. */
export async function removeReview(reviewId: string, adminId: string): Promise<void> {
  const row = await getRow<TeacherReviewRow>(TABLES.teacherReviews, reviewId);
  if (!row || row.removedAt) return;
  await updateRow(TABLES.teacherReviews, reviewId, { removedAt: new Date().toISOString(), removedBy: adminId });
  await recomputeTeacherRating(row.teacherId);
}

export async function reviewContext(id: string): Promise<{ excerpt: string | null; href: string | null }> {
  const row = await getRow<TeacherReviewRow>(TABLES.teacherReviews, id);
  if (!row) return { excerpt: null, href: null };
  return { excerpt: excerpt(`${row.rating}/5 — ${row.body ?? ''}`), href: row.removedAt ? null : `/teachers/${row.teacherId}` };
}

/** Account deletion: drop the member's authored reviews and fix the affected teachers' counters. */
export async function purgeAuthoredReviews(studentId: string): Promise<number> {
  const rows = await listRows<TeacherReviewRow>(TABLES.teacherReviews, [Query.equal('studentId', studentId), Query.limit(5000)]);
  for (const r of rows) await deleteRow(TABLES.teacherReviews, r.$id);
  for (const t of new Set(rows.map((r) => r.teacherId))) await recomputeTeacherRating(t);
  return rows.length;
}

export async function reviewsForExport(userId: string): Promise<{ written: TeacherReviewRow[]; received: TeacherReviewRow[] }> {
  const [written, received] = await Promise.all([
    listRows<TeacherReviewRow>(TABLES.teacherReviews, [Query.equal('studentId', userId), Query.limit(5000)]),
    listRows<TeacherReviewRow>(TABLES.teacherReviews, [Query.equal('teacherId', userId), Query.limit(5000)]),
  ]);
  return { written, received };
}
