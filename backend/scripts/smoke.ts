/** Hits the running local API. Requires API_DEV_BYPASS_USER_ID in backend/.env. `npm --prefix backend run smoke` */
import { getConfig } from '../src/config';

const cfg = getConfig();
const base = process.env.SMOKE_BASE_URL ?? `http://localhost:${cfg.port}`;
const headers: Record<string, string> = cfg.devBypassUserId ? { 'X-Dev-User-Id': cfg.devBypassUserId } : {};

async function hit(path: string, init: RequestInit = {}): Promise<void> {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) } });
  const text = await res.text();
  console.log(`${res.status} ${init.method ?? 'GET'} ${path} ${text.slice(0, 160)}`);
  if (!res.ok && res.status !== 404 && res.status !== 403) throw new Error(`smoke failed at ${path}`);
}

await hit('/healthz');
if (cfg.devBypassUserId) {
  await hit('/v1/me');
  await hit('/v1/me/roles', { method: 'POST', body: JSON.stringify({ role: 'student' }) });
  await hit('/v1/teachers?limit=5');
  await hit('/v1/relations?role=student');
  await hit('/v1/conversations');
  await hit('/v1/qa/topics');
  await hit('/v1/qa/questions?topic=programming&limit=5');
  await hit('/v1/qa/questions/mine');
} else {
  console.log('API_DEV_BYPASS_USER_ID not set: skipped authenticated smoke');
}
console.log('smoke ok');
