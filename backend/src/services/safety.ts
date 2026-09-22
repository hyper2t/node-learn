import { Query } from 'node-appwrite';
import { createRow, deleteRow, findOne, listRows } from '../db/repo';
import { isConflict, type BlockRow, type ReportRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict } from '../errors';

/** Block has priority over every connection / relation / message permission. */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const rows = await listRows<BlockRow>(TABLES.blocks, [Query.or([
    Query.and([Query.equal('blockerId', a), Query.equal('blockedId', b)]),
    Query.and([Query.equal('blockerId', b), Query.equal('blockedId', a)]),
  ]), Query.limit(1)]);
  return rows.length > 0;
}

export async function assertNotBlocked(a: string, b: string): Promise<void> {
  if (await isBlockedEitherWay(a, b)) throw conflict('blocked', 'You cannot interact with this person.');
}

export async function block(blockerId: string, blockedId: string): Promise<void> {
  try {
    await createRow<BlockRow>(TABLES.blocks, { blockerId, blockedId }, `${blockerId}_${blockedId}`.slice(0, 36));
  } catch (err) {
    if (!isConflict(err)) throw err;
  }
  // Blocking cancels pending connection requests both ways.
  const { cancelPendingBetween } = await import('./connections');
  await cancelPendingBetween(blockerId, blockedId);
}

export async function unblock(blockerId: string, blockedId: string): Promise<void> {
  const row = await findOne<BlockRow>(TABLES.blocks, [Query.equal('blockerId', blockerId), Query.equal('blockedId', blockedId)]);
  if (row) await deleteRow(TABLES.blocks, row.$id);
}

export async function listBlockedIds(userId: string): Promise<string[]> {
  return (await listRows<BlockRow>(TABLES.blocks, [Query.equal('blockerId', userId), Query.limit(200)])).map((b) => b.blockedId);
}

export async function report(reporterId: string, input: { targetUserId: string; reason: string; details?: string }): Promise<void> {
  await createRow<ReportRow>(TABLES.reports, { reporterId, targetUserId: input.targetUserId, reason: input.reason, details: input.details ?? '', status: 'open' });
}
