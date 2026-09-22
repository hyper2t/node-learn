/** Bundles the API into functions/knownode-api as a single CJS file (no node_modules upload). */
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(here, '..');
const outDir = resolve(backendRoot, '..', 'functions/knownode-api');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(resolve(outDir, 'src'), { recursive: true });
await build({
  entryPoints: [resolve(backendRoot, 'src/entry-appwrite.ts')],
  outfile: resolve(outDir, 'src/main.js'),
  bundle: true, platform: 'node', target: 'node22', format: 'cjs', sourcemap: false, minify: false, logLevel: 'info',
});
writeFileSync(resolve(outDir, 'package.json'), `${JSON.stringify({ name: 'knownode-api', version: '0.1.0', private: true, main: 'src/main.js' }, null, 2)}\n`);
console.log(`built ${resolve(outDir, 'src/main.js')}`);
