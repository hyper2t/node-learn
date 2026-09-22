import { createHash } from 'node:crypto';
import { createRow, deleteRow, getRow, updateRow } from '../db/repo';
import { isConflict, type IdempotencyKeyRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict } from '../errors';

const rowId = (userId: string, key: string) => createHash('sha256').update(`${userId}:${key}`).digest('hex').slice(0, 32);
const hashOf = (payload: unknown) => createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');

/**
 * Run `fn` once per (user, key). Replays return the stored result when the payload matches;
 * a different payload under the same key is a 409. In-flight duplicates are a 409 too.
 */
export async function withIdempotency<T>(userId: string, key: string | null, payload: unknown, fn: () => Promise<T>): Promise<T> {
  if (!key) return fn();
  const id = rowId(userId, key);
  const requestHash = hashOf(payload);
  const existing = await getRow<IdempotencyKeyRow>(TABLES.idempotencyKeys, id);
  if (existing) {
    if (existing.requestHash !== requestHash) throw conflict('conflict', 'This idempotency key was used with a different request.');
    if (existing.status === 'complete' && existing.resultJson) return JSON.parse(existing.resultJson) as T;
    throw conflict('request_in_progress', 'This request is already being processed.');
  }
  try {
    await createRow<IdempotencyKeyRow>(TABLES.idempotencyKeys, { userId, key, status: 'in_progress', requestHash, resultId: null, resultJson: null }, id);
  } catch (err) {
    if (isConflict(err)) throw conflict('request_in_progress', 'This request is already being processed.');
    throw err;
  }
  try {
    const result = await fn();
    await updateRow(TABLES.idempotencyKeys, id, { status: 'complete', resultJson: JSON.stringify(result) });
    return result;
  } catch (err) {
    await deleteRow(TABLES.idempotencyKeys, id);
    throw err;
  }
}
