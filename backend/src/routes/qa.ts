import { Hono, type Context } from 'hono';
import type { AppEnv } from '../app-env';
import { ok } from '../errors';
import { idempotencyKeyOf, readJsonBody, readQuery } from '../lib/body';
import { currentUser } from '../middleware/auth';
import * as S from '../schemas';
import { withIdempotency } from '../services/idempotency';
import {
  acceptAnswer, acceptedAnswersOf, clarifyAnswer, closeQuestion, createAnswer, createQuestion, getQuestionDetail, listMyQuestions,
  listQuestions, listTopics, reportContent, teacherInbox, updateAnswer, updateQuestion,
} from '../services/qa';

const actorOf = (c: Context<AppEnv>) => ({ user: currentUser(c), roles: c.get('roles') });
const rid = (c: Context<AppEnv>) => c.get('requestId');

/** Reads: any signed-in member. Mounted with requireAuth. */
export const qaReadRoutes = new Hono<AppEnv>();
qaReadRoutes.get('/topics', async (c) => ok(rid(c), await listTopics()));
qaReadRoutes.get('/questions', async (c) => ok(rid(c), await listQuestions(currentUser(c).$id, readQuery(c, S.qaQuestionList))));
qaReadRoutes.get('/questions/mine', async (c) => ok(rid(c), await listMyQuestions(currentUser(c).$id, readQuery(c, S.paged))));
qaReadRoutes.get('/questions/:id', async (c) => ok(rid(c), await getQuestionDetail(c.req.param('id'), actorOf(c))));
qaReadRoutes.get('/inbox', async (c) => ok(rid(c), await teacherInbox(actorOf(c), readQuery(c, S.paged))));
qaReadRoutes.get('/teachers/:userId/accepted', async (c) => ok(rid(c), await acceptedAnswersOf(c.req.param('userId'))));

/** Writes reach other people: mounted with requireAuth + requireVerifiedEmail + per-user limiter. */
export const qaWriteRoutes = new Hono<AppEnv>();
qaWriteRoutes.post('/questions', async (c) => {
  const actor = actorOf(c);
  const body = await readJsonBody(c, S.createQaQuestion);
  return ok(rid(c), await withIdempotency(actor.user.$id, idempotencyKeyOf(c), body, () => createQuestion(actor, body, rid(c))), 201);
});
qaWriteRoutes.patch('/questions/:id', async (c) => ok(rid(c), await updateQuestion(c.req.param('id'), actorOf(c), await readJsonBody(c, S.updateQaQuestion))));
qaWriteRoutes.post('/questions/:id/close', async (c) => ok(rid(c), await closeQuestion(c.req.param('id'), actorOf(c), rid(c))));
qaWriteRoutes.post('/questions/:id/answers', async (c) => {
  const actor = actorOf(c);
  const body = await readJsonBody(c, S.qaAnswerBody);
  const id = c.req.param('id');
  return ok(rid(c), await withIdempotency(actor.user.$id, idempotencyKeyOf(c), { id, ...body }, () => createAnswer(id, actor, body, rid(c))), 201);
});
qaWriteRoutes.post('/questions/:id/report', async (c) => ok(rid(c), await reportContent(actorOf(c), { type: 'qa_question', id: c.req.param('id') }, await readJsonBody(c, S.qaReport)), 201));
qaWriteRoutes.patch('/answers/:id', async (c) => ok(rid(c), await updateAnswer(c.req.param('id'), actorOf(c), await readJsonBody(c, S.qaAnswerBody))));
qaWriteRoutes.post('/answers/:id/clarify', async (c) => ok(rid(c), await clarifyAnswer(c.req.param('id'), actorOf(c), await readJsonBody(c, S.qaBody), rid(c)), 201));
qaWriteRoutes.post('/answers/:id/accept', async (c) => ok(rid(c), await acceptAnswer(c.req.param('id'), actorOf(c), rid(c))));
qaWriteRoutes.post('/answers/:id/report', async (c) => ok(rid(c), await reportContent(actorOf(c), { type: 'qa_answer', id: c.req.param('id') }, await readJsonBody(c, S.qaReport)), 201));
