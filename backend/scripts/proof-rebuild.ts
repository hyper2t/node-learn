/**
 * Full rebuild of proof records + relation counters (L5 backfill / diagnosis).
 *   npm --prefix backend run proof:rebuild
 *   npm --prefix backend run proof:rebuild -- --relation <id>
 */
import { Query } from 'node-appwrite';
import { getConfig } from '../src/config';
import { listAllRows } from '../src/db/paginate';
import type { LearningRelationRow } from '../src/db/rows';
import { TABLES } from '../src/db/schema';
import { log, setLogLevel } from '../src/log';
import { rebuildRelation } from '../src/services/proof-projection';

getConfig();
setLogLevel('info');
const i = process.argv.indexOf('--relation');
const ids = i > -1 && process.argv[i + 1]
  ? [process.argv[i + 1]!]
  : (await listAllRows<LearningRelationRow>(TABLES.learningRelations, [Query.select(['$id'])])).map((r) => r.$id);

let drifted = 0;
let failed = 0;
for (const id of ids) {
  try {
    const { drift } = await rebuildRelation(id);
    if (drift.length) { drifted++; log('info', 'proof_rebuilt_with_drift', { relationId: id, fields: drift }); }
  } catch (err) {
    failed++;
    log('error', 'proof_rebuild_failed', { relationId: id, message: err instanceof Error ? err.message : String(err) });
  }
}
console.log(`proof:rebuild: ${ids.length} relations, ${drifted} corrected, ${failed} failed`);
process.exit(failed ? 1 : 0);
