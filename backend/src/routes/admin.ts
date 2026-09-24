import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { ok } from '../errors';
import { readJsonBody, readQuery } from '../lib/body';
import { currentUser } from '../middleware/auth';
import * as S from '../schemas';
import { listReports, resolveReport } from '../services/admin';
import { loadMetrics } from '../services/metrics';

/** Mounted behind requireAuth + requireAdmin (see app.ts). */
export const adminRoutes = new Hono<AppEnv>();

adminRoutes.get('/reports', async (c) => ok(c.get('requestId'), await listReports(readQuery(c, S.reportList))));
adminRoutes.get('/metrics', async (c) => ok(c.get('requestId'), await loadMetrics(readQuery(c, S.metricsQuery).weeks)));
adminRoutes.post('/reports/:id/resolve', async (c) => {
  const body = await readJsonBody(c, S.resolveReport);
  return ok(c.get('requestId'), await resolveReport(c.req.param('id'), currentUser(c).$id, body, c.get('requestId')));
});
