import { Hono } from 'hono';
import { Query } from 'node-appwrite';
import type { AppEnv } from '../app-env';
import type { Health } from '../contracts/api';
import { getDatabaseId, getTablesDB } from '../db/client';
import { TABLES } from '../db/schema';
import { ok, serviceUnavailable } from '../errors';
import { API_VERSION } from '../version';

export const healthRoutes = new Hono<AppEnv>();
const body = (): Health => ({ ok: true, version: API_VERSION, uptimeSec: Math.round(process.uptime()) });

/** Liveness: process is up. Never touches dependencies. */
healthRoutes.get('/healthz', (c) => ok(c.get('requestId'), body()));

/** Readiness: TablesDB reachable with the configured key + database (cheap 1-row read; cached 10s). */
let readyCache: { at: number; ok: boolean; ms: number } | null = null;
healthRoutes.get('/readyz', async (c) => {
  if (!readyCache || Date.now() - readyCache.at > 10_000) {
    const started = Date.now();
    let good = false;
    try {
      await getTablesDB().listRows({ databaseId: getDatabaseId(), tableId: TABLES.profiles, queries: [Query.limit(1), Query.select(['$id'])] });
      good = true;
    } catch { good = false; }
    readyCache = { at: Date.now(), ok: good, ms: Date.now() - started };
  }
  if (!readyCache.ok) throw serviceUnavailable('Database is not reachable.');
  return ok(c.get('requestId'), { ...body(), checks: { tablesDb: { ok: true, latencyMs: readyCache.ms } } });
});
healthRoutes.get('/v1/version', (c) => ok(c.get('requestId'), { version: API_VERSION }));
