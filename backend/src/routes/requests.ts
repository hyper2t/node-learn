import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { ok, roleRequired } from '../errors';
import { idempotencyKeyOf, readJsonBody, readQuery } from '../lib/body';
import { currentUser } from '../middleware/auth';
import * as S from '../schemas';
import { withIdempotency } from '../services/idempotency';
import { acceptRequest, createLearningRequest, createTeacherInvitation, getRequest, listRequests, respondRequest } from '../services/matching';

export const requestRoutes = new Hono<AppEnv>();

requestRoutes.get('/', async (c) => {
  const q = readQuery(c, S.requestList);
  return ok(c.get('requestId'), await listRequests(currentUser(c).$id, q));
});
requestRoutes.post('/', async (c) => {
  const user = currentUser(c);
  if (!c.get('roles').includes('student')) throw roleRequired('student');
  const body = await readJsonBody(c, S.createLearningRequest);
  const result = await withIdempotency(user.$id, idempotencyKeyOf(c), body, () => createLearningRequest(user, body, c.get('requestId')));
  return ok(c.get('requestId'), result, 201);
});
requestRoutes.post('/invitations', async (c) => {
  const user = currentUser(c);
  if (!c.get('roles').includes('teacher')) throw roleRequired('teacher');
  const body = await readJsonBody(c, S.createTeacherInvitation);
  const result = await withIdempotency(user.$id, idempotencyKeyOf(c), body, () => createTeacherInvitation(user, body, c.get('requestId')));
  return ok(c.get('requestId'), result, 201);
});
requestRoutes.get('/:id', async (c) => ok(c.get('requestId'), await getRequest(c.req.param('id'), currentUser(c).$id)));
requestRoutes.post('/:id/accept', async (c) => ok(c.get('requestId'), await acceptRequest(c.req.param('id'), currentUser(c), c.get('requestId'))));
requestRoutes.post('/:id/decline', async (c) => ok(c.get('requestId'), await respondRequest(c.req.param('id'), currentUser(c), 'decline', c.get('requestId'))));
requestRoutes.post('/:id/cancel', async (c) => ok(c.get('requestId'), await respondRequest(c.req.param('id'), currentUser(c), 'cancel', c.get('requestId'))));
