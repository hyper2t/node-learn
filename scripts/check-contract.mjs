#!/usr/bin/env node
/**
 * Contract drift guard: src/types/api.ts (source) vs backend/src/contracts/api.ts (mirror).
 * The Appwrite Function build context is backend/ only, hence the mirror.
 * Plain Node, no deps: `node scripts/check-contract.mjs`
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'src/types/api.ts');
const MIRROR = resolve(root, 'backend/src/contracts/api.ts');

const normalize = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean);

const a = normalize(readFileSync(SOURCE, 'utf8'));
const b = normalize(readFileSync(MIRROR, 'utf8'));
let failed = 0;
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i]) {
    failed++;
    console.error(`FAIL line ${i + 1}\n  source: ${a[i] ?? '<missing>'}\n  mirror: ${b[i] ?? '<missing>'}`);
    if (failed >= 5) break;
  }
}
if (failed) {
  console.error('\nbackend/src/contracts/api.ts drifted from src/types/api.ts. Copy the source over the mirror.');
  process.exit(1);
}
console.log(`ok contract in sync (${a.length} significant lines)`);
