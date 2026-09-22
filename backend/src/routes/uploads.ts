import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { ok } from '../errors';
import { readJsonBody } from '../lib/body';
import { currentUser } from '../middleware/auth';
import * as S from '../schemas';
import { completeIntent, createIntent } from '../services/uploads';

export const uploadRoutes = new Hono<AppEnv>();
uploadRoutes.post('/intents', async (c) => ok(c.get('requestId'), await createIntent(currentUser(c).$id, await readJsonBody(c, S.uploadIntent)), 201));
uploadRoutes.post('/complete', async (c) => {
  const body = await readJsonBody(c, S.uploadComplete);
  return ok(c.get('requestId'), await completeIntent(currentUser(c).$id, body.fileId));
});
