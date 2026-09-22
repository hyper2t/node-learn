import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { ok } from '../errors';
import { readJsonBody, readQuery } from '../lib/body';
import { currentUser } from '../middleware/auth';
import * as S from '../schemas';
import { countUnread, listNotifications, markRead } from '../services/notifications';

export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.get('/', async (c) => {
  const q = readQuery(c, S.notificationList);
  return ok(c.get('requestId'), await listNotifications(currentUser(c).$id, q));
});
notificationRoutes.get('/summary', async (c) => ok(c.get('requestId'), { unread: await countUnread(currentUser(c).$id) }));
notificationRoutes.post('/read', async (c) => {
  const body = await readJsonBody(c, S.markNotificationsRead);
  return ok(c.get('requestId'), await markRead(currentUser(c).$id, body));
});
