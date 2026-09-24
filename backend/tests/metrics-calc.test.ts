import { describe, expect, it } from 'vitest';
import { computeMetrics, DAY, HOUR, median, rate, weekStartOf, type MetricsInput } from '../src/services/metrics-calc';

const iso = (ms: number) => new Date(ms).toISOString();
// Wed 2026-09-23 12:00 Taipei
const NOW = Date.parse('2026-09-23T04:00:00.000Z');

function base(over: Partial<MetricsInput> = {}): MetricsInput {
  return { now: NOW, weeks: 12, users: [], roles: [], requests: [], relations: [], evidence: [], feedback: [], reviews: [], questions: [], answers: [], names: new Map(), excludedUsers: 0, ...over };
}

describe('helpers', () => {
  it('weeks start Monday 00:00 Asia/Taipei', () => expect(new Date(weekStartOf(NOW)).toISOString()).toBe('2026-09-20T16:00:00.000Z'));
  it('rate and median', () => {
    expect(rate(1, 3).pct).toBe(33.3);
    expect(rate(0, 0).pct).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('computeMetrics', () => {
  it('48h activation ignores people still inside their first 48h', () => {
    const m = computeMetrics(base({
      users: [
        { id: 'a', createdAt: iso(NOW - 10 * DAY) }, // activated
        { id: 'b', createdAt: iso(NOW - 10 * DAY) }, // never
        { id: 'c', createdAt: iso(NOW - 2 * HOUR) }, // too new, not counted
      ],
      roles: [{ userId: 'a', role: 'student', onboarded: true }, { userId: 'b', role: 'teacher', onboarded: true }],
      relations: [{ id: 'r', studentId: 'a', teacherId: 'x', status: 'active', startedAt: iso(NOW - 10 * DAY + 5 * HOUR), endedAt: null }],
    }));
    expect(m.totals.activation48h).toEqual({ num: 1, den: 2, pct: 50 });
    expect(m.totals.activationStudents.pct).toBe(100);
    expect(m.totals.activationTeachers.pct).toBe(0);
  });

  it('complete relation = 28 days + 3 evidence with feedback; feedback median; awaiting list', () => {
    const start = NOW - 40 * DAY;
    const ev = (id: string, d: number, status = 'reviewed') => ({ id, relationId: 'r1', title: id, status, submittedAt: iso(start + d * DAY), updatedAt: iso(start + d * DAY) });
    const m = computeMetrics(base({
      relations: [
        { id: 'r1', studentId: 's', teacherId: 't', status: 'active', startedAt: iso(start), endedAt: null },
        { id: 'r2', studentId: 's2', teacherId: 't', status: 'ended', startedAt: iso(start), endedAt: iso(start + 10 * DAY) },
      ],
      evidence: [ev('e1', 1), ev('e2', 5), ev('e3', 9), ev('e4', 37, 'submitted')],
      feedback: [
        { evidenceId: 'e1', createdAt: iso(start + DAY + 10 * HOUR) },
        { evidenceId: 'e2', createdAt: iso(start + 5 * DAY + 20 * HOUR) },
        { evidenceId: 'e3', createdAt: iso(start + 9 * DAY + 30 * HOUR) },
      ],
      reviews: [{ relationId: 'r2', createdAt: iso(start + 11 * DAY), removedAt: null }],
      names: new Map([['t', 'Tina'], ['s', 'Sam']]),
    }));
    expect(m.totals.completeRelations).toBe(1);
    expect(m.totals.feedbackMedianHours).toBe(20);
    expect(m.totals.retention4w).toEqual({ num: 1, den: 2, pct: 50 });
    expect(m.totals.reviewRate).toEqual({ num: 1, den: 1, pct: 100 });
    expect(m.awaiting).toEqual([expect.objectContaining({ evidenceId: 'e4', teacherName: 'Tina', studentName: 'Sam', hours: 72 })]);
    expect(m.weekly).toHaveLength(12);
    expect(m.weekly.at(-1)!.completeRelations).toBe(1);
  });

  it('Q&A: answered within 24h and Q&A → request attribution', () => {
    const q = { id: 'q1', authorId: 's', createdAt: iso(NOW - 5 * DAY), acceptedAnswerId: 'a1', removedAt: null };
    const m = computeMetrics(base({
      questions: [q, { id: 'q2', authorId: 's', createdAt: iso(NOW - 5 * DAY), acceptedAnswerId: null, removedAt: null }],
      answers: [{ id: 'a1', questionId: 'q1', authorId: 't', kind: 'answer', createdAt: iso(NOW - 5 * DAY + 3 * HOUR), removedAt: null }],
      requests: [{ studentId: 's', teacherId: 't', status: 'accepted', relationId: 'r', createdAt: iso(NOW - 4 * DAY) }],
    }));
    expect(m.qa).toEqual({ questions: 2, answered24h: { num: 1, den: 2, pct: 50 }, accepted: 1, toRequests: 1 });
    expect(m.funnel.accepted).toBe(1);
  });
});
