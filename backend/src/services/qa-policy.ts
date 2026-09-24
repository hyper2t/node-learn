import { QA_AUTO_CLOSE_DAYS, QA_TOPICS, type AgeBand, type PersonRef, type QaQuestionStatus, type QaTopicSlug, type Role } from '../contracts/api';

/**
 * Pure Q&A rules (no I/O) so they are unit-testable and shared by the service and the
 * `permissions` block returned to clients.
 */

export const QA_DAILY_QUESTION_LIMIT = 5;
export const QA_DAILY_ANSWER_LIMIT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type QaQuestionFacts = { authorId: string; status: string; answerCount: number; removedAt: string | null };
export type QaAnswerFacts = { authorId: string; kind: string; removedAt: string | null; hasClarification: boolean };
export type QaViewer = { userId: string; roles: Role[]; blockedWithAuthor: boolean };

export const isLive = (q: { removedAt: string | null }) => !q.removedAt;
export const isClosed = (q: { status: string }) => q.status === 'closed';

/** Only teachers answer; never your own question; never across a block; never once closed. */
export function canAnswer(q: QaQuestionFacts, v: QaViewer, alreadyAnswered: boolean): boolean {
  return isLive(q) && !isClosed(q) && v.roles.includes('teacher') && q.authorId !== v.userId && !v.blockedWithAuthor && !alreadyAnswered;
}

/** Asker may edit only while nobody has answered yet (answers must not lose their context). */
export function canEditQuestion(q: QaQuestionFacts, v: QaViewer): boolean {
  return isLive(q) && q.authorId === v.userId && q.status === 'open' && q.answerCount === 0;
}

export function canCloseQuestion(q: QaQuestionFacts, v: QaViewer): boolean {
  return isLive(q) && q.authorId === v.userId && !isClosed(q);
}

export function canAccept(q: QaQuestionFacts, a: QaAnswerFacts, v: QaViewer): boolean {
  return isLive(q) && q.authorId === v.userId && a.kind === 'answer' && !a.removedAt;
}

/** One follow-up per answer, by the asker, while the question is still open/answered. */
export function canClarify(q: QaQuestionFacts, a: QaAnswerFacts, v: QaViewer): boolean {
  return isLive(q) && !isClosed(q) && q.authorId === v.userId && a.kind === 'answer' && !a.removedAt && !a.hasClarification && !v.blockedWithAuthor;
}

export function canEditAnswer(q: QaQuestionFacts, a: QaAnswerFacts, v: QaViewer): boolean {
  return isLive(q) && !isClosed(q) && a.authorId === v.userId && !a.removedAt;
}

export function statusAfterAnswer(current: string): QaQuestionStatus {
  return current === 'closed' ? 'closed' : 'answered';
}

export function closesAt(lastActivityAt: string, status: string): string | null {
  if (status === 'closed') return null;
  return new Date(new Date(lastActivityAt).getTime() + QA_AUTO_CLOSE_DAYS * DAY_MS).toISOString();
}

export function autoCloseCutoff(now: Date): string {
  return new Date(now.getTime() - QA_AUTO_CLOSE_DAYS * DAY_MS).toISOString();
}

export function sinceOneDay(now: Date): string {
  return new Date(now.getTime() - DAY_MS).toISOString();
}

const norm = (s: string) => s.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

/** Map free-form teacher subjects onto catalogue topics (label or slug, case/punctuation-insensitive). */
export function topicsForSubjects(subjects: string[]): QaTopicSlug[] {
  const wanted = new Set(subjects.map(norm));
  return QA_TOPICS.filter((t) => wanted.has(norm(t.label)) || wanted.has(norm(t.slug))).map((t) => t.slug);
}

export const ANONYMOUS_STUDENT: PersonRef = { userId: 'anonymous', displayName: 'A student', handle: null, avatarFileId: null };

/** Minors never expose name, handle or avatar in Q&A. */
export function publicAuthor(ref: PersonRef, ageBand: AgeBand | string | null): PersonRef {
  return ageBand === 'under_16' || ageBand === '16_17' ? ANONYMOUS_STUDENT : ref;
}

export function excerpt(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
