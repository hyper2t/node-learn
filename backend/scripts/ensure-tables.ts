/**
 * Idempotent TablesDB migration driven by ../appwrite.config.json. Creates missing tables/columns/indexes/buckets;
 * never deletes or alters existing ones.
 *   npm --prefix backend run tables:ensure -- --all
 *   npm --prefix backend run tables:ensure -- profiles messages
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppwriteException, Client, Compression, Storage, TablesDB, TablesDBIndexType } from 'node-appwrite';
import { getConfig } from '../src/config';
import { log, setLogLevel } from '../src/log';

type ColumnDef = { key: string; type: 'varchar' | 'text' | 'boolean' | 'integer' | 'datetime' | 'string'; required: boolean; array?: boolean; size?: number; default?: unknown; min?: number; max?: number };
type IndexDef = { key: string; type: 'key' | 'unique' | 'fulltext'; columns: string[]; orders?: string[] };
type TableDef = { $id: string; name: string; $permissions: string[]; rowSecurity: boolean; enabled: boolean; columns: ColumnDef[]; indexes: IndexDef[] };
type BucketDef = { $id: string; name: string; $permissions: string[]; fileSecurity: boolean; enabled: boolean; maximumFileSize: number; allowedFileExtensions: string[]; compression: string; encryption: boolean; antivirus: boolean };
type DbDef = { $id: string; name: string; enabled: boolean };

const config = getConfig();
setLogLevel('info');
const here = fileURLToPath(new URL('.', import.meta.url));
const appwriteConfig = JSON.parse(readFileSync(resolve(here, '../../appwrite.config.json'), 'utf8')) as { tablesDB: DbDef[]; tables: TableDef[]; buckets: BucketDef[] };
const client = new Client().setEndpoint(config.appwrite.endpoint).setProject(config.appwrite.projectId).setKey(config.appwrite.apiKey);
const db = new TablesDB(client);
const storage = new Storage(client);
const databaseId = config.appwrite.databaseId;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isNotFound = (e: unknown) => e instanceof AppwriteException && e.code === 404;
const isExists = (e: unknown) => e instanceof AppwriteException && e.code === 409;

async function ensureDatabase(): Promise<void> {
  try {
    await db.get({ databaseId });
  } catch (err) {
    if (!isNotFound(err)) throw err;
    const def = appwriteConfig.tablesDB.find((d) => d.$id === databaseId);
    await db.create({ databaseId, name: def?.name ?? databaseId, enabled: true });
    log('info', 'database_created', { databaseId });
  }
}

async function createColumn(tableId: string, col: ColumnDef): Promise<void> {
  const base = { databaseId, tableId, key: col.key, required: col.required, array: col.array ?? false };
  const def = col.required ? undefined : col.default;
  switch (col.type) {
    case 'varchar':
    case 'string':
      await db.createVarcharColumn({ ...base, size: col.size ?? 255, xdefault: def as string | undefined });
      return;
    case 'text':
      await db.createTextColumn({ ...base, xdefault: def as string | undefined });
      return;
    case 'boolean':
      await db.createBooleanColumn({ ...base, xdefault: def as boolean | undefined });
      return;
    case 'integer':
      await db.createIntegerColumn({ ...base, min: col.min, max: col.max, xdefault: def as number | undefined });
      return;
    case 'datetime':
      await db.createDatetimeColumn({ ...base, xdefault: def as string | undefined });
      return;
  }
}

async function waitUntilReady(tableId: string): Promise<void> {
  for (let i = 0; i < 90; i++) {
    const [cols, idx] = await Promise.all([db.listColumns({ databaseId, tableId }), db.listIndexes({ databaseId, tableId })]);
    const pending = [...cols.columns, ...idx.indexes].filter((x) => (x as { status?: string }).status === 'processing');
    if (!pending.length) return;
    await sleep(1000);
  }
  log('warn', 'ensure_tables_still_processing', { tableId });
}

async function ensureTable(def: TableDef): Promise<void> {
  const tableId = def.$id;
  try {
    await db.getTable({ databaseId, tableId });
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await db.createTable({ databaseId, tableId, name: def.name, permissions: def.$permissions, rowSecurity: def.rowSecurity, enabled: def.enabled });
    log('info', 'table_created', { tableId });
  }
  const existingCols = new Set((await db.listColumns({ databaseId, tableId })).columns.map((c) => (c as { key: string }).key));
  for (const col of def.columns) {
    if (existingCols.has(col.key)) continue;
    try {
      await createColumn(tableId, col);
      log('info', 'column_created', { tableId, key: col.key });
    } catch (err) {
      if (!isExists(err)) throw err;
    }
  }
  await waitUntilReady(tableId);
  const existingIdx = new Set((await db.listIndexes({ databaseId, tableId })).indexes.map((i) => i.key));
  for (const index of def.indexes) {
    if (existingIdx.has(index.key)) continue;
    try {
      await db.createIndex({ databaseId, tableId, key: index.key, type: index.type as TablesDBIndexType, columns: index.columns, orders: (index.orders?.length ? index.orders : undefined) as never });
      log('info', 'index_created', { tableId, key: index.key });
    } catch (err) {
      if (!isExists(err)) throw err;
    }
  }
  await waitUntilReady(tableId);
}

async function ensureBucket(def: BucketDef): Promise<void> {
  try {
    await storage.getBucket({ bucketId: def.$id });
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await storage.createBucket({
      bucketId: def.$id, name: def.name, permissions: def.$permissions, fileSecurity: def.fileSecurity, enabled: def.enabled,
      maximumFileSize: def.maximumFileSize, allowedFileExtensions: def.allowedFileExtensions,
      compression: def.compression as Compression, encryption: def.encryption, antivirus: def.antivirus,
    });
    log('info', 'bucket_created', { bucketId: def.$id });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const all = args.includes('--all');
  const wanted = new Set(args.filter((a) => !a.startsWith('--')));
  if (!all && wanted.size === 0) {
    console.error('usage: tsx scripts/ensure-tables.ts <tableId> [...] | --all');
    process.exit(2);
  }
  await ensureDatabase();
  const targets = appwriteConfig.tables.filter((t) => all || wanted.has(t.$id));
  for (const def of targets) await ensureTable(def);
  if (all) for (const b of appwriteConfig.buckets) await ensureBucket(b);
  console.log(`ensure-tables: ${targets.map((t) => t.$id).join(', ')} up to date in "${databaseId}".`);
}

main().catch((err) => {
  log('error', 'ensure_tables_failed', { type: (err as { type?: string }).type, message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
