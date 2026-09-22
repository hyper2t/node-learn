import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { ok } from '../errors';
import { readJsonBody, readQuery } from '../lib/body';
import { currentUser } from '../middleware/auth';
import * as S from '../schemas';
import { getConversation, listConversations, listMessages, markRead, sendText } from '../services/messaging';

export const conversationRoutes = new Hono<AppEnv>();

conversationRoutes.get('/', async (c) => {
  const q = readQuery(c, S.paged);
  return ok(c.get('requestId'), await listConversations(currentUser(c).$id, q.limit, q.cursor));
});
conversationRoutes.get('/:id', async (c) => ok(c.get('requestId'), await getConversation(c.req.param('id'), currentUser(c).$id)));
conversationRoutes.get('/:id/messages', async (c) => {
  const q = readQuery(c, S.messageList);
  return ok(c.get('requestId'), await listMessages(c.req.param('id'), currentUser(c).$id, q));
});
conversationRoutes.post('/:id/messages', async (c) => {
  const body = await readJsonBody(c, S.sendMessage);
  return ok(c.get('requestId'), await sendText(c.req.param('id'), currentUser(c).$id, body.text, body.clientMessageId, c.get('requestId')), 201);
});
conversationRoutes.post('/:id/read', async (c) => {
  const body = await readJsonBody(c, S.markRead);
  return ok(c.get('requestId'), await markRead(c.req.param('id'), currentUser(c).$id, body.sequence));
});
