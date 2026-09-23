/**
 * Sync Function environment variables from appwrite.config.json → Appwrite.
 * `appwrite push function --with-variables` is a silent no-op in appwrite-cli 27.x, so this is the
 * source-of-truth path. Idempotent: creates missing keys, updates changed ones, deletes keys that are
 * no longer declared (pass --keep-extra to skip deletion). Requires `appwrite login`.
 *
 *   node scripts/push-vars.mjs [--function-id node-learn-api] [--keep-extra] [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const args = new Set(process.argv.slice(2));
const argValue = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const functionId = argValue('--function-id', 'node-learn-api');
const dryRun = args.has('--dry-run');
const keepExtra = args.has('--keep-extra');
const MANUAL_SECRET = '__SET_IN_APPWRITE_CONSOLE__';

const config = JSON.parse(readFileSync(resolve(repoRoot, 'appwrite.config.json'), 'utf8'));
const fn = (config.functions ?? []).find((f) => f.$id === functionId);
if (!fn) throw new Error(`function ${functionId} not found in appwrite.config.json`);
const declared = fn.vars ?? [];
const manual = new Set(declared.filter((v) => String(v.value ?? '') === MANUAL_SECRET).map((v) => v.key));
const desired = new Map(declared.filter((v) => !manual.has(v.key)).map((v) => [v.key, String(v.value ?? '')]));

function appwrite(...cliArgs) {
  // shell:true so the Windows `appwrite.cmd`/`appwrite.ps1` shim resolves; JSON goes to stdout.
  const out = execFileSync('appwrite', [...cliArgs, '--json'], { cwd: repoRoot, encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const start = out.indexOf('{');
  return start >= 0 ? JSON.parse(out.slice(start)) : {};
}

const remote = appwrite('functions', 'list-variables', '--function-id', functionId);
const existing = new Map((remote.variables ?? []).map((v) => [v.key, v]));
let created = 0, updated = 0, deleted = 0;

for (const [key, value] of desired) {
  const cur = existing.get(key);
  if (!cur) {
    console.log(`+ create ${key}`);
    created++;
    if (!dryRun) appwrite('functions', 'create-variable', '--function-id', functionId, '--variable-id', 'unique()', '--key', key, '--value', value);
  } else {
    // Values are write-only for secret variables, so always re-apply declared values (cheap, idempotent).
    console.log(`~ update ${key}`);
    updated++;
    if (!dryRun) appwrite('functions', 'update-variable', '--function-id', functionId, '--variable-id', cur.$id, '--key', key, '--value', value);
  }
}
for (const key of manual) {
  if (existing.has(key)) console.log(`  keep   ${key} (managed manually in Appwrite Console/CI secret store)`);
  else console.warn(`! manual ${key} is declared but not present in Appwrite; create it with the real secret before relying on this Function.`);
}
for (const [key, cur] of existing) {
  if (desired.has(key)) continue;
  if (manual.has(key)) continue;
  if (keepExtra) { console.log(`  keep   ${key} (not in config)`); continue; }
  console.log(`- delete ${key} (not in config)`);
  deleted++;
  if (!dryRun) appwrite('functions', 'delete-variable', '--function-id', functionId, '--variable-id', cur.$id);
}

const after = dryRun ? remote : appwrite('functions', 'list-variables', '--function-id', functionId);
console.log(`${dryRun ? '[dry-run] ' : ''}created=${created} updated=${updated} deleted=${deleted} → cloud total=${after.total ?? '?'} (managed=${desired.size}, manual=${manual.size})`);
if (!dryRun && manual.size === 0 && (after.total ?? 0) !== desired.size) {
  console.error(`✗ variable count mismatch: cloud=${after.total} config=${desired.size}`);
  process.exit(1);
}
console.log('Note: variables apply to NEW deployments only — run `npm run deploy:api`, `npm run deploy:purge`, `npm run deploy:healthcheck`, or `appwrite push function` afterwards.');
