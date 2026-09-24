import { createHash } from 'node:crypto';
import type { Models } from 'node-appwrite';
import type {
  PersonRef, QaAcceptedAnswer, QaAnswer, QaQuestion, QaQuestionDetail, QaQuestionStatus, QaTopicSlug, QaTopicSummary, ReportInput, Role,
} from '../contracts/api';
import { QA_MAX_ATTACHMENTS, QA_TOPICS } from '../contracts/api';
import { createRow, decrementColumn, findOne, getRow, incrementColumn, listRows, Query, updateRow } from '../db/repo';
import { isConflict, type BlockRow, type ProfileRow, type QaAnswerRow, type QaQuestionRow, type ReportRow, type TeacherProfileRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, forbidden, HttpError, notFound, roleRequired } from '../errors';
import { emitEvent } from './events';
import { notify } from './notifications';
import { assertQaAttachments, deleteUploads, markAttached, resolveAttachments } from './uploads';
import {
  canAccept, canAnswer, canClarify, canCloseQuestion, canEditAnswer, canEditQuestion, closesAt, excerpt, publicAuthor,
  QA_DAILY_ANSWER_LIMIT, QA_DAILY_QUESTION_LIMIT, sinceOneDay, statusAfterAnswer, topicsForSubjects, type QaViewer,
} from './qa-policy';

type Actor = { user: Models.User; roles: Role[] };
type PageOut<T> = { items: T[]; nextCursor: string | null };

const hashId = (...parts: string[]) => createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
const answerRowId = (questionId: string, teacherId: string) => hashId('qa-answer', questionId, teacherId);
const clarificationRowId = (answerId: string) => hashId('qa-clarify', answerId);
const nowIso = () => new Date().toISOString();

// --- lookups -----------------------------------------------------------------

/** Everyone I blocked or who blocked me. */
export async function blockedEitherWay(userId: string): Promise<Set<string>> {
  const rows = await listRows<BlockRow>(TABLES.blocks, [Query.or([Query.equal('blockerId', userId), Query.equal('blockedId', userId)]), Query.limit(500)]);
  return new Set(rows.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)));
}

/** Author refs with the minors rule applied; missing/deleted profiles become "Former member". */
async function authors(ids: string[]): Promise<Map<string, PersonRef>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const out = new Map<string, PersonRef>();
  if (!unique.length) return out;
  const rows = await listRows<ProfileRow>(TABLES.profiles, [Query.equal('$id', unique), Query.limit(unique.length)]);
  for (const r of rows) {
    const ref: PersonRef = r.status === 'deleted'
      ? { userId: r.$id, displayName: 'Former member', handle: null, avatarFileId: null }
      : { userId: r.$id, displayName: r.displayName, handle: r.handle, avatarFileId: r.avatarFileId };
    out.set(r.$id, publicAuthor(ref, r.ageBand));
  }
  for (const id of unique) if (!out.has(id)) out.set(id, { userId: id, displayName: 'Former member', handle: null, avatarFileId: null });
  return out;
}

async function loadQuestion(id: string): Promise<QaQuestionRow> {
  const row = await getRow<QaQuestionRow>(TABLES.qaQuestions, id);
  if (!row || row.removedAt) throw notFound('not_found', 'This question could not be found.');
  return row;
}

async function loadAnswer(id: string): Promise<QaAnswerRow> {
  const row = await getRow<QaAnswerRow>(TABLES.qaAnswers, id);
  if (!row || row.removedAt || row.kind !== 'answer') throw notFound('not_found', 'This answer could not be found.');
  return row;
}

async function assertDailyLimit(table: typeof TABLES.qaQuestions | typeof TABLES.qaAnswers, authorId: string, max: number, extra: string[] = []): Promise<void> {
  const rows = await listRows<QaQuestionRow>(table, [Query.equal('authorId', authorId), Query.greaterThan('createdAt', sinceOneDay(new Date())), ...extra, Query.select(['$id']), Query.limit(max)]);
  if (rows.length >= max) throw new HttpError(429, 'rate_limited', `You can post up to ${max} of these per day. Try again tomorrow.`, { headers: { 'Retry-After': '3600' } });
}

// --- mapping -----------------------------------------------------------------

function toQuestion(r: QaQuestionRow, author: PersonRef, viewerId: string): QaQuestion {
  const status = (['open', 'answered', 'closed'].includes(r.status) ? r.status : 'open') as QaQuestionStatus;
  return {
    id: r.$id, topic: r.topic as QaTopicSlug, title: r.title, body: r.body, status, answerCount: r.answerCount ?? 0,
    acceptedAnswerId: r.acceptedAnswerId ?? null, author, isMine: r.authorId === viewerId,
    lastActivityAt: r.lastActivityAt, attachmentCount: r.attachmentFileIds?.length ?? 0, closesAt: closesAt(r.lastActivityAt, status), createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

async function toQuestions(rows: QaQuestionRow[], viewerId: string): Promise<QaQuestion[]> {
  const refs = await authors(rows.map((r) => r.authorId));
  return rows.map((r) => toQuestion(r, refs.get(r.authorId)!, viewerId));
}

async function pageQuestions(queries: string[], p: { limit: number; cursor?: string }, viewerId: string): Promise<PageOut<QaQuestion>> {
  const q = [Query.isNull('removedAt'), Query.orderDesc('lastActivityAt'), Query.limit(p.limit + 1), ...queries];
  if (p.cursor) q.push(Query.cursorAfter(p.cursor));
  const [rows, blocked] = await Promise.all([listRows<QaQuestionRow>(TABLES.qaQuestions, q), blockedEitherWay(viewerId)]);
  const hasMore = rows.length > p.limit;
  const page = hasMore ? rows.slice(0, p.limit) : rows;
  const last = page[page.length - 1];
  // Filter after slicing so the cursor still advances over hidden rows.
  return { items: await toQuestions(page.filter((r) => !blocked.has(r.authorId)), viewerId), nextCursor: hasMore && last ? last.$id : null };
}

/**
 * Validates a replacement attachment list. `commit` runs after the row is saved: new files are
 * marked attached and files dropped from the list are deleted.
 */
async function replaceAttachments(userId: string, current: string[] | null | undefined, next: string[]): Promise<{ ids: string[]; commit: () => Promise<void> }> {
  const ids = await assertQaAttachments(userId, next, QA_MAX_ATTACHMENTS);
  const dropped = (current ?? []).filter((id) => !ids.includes(id));
  return { ids, commit: async () => { await markAttached(ids); await deleteUploads(dropped); } };
}

// --- reads -------------------------------------------------------------------

export async function listTopics(): Promise<QaTopicSummary[]> {
  const rows = await listRows<QaQuestionRow>(TABLES.qaQuestions, [Query.equal('status', 'open'), Query.isNull('removedAt'), Query.select(['topic']), Query.limit(1000)]);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.topic, (counts.get(r.topic) ?? 0) + 1);
  return QA_TOPICS.map((t) => ({ slug: t.slug, label: t.label, openCount: counts.get(t.slug) ?? 0 }));
}

export async function listQuestions(viewerId: string, p: { topic?: QaTopicSlug; status?: QaQuestionStatus; limit: number; cursor?: string }): Promise<PageOut<QaQuestion>> {
  const q: string[] = [];
  if (p.topic) q.push(Query.equal('topic', p.topic));
  if (p.status) q.push(Query.equal('status', p.status));
  return pageQuestions(q, p, viewerId);
}

export async function listMyQuestions(viewerId: string, p: { limit: number; cursor?: string }): Promise<PageOut<QaQuestion>> {
  return pageQuestions([Query.equal('authorId', viewerId)], p, viewerId);
}

/** Unanswered questions in topics matching the teacher's subjects (the anti-"goes cold" queue). */
export async function teacherInbox(actor: Actor, p: { limit: number; cursor?: string }): Promise<PageOut<QaQuestion> & { topics: QaTopicSlug[] }> {
  if (!actor.roles.includes('teacher')) throw roleRequired('teacher');
  const tp = await findOne<TeacherProfileRow>(TABLES.teacherProfiles, [Query.equal('userId', actor.user.$id)]);
  const topics = topicsForSubjects(tp?.subjects ?? []);
  if (!topics.length) return { items: [], nextCursor: null, topics };
  const page = await pageQuestions([Query.equal('topic', topics), Query.equal('status', 'open'), Query.notEqual('authorId', actor.user.$id)], p, actor.user.$id);
  return { ...page, topics };
}

export async function getQuestionDetail(id: string, actor: Actor): Promise<QaQuestionDetail> {
  const viewerId = actor.user.$id;
  const q = await loadQuestion(id);
  const blocked = await blockedEitherWay(viewerId);
  if (blocked.has(q.authorId)) throw notFound('not_found', 'This question could not be found.');
  const rows = await listRows<QaAnswerRow>(TABLES.qaAnswers, [Query.equal('questionId', id), Query.isNull('removedAt'), Query.orderAsc('createdAt'), Query.limit(200)]);
  const answers = rows.filter((r) => r.kind === 'answer' && !blocked.has(r.authorId));
  const clarByParent = new Map(rows.filter((r) => r.kind === 'clarification' && r.parentAnswerId).map((r) => [r.parentAnswerId!, r]));
  const [refs, attachments] = await Promise.all([
    authors([q.authorId, ...answers.map((a) => a.authorId)]),
    Promise.all([q, ...answers].map((r) => resolveAttachments(r.attachmentFileIds ?? []))),
  ]);
  const [questionAttachments = [], ...answerAttachments] = attachments;
  const viewer: QaViewer = { userId: viewerId, roles: actor.roles, blockedWithAuthor: false };
  const accepted = q.acceptedAnswerId;
  const outAnswers: QaAnswer[] = answers
    .map((a, i) => {
      const c = clarByParent.get(a.$id);
      return {
        id: a.$id, questionId: id, author: refs.get(a.authorId)!, body: a.body, accepted: a.$id === accepted, isMine: a.authorId === viewerId,
        clarification: c ? { id: c.$id, body: c.body, createdAt: c.createdAt } : null, attachments: answerAttachments[i] ?? [],
        createdAt: a.createdAt, updatedAt: a.updatedAt,
      };
    })
    // Accepted first, then oldest first.
    .sort((x, y) => Number(y.accepted) - Number(x.accepted) || x.createdAt.localeCompare(y.createdAt));
  const alreadyAnswered = answers.some((a) => a.authorId === viewerId);
  const anyClarifiable = answers.some((a) => canClarify(q, { authorId: a.authorId, kind: a.kind, removedAt: a.removedAt, hasClarification: clarByParent.has(a.$id) }, viewer));
  return {
    question: toQuestion(q, refs.get(q.authorId)!, viewerId),
    attachments: questionAttachments,
    answers: outAnswers,
    permissions: {
      canAnswer: canAnswer(q, viewer, alreadyAnswered),
      canEdit: canEditQuestion(q, viewer),
      canClose: canCloseQuestion(q, viewer),
      canAccept: q.authorId === viewerId && answers.length > 0,
      canClarify: anyClarifiable,
      canReport: q.authorId !== viewerId,
    },
  };
}

export async function acceptedAnswersOf(teacherId: string, limit = 3): Promise<QaAcceptedAnswer[]> {
  const answers = await listRows<QaAnswerRow>(TABLES.qaAnswers, [Query.equal('authorId', teacherId), Query.equal('kind', 'answer'), Query.isNull('removedAt'), Query.orderDesc('createdAt'), Query.limit(50)]);
  if (!answers.length) return [];
  const questions = await listRows<QaQuestionRow>(TABLES.qaQuestions, [Query.equal('$id', [...new Set(answers.map((a) => a.questionId))]), Query.isNull('removedAt'), Query.limit(50)]);
  const byId = new Map(questions.map((q) => [q.$id, q]));
  const out: QaAcceptedAnswer[] = [];
  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q || q.acceptedAnswerId !== a.$id) continue;
    out.push({ answerId: a.$id, questionId: q.$id, topic: q.topic as QaTopicSlug, questionTitle: q.title, excerpt: excerpt(a.body), acceptedAt: q.updatedAt });
    if (out.length >= limit) break;
  }
  return out;
}

// --- writes ------------------------------------------------------------------

export async function createQuestion(actor: Actor, input: { topic: QaTopicSlug; title: string; body: string; attachmentFileIds?: string[] }, requestId?: string): Promise<QaQuestion> {
  if (!actor.roles.includes('student')) throw roleRequired('student');
  await assertDailyLimit(TABLES.qaQuestions, actor.user.$id, QA_DAILY_QUESTION_LIMIT);
  const fileIds = await assertQaAttachments(actor.user.$id, input.attachmentFileIds, QA_MAX_ATTACHMENTS);
  const row = await createRow<QaQuestionRow>(TABLES.qaQuestions, {
    authorId: actor.user.$id, topic: input.topic, title: input.title, body: input.body, status: 'open', answerCount: 0,
    acceptedAnswerId: null, lastActivityAt: nowIso(), removedAt: null, removedBy: null, attachmentFileIds: fileIds,
  });
  await markAttached(fileIds);
  await emitEvent({ eventType: 'qa.question.created', aggregateType: 'qa_question', aggregateId: row.$id, actorId: actor.user.$id, payload: { topic: input.topic }, requestId });
  return (await toQuestions([row], actor.user.$id))[0]!;
}

export async function updateQuestion(id: string, actor: Actor, patch: { topic?: QaTopicSlug; title?: string; body?: string; attachmentFileIds?: string[] }): Promise<QaQuestion> {
  const q = await loadQuestion(id);
  if (q.authorId !== actor.user.$id) throw forbidden('Only the person who asked can edit this question.');
  if (!canEditQuestion(q, { userId: actor.user.$id, roles: actor.roles, blockedWithAuthor: false })) throw conflict('invalid_state', 'Questions can only be edited before anyone answers.');
  const { attachmentFileIds, ...fields } = patch;
  const files = attachmentFileIds === undefined ? null : await replaceAttachments(actor.user.$id, q.attachmentFileIds, attachmentFileIds);
  const row = await updateRow<QaQuestionRow>(TABLES.qaQuestions, id, { ...fields, ...(files ? { attachmentFileIds: files.ids } : {}), lastActivityAt: nowIso() });
  if (files) await files.commit();
  return (await toQuestions([row], actor.user.$id))[0]!;
}

export async function closeQuestion(id: string, actor: Actor, requestId?: string): Promise<QaQuestion> {
  const q = await loadQuestion(id);
  if (q.authorId !== actor.user.$id) throw forbidden('Only the person who asked can close this question.');
  if (q.status === 'closed') throw conflict('invalid_state', 'This question is already closed.');
  const row = await updateRow<QaQuestionRow>(TABLES.qaQuestions, id, { status: 'closed' });
  await emitEvent({ eventType: 'qa.question.closed', aggregateType: 'qa_question', aggregateId: id, actorId: actor.user.$id, payload: { by: 'author' }, requestId });
  return (await toQuestions([row], actor.user.$id))[0]!;
}

export async function createAnswer(questionId: string, actor: Actor, input: { body: string; attachmentFileIds?: string[] }, requestId?: string): Promise<QaQuestionDetail> {
  const me = actor.user.$id;
  if (!actor.roles.includes('teacher')) throw roleRequired('teacher');
  const q = await loadQuestion(questionId);
  const blocked = await blockedEitherWay(me);
  if (blocked.has(q.authorId)) throw conflict('blocked', 'You cannot interact with this person.');
  if (q.authorId === me) throw conflict('invalid_state', 'You cannot answer your own question.');
  if (q.status === 'closed') throw conflict('invalid_state', 'This question is closed.');
  await assertDailyLimit(TABLES.qaAnswers, me, QA_DAILY_ANSWER_LIMIT, [Query.equal('kind', 'answer')]);
  const fileIds = await assertQaAttachments(me, input.attachmentFileIds, QA_MAX_ATTACHMENTS);
  try {
    // Deterministic id = one answer per teacher per question, enforced by the DB.
    await createRow<QaAnswerRow>(TABLES.qaAnswers, {
      questionId, authorId: me, kind: 'answer', parentAnswerId: null, body: input.body, removedAt: null, removedBy: null, attachmentFileIds: fileIds,
    }, answerRowId(questionId, me));
  } catch (err) {
    if (isConflict(err)) throw conflict('duplicate_request', 'You already answered this question. Edit your answer instead.');
    throw err;
  }
  await markAttached(fileIds);
  await incrementColumn(TABLES.qaQuestions, questionId, 'answerCount', 1);
  await updateRow(TABLES.qaQuestions, questionId, { status: statusAfterAnswer(q.status), lastActivityAt: nowIso() });
  await notify({
    userId: q.authorId, type: 'qa.answered', title: 'A teacher answered your question', body: q.title, href: `/qa/${questionId}`,
    refType: 'qa_question', refId: questionId, actorId: me, dedupeKey: `qa.answered:${answerRowId(questionId, me)}`,
  });
  await emitEvent({ eventType: 'qa.answer.created', aggregateType: 'qa_question', aggregateId: questionId, actorId: me, payload: { answerId: answerRowId(questionId, me) }, requestId });
  return getQuestionDetail(questionId, actor);
}

export async function updateAnswer(answerId: string, actor: Actor, input: { body: string; attachmentFileIds?: string[] }): Promise<QaQuestionDetail> {
  const a = await loadAnswer(answerId);
  const q = await loadQuestion(a.questionId);
  if (a.authorId !== actor.user.$id) throw forbidden('Only the author can edit this answer.');
  if (!canEditAnswer(q, { authorId: a.authorId, kind: a.kind, removedAt: a.removedAt, hasClarification: false }, { userId: actor.user.$id, roles: actor.roles, blockedWithAuthor: false })) {
    throw conflict('invalid_state', 'This question is closed.');
  }
  const files = input.attachmentFileIds === undefined ? null : await replaceAttachments(actor.user.$id, a.attachmentFileIds, input.attachmentFileIds);
  await updateRow(TABLES.qaAnswers, answerId, { body: input.body, ...(files ? { attachmentFileIds: files.ids } : {}) });
  if (files) await files.commit();
  return getQuestionDetail(q.$id, actor);
}

export async function clarifyAnswer(answerId: string, actor: Actor, input: { body: string }, requestId?: string): Promise<QaQuestionDetail> {
  const me = actor.user.$id;
  const a = await loadAnswer(answerId);
  const q = await loadQuestion(a.questionId);
  if (q.authorId !== me) throw forbidden('Only the person who asked can follow up on an answer.');
  const blocked = await blockedEitherWay(me);
  const existing = await getRow<QaAnswerRow>(TABLES.qaAnswers, clarificationRowId(answerId));
  const facts = { authorId: a.authorId, kind: a.kind, removedAt: a.removedAt, hasClarification: !!existing };
  if (!canClarify(q, facts, { userId: me, roles: actor.roles, blockedWithAuthor: blocked.has(a.authorId) })) {
    throw conflict('invalid_state', existing ? 'You already followed up on this answer.' : 'You cannot follow up on this answer.');
  }
  try {
    await createRow<QaAnswerRow>(TABLES.qaAnswers, { questionId: q.$id, authorId: me, kind: 'clarification', parentAnswerId: answerId, body: input.body, removedAt: null, removedBy: null }, clarificationRowId(answerId));
  } catch (err) {
    if (isConflict(err)) throw conflict('duplicate_request', 'You already followed up on this answer.');
    throw err;
  }
  await updateRow(TABLES.qaQuestions, q.$id, { lastActivityAt: nowIso() });
  await notify({
    userId: a.authorId, type: 'qa.clarified', title: 'Follow-up on your answer', body: q.title, href: `/qa/${q.$id}`,
    refType: 'qa_question', refId: q.$id, actorId: me, dedupeKey: `qa.clarified:${answerId}`,
  });
  await emitEvent({ eventType: 'qa.clarification.created', aggregateType: 'qa_question', aggregateId: q.$id, actorId: me, payload: { answerId }, requestId });
  return getQuestionDetail(q.$id, actor);
}

export async function acceptAnswer(answerId: string, actor: Actor, requestId?: string): Promise<QaQuestionDetail> {
  const me = actor.user.$id;
  const a = await loadAnswer(answerId);
  const q = await loadQuestion(a.questionId);
  if (!canAccept(q, { authorId: a.authorId, kind: a.kind, removedAt: a.removedAt, hasClarification: false }, { userId: me, roles: actor.roles, blockedWithAuthor: false })) {
    throw forbidden('Only the person who asked can accept an answer.');
  }
  if (q.acceptedAnswerId !== answerId) {
    await updateRow(TABLES.qaQuestions, q.$id, { acceptedAnswerId: answerId, lastActivityAt: nowIso() });
    await notify({
      userId: a.authorId, type: 'qa.accepted', title: 'Your answer helped', body: q.title, href: `/qa/${q.$id}`,
      refType: 'qa_question', refId: q.$id, actorId: me, dedupeKey: `qa.accepted:${answerId}`,
    });
    await emitEvent({ eventType: 'qa.answer.accepted', aggregateType: 'qa_question', aggregateId: q.$id, actorId: me, payload: { answerId }, requestId });
  }
  return getQuestionDetail(q.$id, actor);
}

export async function reportContent(actor: Actor, target: { type: 'qa_question' | 'qa_answer'; id: string }, input: { reason: ReportInput['reason']; details?: string }): Promise<{ reported: true }> {
  const row = target.type === 'qa_question' ? await loadQuestion(target.id) : await getRow<QaAnswerRow>(TABLES.qaAnswers, target.id);
  if (!row || row.removedAt) throw notFound('not_found', 'This content could not be found.');
  if (row.authorId === actor.user.$id) throw conflict('invalid_state', 'You cannot report your own post.');
  await createRow<ReportRow>(TABLES.reports, {
    reporterId: actor.user.$id, targetUserId: row.authorId, reason: input.reason, details: input.details ?? '', status: 'open',
    targetType: target.type, targetId: target.id,
  });
  return { reported: true };
}

// --- moderation --------------------------------------------------------------

/** Called from admin report resolution. Idempotent. */
export async function removeContent(targetType: 'qa_question' | 'qa_answer', id: string, adminId: string): Promise<void> {
  const now = nowIso();
  if (targetType === 'qa_question') {
    const q = await getRow<QaQuestionRow>(TABLES.qaQuestions, id);
    if (q && !q.removedAt) {
      await updateRow(TABLES.qaQuestions, id, { removedAt: now, removedBy: adminId, status: 'closed', attachmentFileIds: [] });
      await deleteUploads(q.attachmentFileIds ?? []);
    }
    return;
  }
  const a = await getRow<QaAnswerRow>(TABLES.qaAnswers, id);
  if (!a || a.removedAt) return;
  await updateRow(TABLES.qaAnswers, id, { removedAt: now, removedBy: adminId, attachmentFileIds: [] });
  await deleteUploads(a.attachmentFileIds ?? []);
  if (a.kind === 'answer') {
    const q = await getRow<QaQuestionRow>(TABLES.qaQuestions, a.questionId);
    if (q) {
      // Atomic, floored at 0; status follows the value the database returned.
      const answerCount = (await decrementColumn<QaQuestionRow>(TABLES.qaQuestions, q.$id, 'answerCount', 1, 0)).answerCount ?? 0;
      await updateRow(TABLES.qaQuestions, q.$id, {
        acceptedAnswerId: q.acceptedAnswerId === id ? null : q.acceptedAnswerId,
        status: q.status === 'closed' ? 'closed' : answerCount > 0 ? 'answered' : 'open',
      });
    }
  }
}

/** Excerpt + deep link for moderator context. */
export async function contentContext(targetType: string | null, id: string | null): Promise<{ excerpt: string | null; href: string | null }> {
  if (!id || (targetType !== 'qa_question' && targetType !== 'qa_answer')) return { excerpt: null, href: null };
  if (targetType === 'qa_question') {
    const q = await getRow<QaQuestionRow>(TABLES.qaQuestions, id);
    return q ? { excerpt: excerpt(`${q.title} — ${q.body}`), href: q.removedAt ? null : `/qa/${q.$id}` } : { excerpt: null, href: null };
  }
  const a = await getRow<QaAnswerRow>(TABLES.qaAnswers, id);
  return a ? { excerpt: excerpt(a.body), href: `/qa/${a.questionId}` } : { excerpt: null, href: null };
}
