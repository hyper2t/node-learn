import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app-env';
import { log } from '../log';

/**
 * One structured line per request: method, matched route (not the raw path, so
 * ids never leak into logs), status, latencyMs, requestId, and userId when known.
 * Levels: 5xx → error, 4xx → warn (except 401/404 noise → info), else info.
 */
export const accessLog = createMiddleware<AppEnv>(async (c, next) => {
  const started = performance.now();
  await next();
  const status = c.res.status;
  const level = status >= 500 ? 'error' : status >= 400 && status !== 401 && status !== 404 ? 'warn' : 'info';
  log(level, 'http', {
    requestId: c.get('requestId'), method: c.req.method, route: c.req.routePath, status,
    latencyMs: Math.round((performance.now() - started) * 10) / 10, userId: c.get('user')?.$id ?? null,
  });
});
