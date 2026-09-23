import { log } from '../log';

const DEFAULT_TIMEOUT_MS = 7_000;
const MAX_BODY_SAMPLE = 1_000;
const MANUAL_SECRET = '__SET_IN_APPWRITE_CONSOLE__';

export type HealthcheckEnv = Record<string, string | undefined>;

export type HealthcheckResult = {
  ok: boolean;
  checkedAt: string;
  name: string;
  url: string;
  durationMs: number;
  statusCode: number | null;
  bodyOk: boolean | null;
  error: string | null;
  alerted: boolean;
  alertError: string | null;
};

function envInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1_000 && n <= 30_000 ? Math.round(n) : fallback;
}

function sampleBody(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, MAX_BODY_SAMPLE);
}

function bodyOk(body: string): boolean | null {
  try {
    const json = JSON.parse(body) as { ok?: unknown; data?: { ok?: unknown } };
    return json.data?.ok === true || json.ok === true;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function postAlert(env: HealthcheckEnv, result: Omit<HealthcheckResult, 'alerted' | 'alertError'>, timeoutMs: number): Promise<{ alerted: boolean; alertError: string | null }> {
  const webhookUrl = env.ALERT_WEBHOOK_URL?.trim();
  if (webhookUrl === MANUAL_SECRET) return { alerted: false, alertError: null };
  if (!webhookUrl) return { alerted: false, alertError: null };
  const text = `${result.name} healthcheck failed: ${result.error ?? `status=${result.statusCode} bodyOk=${result.bodyOk}`}`;
  try {
    const res = await fetchWithTimeout(webhookUrl, Math.min(timeoutMs, DEFAULT_TIMEOUT_MS), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, source: 'node-learn-healthcheck', ...result }),
    });
    if (!res.ok) return { alerted: false, alertError: `webhook_status_${res.status}` };
    return { alerted: true, alertError: null };
  } catch (err) {
    return { alerted: false, alertError: err instanceof Error ? err.message : String(err) };
  }
}

export async function runHealthcheck(env: HealthcheckEnv = process.env): Promise<HealthcheckResult> {
  const checkedAt = new Date().toISOString();
  const name = env.HEALTHCHECK_NAME?.trim() || 'Node Learn API';
  const url = env.HEALTHCHECK_URL?.trim() || '';
  const timeoutMs = envInt(env.HEALTHCHECK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const started = Date.now();

  let base: Omit<HealthcheckResult, 'alerted' | 'alertError'>;
  if (!url) {
    base = { ok: false, checkedAt, name, url, durationMs: 0, statusCode: null, bodyOk: null, error: 'missing_HEALTHCHECK_URL' };
  } else {
    try {
      const res = await fetchWithTimeout(url, timeoutMs, { headers: { accept: 'application/json' } });
      const body = await res.text();
      const parsedBodyOk = bodyOk(body);
      const ok = res.status === 200 && parsedBodyOk === true;
      base = { ok, checkedAt, name, url, durationMs: Date.now() - started, statusCode: res.status, bodyOk: parsedBodyOk, error: ok ? null : sampleBody(body) || 'unhealthy_response' };
    } catch (err) {
      base = { ok: false, checkedAt, name, url, durationMs: Date.now() - started, statusCode: null, bodyOk: null, error: err instanceof Error ? err.message : String(err) };
    }
  }

  const alert = base.ok ? { alerted: false, alertError: null } : await postAlert(env, base, timeoutMs);
  const result = { ...base, ...alert };
  log(result.ok ? 'info' : 'error', result.ok ? 'healthcheck_ok' : 'healthcheck_failed', { statusCode: result.statusCode, durationMs: result.durationMs, alerted: result.alerted, alertError: result.alertError });
  return result;
}

