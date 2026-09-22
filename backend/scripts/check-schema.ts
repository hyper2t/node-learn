/**
 * D3 guard: every TABLES id in src/db/schema.ts must exist in appwrite.config.json and vice-versa,
 * and every table must carry createdAt/updatedAt (repo helpers write them). Runs in `npm run check`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLES } from '../src/db/schema';

const here = fileURLToPath(new URL('.', import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(here, '../../appwrite.config.json'), 'utf8')) as { tables: { $id: string; columns: { key: string }[] }[]; buckets: { $id: string }[] };
const inCode = new Set<string>(Object.values(TABLES));
const inConfig = new Set(cfg.tables.map((t) => t.$id));
const problems: string[] = [];
for (const id of inCode) if (!inConfig.has(id)) problems.push(`table "${id}" is in db/schema.ts but missing from appwrite.config.json`);
for (const id of inConfig) if (!inCode.has(id)) problems.push(`table "${id}" is in appwrite.config.json but missing from db/schema.ts`);
for (const t of cfg.tables) {
  const keys = new Set(t.columns.map((c) => c.key));
  for (const k of ['createdAt', 'updatedAt']) if (!keys.has(k)) problems.push(`table "${t.$id}" lacks column ${k}`);
}
for (const b of ['avatars', 'evidence']) if (!cfg.buckets.some((x) => x.$id === b)) problems.push(`bucket "${b}" missing`);
if (problems.length) { console.error(problems.map((p) => `✗ ${p}`).join('\n')); process.exit(1); }
console.log(`ok schema in sync (${inCode.size} tables, ${cfg.buckets.length} buckets)`);
