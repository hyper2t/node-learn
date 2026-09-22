import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app-env';

export const requestId = createMiddleware<AppEnv>(async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const id = incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
  c.set('requestId', id);
  await next();
  c.res.headers.set('X-Request-Id', id);
});
