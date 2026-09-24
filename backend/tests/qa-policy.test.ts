import { describe, expect, it } from 'vitest';
import {
  ANONYMOUS_STUDENT, autoCloseCutoff, canAccept, canAnswer, canClarify, canCloseQuestion, canEditAnswer, canEditQuestion, closesAt,
  excerpt, publicAuthor, statusAfterAnswer, topicsForSubjects,
} from '../src/services/qa-policy';

const q = (over: Partial<{ authorId: string; status: string; answerCount: number; removedAt: string | null }> = {}) =>
  ({ authorId: 'stu', status: 'open', answerCount: 0, removedAt: null, ...over });
const a = (over: Partial<{ authorId: string; kind: string; removedAt: string | null; hasClarification: boolean }> = {}) =>
  ({ authorId: 'tea', kind: 'answer', removedAt: null, hasClarification: false, ...over });
const teacher = { userId: 'tea', roles: ['teacher' as const], blockedWithAuthor: false };
const asker = { userId: 'stu', roles: ['student' as const], blockedWithAuthor: false };
const otherStudent = { userId: 'x', roles: ['student' as const], blockedWithAuthor: false };

describe('qa policy: answering', () => {
  it('lets a teacher answer an open question once', () => {
    expect(canAnswer(q(), teacher, false)).toBe(true);
    expect(canAnswer(q(), teacher, true)).toBe(false);
  });
  it('never lets students answer', () => expect(canAnswer(q(), otherStudent, false)).toBe(false));
  it('blocks own questions, blocks, closed and removed', () => {
    expect(canAnswer(q({ authorId: 'tea' }), teacher, false)).toBe(false);
    expect(canAnswer(q(), { ...teacher, blockedWithAuthor: true }, false)).toBe(false);
    expect(canAnswer(q({ status: 'closed' }), teacher, false)).toBe(false);
    expect(canAnswer(q({ removedAt: '2026-01-01T00:00:00Z' }), teacher, false)).toBe(false);
  });
});

describe('qa policy: asker actions', () => {
  it('edits only before the first answer', () => {
    expect(canEditQuestion(q(), asker)).toBe(true);
    expect(canEditQuestion(q({ answerCount: 1, status: 'answered' }), asker)).toBe(false);
    expect(canEditQuestion(q(), otherStudent)).toBe(false);
  });
  it('closes own non-closed questions', () => {
    expect(canCloseQuestion(q({ status: 'answered' }), asker)).toBe(true);
    expect(canCloseQuestion(q({ status: 'closed' }), asker)).toBe(false);
    expect(canCloseQuestion(q(), teacher)).toBe(false);
  });
  it('accepts answers but not clarifications', () => {
    expect(canAccept(q(), a(), asker)).toBe(true);
    expect(canAccept(q(), a({ kind: 'clarification' }), asker)).toBe(false);
    expect(canAccept(q(), a(), otherStudent)).toBe(false);
  });
  it('clarifies once per answer, not after close or across a block', () => {
    expect(canClarify(q({ status: 'answered' }), a(), asker)).toBe(true);
    expect(canClarify(q({ status: 'answered' }), a({ hasClarification: true }), asker)).toBe(false);
    expect(canClarify(q({ status: 'closed' }), a(), asker)).toBe(false);
    expect(canClarify(q(), a(), { ...asker, blockedWithAuthor: true })).toBe(false);
    expect(canClarify(q(), a(), otherStudent)).toBe(false);
  });
  it('lets answer authors edit until the question closes', () => {
    expect(canEditAnswer(q({ status: 'answered' }), a(), teacher)).toBe(true);
    expect(canEditAnswer(q({ status: 'closed' }), a(), teacher)).toBe(false);
  });
});

describe('qa policy: lifecycle and helpers', () => {
  it('moves to answered unless closed', () => {
    expect(statusAfterAnswer('open')).toBe('answered');
    expect(statusAfterAnswer('closed')).toBe('closed');
  });
  it('computes auto-close at 14 days', () => {
    expect(closesAt('2026-09-01T00:00:00.000Z', 'open')).toBe('2026-09-15T00:00:00.000Z');
    expect(closesAt('2026-09-01T00:00:00.000Z', 'closed')).toBeNull();
    expect(autoCloseCutoff(new Date('2026-09-15T00:00:00.000Z'))).toBe('2026-09-01T00:00:00.000Z');
  });
  it('maps free-form subjects to topics', () => {
    expect(topicsForSubjects(['programming', ' MATH ', 'Art and Design', 'exam-prep', 'Basket weaving'])).toEqual(['programming', 'math', 'art-design', 'exam-prep']);
  });
  it('hides minors', () => {
    const ref = { userId: 'u', displayName: 'Sam', handle: 'sam', avatarFileId: 'f' };
    expect(publicAuthor(ref, 'under_16')).toEqual(ANONYMOUS_STUDENT);
    expect(publicAuthor(ref, '16_17')).toEqual(ANONYMOUS_STUDENT);
    expect(publicAuthor(ref, '18_plus')).toBe(ref);
  });
  it('builds flat excerpts', () => {
    expect(excerpt('a\n\n b', 10)).toBe('a b');
    expect(excerpt('x'.repeat(20), 10)).toHaveLength(10);
  });
});
