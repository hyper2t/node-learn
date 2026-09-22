import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { notFound, ok } from '../errors';
import { idempotencyKeyOf, readJsonBody, readQuery } from '../lib/body';
import { currentUser } from '../middleware/auth';
import * as S from '../schemas';
import { accept, createRequest, listContacts, listRequests, lookup, respond } from '../services/connections';
import { withIdempotency } from '../services/idempotency';
import { block, report, unblock } from '../services/safety';

export const connectionRoutes = new Hono<AppEnv>();

connectionRoutes.get('/lookup', async (c) => {
  const q = readQuery(c, S.lookup);
  const found = await lookup(q.handle, currentUser(c).$id);
  if (!found) throw notFound('user_not_found', 'No one with that handle.');
  return ok(c.get('requestId'), found);
});
connectionRoutes.get('/contacts', async (c) => {
  const q = readQuery(c, S.paged);
  return ok(c.get('requestId'), await listContacts(currentUser(c).$id, q.limit, q.cursor));
});
connectionRoutes.get('/requests', async (c) => {
  const q = readQuery(c, S.connectionList);
  return ok(c.get('requestId'), await listRequests(currentUser(c).$id, q.direction, q.limit, q.cursor));
});
connectionRoutes.post('/requests', async (c) => {
  const user = currentUser(c);
  const body = await readJsonBody(c, S.createConnectionRequest);
  return ok(c.get('requestId'), await withIdempotency(user.$id, idempotencyKeyOf(c), body, () => createRequest(user, body, 'handle', c.get('requestId'))), 201);
});
connectionRoutes.post('/requests/:id/accept', async (c) => ok(c.get('requestId'), await accept(c.req.param('id'), currentUser(c), c.get('requestId'))));
connectionRoutes.post('/requests/:id/decline', async (c) => ok(c.get('requestId'), await respond(c.req.param('id'), currentUser(c), 'decline')));
connectionRoutes.post('/requests/:id/cancel', async (c) => ok(c.get('requestId'), await respond(c.req.param('id'), currentUser(c), 'cancel')));
connectionRoutes.post('/blocks', async (c) => {
  const body = await readJsonBody(c, S.blockInput);
  await block(currentUser(c).$id, body.userId);
  return ok(c.get('requestId'), { blocked: true });
});
connectionRoutes.delete('/blocks/:userId', async (c) => {
  await unblock(currentUser(c).$id, c.req.param('userId'));
  return ok(c.get('requestId'), { blocked: false });
});
connectionRoutes.post('/reports', async (c) => {
  const body = await readJsonBody(c, S.reportInput);
  await report(currentUser(c).$id, body);
  return ok(c.get('requestId'), { reported: true });
});
