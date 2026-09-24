import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './app-env';
import { getConfig } from './config';
import { HttpError, notFound, payloadTooLarge, toErrorResponse } from './errors';
import { setLogLevel } from './log';
import { accessLog } from './middleware/access-log';
import { requireAdmin, requireAuth, requireVerifiedEmail } from './middleware/auth';
import { corsMiddleware } from './middleware/cors';
import { rateLimit } from './middleware/rate-limit';
import { requestId } from './middleware/request-id';
import { adminRoutes } from './routes/admin';
import { connectionRoutes } from './routes/connections';
import { conversationRoutes } from './routes/conversations';
import { healthRoutes } from './routes/health';
import { meRoutes } from './routes/me';
import { notificationRoutes } from './routes/notifications';
import { qaReadRoutes, qaWriteRoutes } from './routes/qa';
import { relationRoutes } from './routes/relations';
import { reviewQueueRoutes } from './routes/review-queue';
import { requestRoutes } from './routes/requests';
import { teacherRoutes } from './routes/teachers';
import { uploadRoutes } from './routes/uploads';

/**
 * Single route-assembly point. Web-standard Request/Response so the same app
 * runs behind @hono/node-server locally and the Appwrite Function adapter in prod.
 */
/** JSON API bodies are small; evidence attachments go straight to Storage. */
export const BODY_LIMIT_BYTES = 256 * 1024;

export function createApp(): Hono<AppEnv> {
  const config = getConfig();
  setLogLevel(config.logLevel);
  const app = new Hono<AppEnv>();

  app.use('*', requestId);
  app.use('*', accessLog);
  // API-only service: no HTML, so CSP is unnecessary; keep the rest of the hardening headers.
  app.use('*', secureHeaders({ contentSecurityPolicy: undefined, crossOriginResourcePolicy: 'cross-origin', crossOriginEmbedderPolicy: false }));
  app.use('*', bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: () => { throw payloadTooLarge(BODY_LIMIT_BYTES); } }));
  app.use('*', corsMiddleware(config.corsOrigins, { allowPrivateNetworkOrigins: !config.isProduction }));
  app.use('*', rateLimit({ perMin: config.rateLimitPerMin }));

  app.route('/', healthRoutes);

  // Guards attach to concrete routes so unknown paths still reach notFound.
  const mount = (prefix: string, router: Hono<AppEnv>, guards: MiddlewareHandler<AppEnv>[]) => {
    const guarded = new Hono<AppEnv>();
    for (const r of router.routes) guarded.on([r.method], [r.path], ...guards, r.handler);
    app.route(prefix, guarded);
  };
  const authed: MiddlewareHandler<AppEnv>[] = [requireAuth];
  // Reaching other people requires a verified email; tighter per-user limits on social writes.
  const social: MiddlewareHandler<AppEnv>[] = [requireAuth, requireVerifiedEmail, rateLimit({ perMin: 30, keyPrefix: 'social' })];

  mount('/v1/me', meRoutes, authed);
  mount('/v1/teachers', teacherRoutes, authed);
  mount('/v1/requests', requestRoutes, social);
  mount('/v1/relations', relationRoutes, authed);
  mount('/v1/review-queue', reviewQueueRoutes, authed);
  mount('/v1/conversations', conversationRoutes, authed);
  mount('/v1/connections', connectionRoutes, social);
  mount('/v1/uploads', uploadRoutes, authed);
  mount('/v1/notifications', notificationRoutes, authed);
  mount('/v1/qa', qaReadRoutes, authed);
  mount('/v1/qa', qaWriteRoutes, social);
  mount('/v1/admin', adminRoutes, [requireAuth, requireAdmin]);

  app.notFound((c) => {
    throw notFound('route_not_found', `No handler for ${c.req.method} ${c.req.path}`);
  });
  app.onError((err, c) => toErrorResponse(err, { requestId: c.get('requestId') ?? 'unknown', path: c.req.path }));
  return app;
}

export { HttpError };
