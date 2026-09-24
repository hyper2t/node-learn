import { describe, expect, it } from 'vitest';
import type { TeacherReviewRow } from '../src/db/rows';
import { ratingSignals } from '../src/mappers/profile';
import { canWriteReview, cleanTags, reviewEligibleFrom, toTeacherReview } from '../src/services/review-policy';

const DAY = 86_400_000;
const start = '2026-01-01T00:00:00.000Z';
const t0 = Date.parse(start);

const row = (over: Partial<TeacherReviewRow> = {}): TeacherReviewRow => ({
  $id: 'r1', $createdAt: start, $updatedAt: start, $permissions: [], $sequence: 1, $tableId: 't', $databaseId: 'd',
  createdAt: start, updatedAt: start, relationId: 'r1', teacherId: 'T', studentId: 'S', rating: 4, body: 'Great', tags: ['clear', 'bogus', 'clear'],
  anonymous: false, studentIsMinor: false, reply: null, replyAt: null, editableUntil: new Date(t0 + 30 * DAY).toISOString(), removedAt: null, removedBy: null,
  ...over,
} as TeacherReviewRow);
const ref = { userId: 'S', displayName: 'Sam', handle: 'sam', avatarFileId: null };

describe('review eligibility', () => {
  it('active relations unlock after 30 days', () => {
    const rel = { status: 'active', startedAt: start, endedAt: null };
    expect(canWriteReview(rel, null, t0 + 29 * DAY)).toBe(false);
    expect(canWriteReview(rel, null, t0 + 30 * DAY)).toBe(true);
  });
  it('ended relations unlock immediately; pending never', () => {
    expect(canWriteReview({ status: 'ended', startedAt: start, endedAt: new Date(t0 + DAY).toISOString() }, null, t0 + 2 * DAY)).toBe(true);
    expect(reviewEligibleFrom({ status: 'pending', startedAt: start, endedAt: null })).toBeNull();
  });
  it('edits close after the window and on removal', () => {
    const rel = { status: 'ended', startedAt: start, endedAt: start };
    expect(canWriteReview(rel, row(), t0 + 29 * DAY)).toBe(true);
    expect(canWriteReview(rel, row(), t0 + 31 * DAY)).toBe(false);
    expect(canWriteReview(rel, row({ removedAt: start }), t0)).toBe(false);
  });
});

describe('toTeacherReview', () => {
  it('dedupes and filters tags', () => expect(cleanTags(['clear', 'bogus', 'clear'])).toEqual(['clear']));
  it('public view hides anonymous authors but keeps text', () => {
    const r = toTeacherReview(row({ anonymous: true }), ref, false);
    expect(r.author.displayName).toBe('A student');
    expect(r.body).toBe('Great');
  });
  it('public view hides minors name and text; teacher sees both', () => {
    expect(toTeacherReview(row({ studentIsMinor: true }), ref, false)).toMatchObject({ body: null, author: { userId: 'anonymous' } });
    expect(toTeacherReview(row({ studentIsMinor: true }), ref, true)).toMatchObject({ body: 'Great', author: { userId: 'S' } });
  });
});

describe('ratingSignals', () => {
  it('hides average below 3 reviews', () => expect(ratingSignals(2, 10).avgRating).toBeNull());
  it('rounds to one decimal', () => expect(ratingSignals(3, 13).avgRating).toBe(4.3));
});
