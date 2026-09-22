/**
 * Post-deploy assertions for the Appwrite Function `node-learn-api`.
 * Fails (exit 1) when the deployed API is not actually usable — the failure mode we hit on 2026-09-22
 * was a "ready" deployment with zero environment variables.
 *
 *   node scripts/verify-deploy.mjs [--base-url https://<fn-domain>] [--function-id node-learn-api] [--skip-cli]
 *
 * Checks: (1) cloud variable count == appwrite.config.json vars, (2) GET /readyz is 200 with tablesDb.ok,
 * (3) every CORS_ORIGINS entry gets Access-Control-Allow-Origin on preflight, (4) unknown origin is rejected,
 * (5) GET /v1/me without a token is 401 with the JSON error envelope.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const argValue = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const functionId = argValue('--function-id', 'node-learn-api');
const skipCli = process.argv.includes('--skip-cli');

const config = JSON.parse(readFileSync(resolve(repoRoot, 'appwrite.config.json'), 'utf8'));
const fn = (config.functions ?? []).find((f) => f.$id === functionId);
if (!fn) throw new Error(`function ${functionId} not found in appwrite.config.json`);
const vars = Object.fromEntries((fn.vars ?? []).map((v) => [v.key, String(v.value ?? '')]));

let baseUrl = argValue('--base-url', process.env.SMOKE_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL_PROD || '');
const failures = [];
const pass = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => { console.log(`  ✗ ${msg}`); failures.push(msg); };

function appwrite(...cliArgs) {
  const out = execFileSync('appwrite', [...cliArgs, '--json'], { cwd: repoRoot, encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const start = out.indexOf('{');
  return start >= 0 ? JSON.parse(out.slice(start)) : {};
}

console.log(`verify-deploy: ${functionId}`);

// (1) variables
if (skipCli) {
  console.log('  - skipping CLI checks (--skip-cli)');
} else {
  try {
    const remote = appwrite('functions', 'list-variables', '--function-id', functionId);
    const expected = Object.keys(vars).length;
    if ((remote.total ?? 0) === expected) pass(`variables: cloud=${remote.total} config=${expected}`);
    else fail(`variables: cloud=${remote.total ?? 0} config=${expected} → run \`npm run api:push-vars\` then redeploy`);
    const remoteKeys = new Set((remote.variables ?? []).map((v) => v.key));
    for (const k of Object.keys(vars)) if (!remoteKeys.has(k)) fail(`variable missing on cloud: ${k}`);
  } catch (err) {
    fail(`could not list variables via appwrite-cli: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
  if (!baseUrl) {
    try {
      const rules = appwrite('proxy', 'list-rules');
      const rule = (rules.rules ?? []).find((r) => r.deploymentResourceId === functionId && r.status === 'verified');
      if (rule?.domain) baseUrl = `https://${rule.domain}`;
    } catch { /* fall through */ }
  }
}
if (!baseUrl) {
  fail('no base URL: pass --base-url or set SMOKE_BASE_URL');
  finish();
}
baseUrl = baseUrl.replace(/\/$/, '');
console.log(`  base URL: ${baseUrl}`);

const fetchTimeout = (ms) => AbortSignal.timeout(ms);

// (2) readiness
try {
  const res = await fetch(`${baseUrl}/readyz`, { signal: fetchTimeout(30_000) });
  const body = await res.json().catch(() => null);
  const ok = res.status === 200 && body?.data?.ok === true && body?.data?.checks?.tablesDb?.ok === true;
  if (ok) pass(`/readyz 200, tablesDb ${body.data.checks.tablesDb.latencyMs}ms, version ${body.data.version}`);
  else fail(`/readyz → ${res.status} ${JSON.stringify(body)?.slice(0, 200)}`);
} catch (err) {
  fail(`/readyz unreachable: ${err instanceof Error ? err.message : String(err)}`);
}

// (3) CORS allow-list
const origins = (vars.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
for (const origin of origins) {
  try {
    const res = await fetch(`${baseUrl}/v1/me`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' }, signal: fetchTimeout(30_000) });
    const acao = res.headers.get('access-control-allow-origin');
    if (acao === origin) pass(`CORS allows ${origin}`);
    else fail(`CORS missing for ${origin} (status ${res.status}, ACAO=${acao ?? 'none'})`);
  } catch (err) {
    fail(`CORS preflight failed for ${origin}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
// (4) unknown origin rejected
try {
  const evil = 'https://not-allowed.invalid';
  const res = await fetch(`${baseUrl}/v1/me`, { method: 'OPTIONS', headers: { Origin: evil, 'Access-Control-Request-Method': 'GET' }, signal: fetchTimeout(30_000) });
  const acao = res.headers.get('access-control-allow-origin');
  if (!acao) pass('CORS rejects unknown origin');
  else fail(`CORS leaked ACAO=${acao} for unknown origin`);
} catch (err) {
  fail(`CORS negative check failed: ${err instanceof Error ? err.message : String(err)}`);
}

// (5) auth envelope
try {
  const res = await fetch(`${baseUrl}/v1/me`, { signal: fetchTimeout(30_000) });
  const body = await res.json().catch(() => null);
  if (res.status === 401 && body?.error?.code && body?.requestId) pass(`/v1/me unauthenticated → 401 ${body.error.code}`);
  else fail(`/v1/me unauthenticated → ${res.status} ${JSON.stringify(body)?.slice(0, 200)}`);
} catch (err) {
  fail(`/v1/me check failed: ${err instanceof Error ? err.message : String(err)}`);
}

finish();

function finish() {
  if (failures.length) {
    console.error(`\n✗ verify-deploy: ${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log('\n✓ verify-deploy: all checks passed');
  process.exit(0);
}
