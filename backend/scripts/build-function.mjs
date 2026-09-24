/** Bundles Appwrite Functions as single CJS files (no node_modules upload). */
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(here, '..');
const functions = [
  { name: 'node-learn-api', entry: 'src/entry-appwrite.ts' },
  { name: 'node-learn-purge-deleted', entry: 'src/entry-purge-deleted.ts' },
  { name: 'node-learn-healthcheck', entry: 'src/entry-healthcheck.ts' },
  { name: 'node-learn-reminders', entry: 'src/entry-reminders.ts' },
];

for (const fn of functions) {
  const outDir = resolve(backendRoot, '..', 'functions', fn.name);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(resolve(outDir, 'src'), { recursive: true });
  await build({
    entryPoints: [resolve(backendRoot, fn.entry)],
    outfile: resolve(outDir, 'src/main.js'),
    bundle: true, platform: 'node', target: 'node22', format: 'cjs', sourcemap: false, minify: false, logLevel: 'info',
  });
  writeFileSync(resolve(outDir, 'package.json'), `${JSON.stringify({ name: fn.name, version: '0.1.0', private: true, main: 'src/main.js' }, null, 2)}\n`);
  console.log(`built ${resolve(outDir, 'src/main.js')}`);
}
