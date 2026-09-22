import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import type { Health } from '../contracts/api';
import { ok } from '../errors';
import { API_VERSION } from '../version';

export const healthRoutes = new Hono<AppEnv>();
const body = (): Health => ({ ok: true, version: API_VERSION, uptimeSec: Math.round(process.uptime()) });
healthRoutes.get('/healthz', (c) => ok(c.get('requestId'), body()));
healthRoutes.get('/readyz', (c) => ok(c.get('requestId'), body()));
healthRoutes.get('/v1/version', (c) => ok(c.get('requestId'), { version: API_VERSION }));
