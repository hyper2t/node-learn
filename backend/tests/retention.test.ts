import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TABLES, type TableId } from '../src/db/schema';

type AnyRow = { $id: string; [key: string]: unknown };

type QuerySpec =
  | { op: 'equal'; key: string; value: unknown }
  | { op: 'lessThan'; key: string; value: string }
  | { op: 'limit'; value: number }
  | { op: 'offset'; value: number }
  | { op: 'orderAsc'; key: string };

const state = vi.hoisted(() => ({
  rows: {} as Record<string, AnyRow[]>,
  deletedFiles: [] as string[],
}));

function q(spec: QuerySpec): string {
  return JSON.stringify(spec);
}

function spec(raw: string): QuerySpec {
  return JSON.parse(raw) as QuerySpec;
}

function value(row: AnyRow, key: string): unknown {
  return key === '$id' ? row.$id : row[key];
}

function tableRows(tableId: TableId): AnyRow[] {
  return state.rows[tableId] ?? [];
}

function applyQueries(rows: AnyRow[], rawQueries: string[]): AnyRow[] {
  const specs = rawQueries.map(spec);
  let out = [...rows];
  let offset = 0;
  let limit = out.length;
  for (const item of specs) {
    if (item.op === 'equal') out = out.filter((row) => value(row, item.key) === item.value);
    else if (item.op === 'lessThan') out = out.filter((row) => String(value(row, item.key) ?? '') < item.value);
    else if (item.op === 'orderAsc') out.sort((a, b) => String(value(a, item.key) ?? '').localeCompare(String(value(b, item.key) ?? '')));
    else if (item.op === 'offset') offset = item.value;
    else if (item.op === 'limit') limit = item.value;
  }
  return out.slice(offset, offset + limit);
}

vi.mock('../src/db/repo', () => ({
  Query: {
    equal: (key: string, value: unknown) => q({ op: 'equal', key, value }),
    lessThan: (key: string, value: string) => q({ op: 'lessThan', key, value }),
    limit: (value: number) => q({ op: 'limit', value }),
    offset: (value: number) => q({ op: 'offset', value }),
    orderAsc: (key: string) => q({ op: 'orderAsc', key }),
  },
  listRows: async (tableId: TableId, queries: string[]) => applyQueries(state.rows[tableId] ?? [], queries),
  deleteRow: async (tableId: TableId, rowId: string) => {
    state.rows[tableId] = (state.rows[tableId] ?? []).filter((row) => row.$id !== rowId);
  },
  updateRow: async (tableId: TableId, rowId: string, data: Record<string, unknown>) => {
    const row = (state.rows[tableId] ?? []).find((item) => item.$id === rowId);
    if (!row) throw new Error(`missing row ${tableId}/${rowId}`);
    Object.assign(row, data);
    return row;
  },
}));

vi.mock('../src/db/client', () => ({
  getStorage: () => ({
    deleteFile: async ({ bucketId, fileId }: { bucketId: string; fileId: string }) => {
      if (fileId === 'already-gone') throw Object.assign(new Error('missing'), { code: 404, type: 'storage_file_not_found' });
      state.deletedFiles.push(`${bucketId}/${fileId}`);
    },
  }),
}));

vi.mock('../src/log', () => ({ log: vi.fn() }));

const row = (id: string, data: Record<string, unknown>): AnyRow => ({ $id: id, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...data });

describe('retention purge', () => {
  beforeEach(() => {
    state.deletedFiles = [];
    state.rows = {
      [TABLES.profiles]: [
        row('deleted-old', { status: 'deleted', updatedAt: '2026-08-01T00:00:00.000Z' }),
        row('deleted-recent', { status: 'deleted', updatedAt: '2026-09-15T00:00:00.000Z' }),
        row('active', { status: 'active', updatedAt: '2026-07-01T00:00:00.000Z' }),
      ],
      [TABLES.messages]: [
        row('m1', { senderId: 'deleted-old', createdAt: '2026-08-02T00:00:00.000Z' }),
        row('m2', { senderId: 'deleted-old', createdAt: '2026-08-03T00:00:00.000Z' }),
        row('m3', { senderId: 'deleted-recent', createdAt: '2026-08-03T00:00:00.000Z' }),
        row('m4', { senderId: 'active', createdAt: '2026-08-03T00:00:00.000Z' }),
      ],
      [TABLES.evidenceItems]: [
        row('e1', { authorId: 'deleted-old', submittedAt: '2026-08-02T00:00:00.000Z', attachmentFileIds: ['f-evidence'] }),
        row('e2', { authorId: 'deleted-old', submittedAt: '2026-08-03T00:00:00.000Z', attachmentFileIds: [] }),
        row('e3', { authorId: 'deleted-recent', submittedAt: '2026-08-03T00:00:00.000Z', attachmentFileIds: ['recent-file'] }),
      ],
      [TABLES.uploadIntents]: [
        row('expired-pending', { userId: 'active', status: 'pending', purpose: 'evidence', bucketId: 'evidence', fileId: 'expired-pending', expiresAt: '2026-09-21T00:00:00.000Z' }),
        row('fresh-pending', { userId: 'active', status: 'pending', purpose: 'evidence', bucketId: 'evidence', fileId: 'fresh-pending', expiresAt: '2026-09-22T12:30:00.000Z' }),
        row('f-evidence', { userId: 'deleted-old', status: 'complete', purpose: 'evidence', bucketId: 'evidence', fileId: 'f-evidence', expiresAt: '2026-08-01T00:15:00.000Z' }),
        row('already-gone', { userId: 'deleted-old', status: 'complete', purpose: 'avatar', bucketId: 'avatars', fileId: 'already-gone', expiresAt: '2026-08-01T00:15:00.000Z' }),
        row('recent-user-file', { userId: 'deleted-recent', status: 'complete', purpose: 'evidence', bucketId: 'evidence', fileId: 'recent-user-file', expiresAt: '2026-09-15T00:15:00.000Z' }),
      ],
      [TABLES.idempotencyKeys]: [
        row('idem-old', { createdAt: '2026-09-21T00:00:00.000Z' }),
        row('idem-new', { createdAt: '2026-09-22T12:30:00.000Z' }),
      ],
      [TABLES.notifications]: [
        row('n-old', { createdAt: '2026-06-01T00:00:00.000Z' }),
        row('n-new', { createdAt: '2026-09-01T00:00:00.000Z' }),
      ],
      [TABLES.reports]: [
        row('r-old', { status: 'resolved', resolvedAt: '2025-09-01T00:00:00.000Z' }),
        row('r-new', { status: 'resolved', resolvedAt: '2026-09-01T00:00:00.000Z' }),
        row('r-open', { status: 'open', resolvedAt: '2025-01-01T00:00:00.000Z' }),
      ],
      [TABLES.auditEvents]: [
        row('a-old', { createdAt: '2025-09-01T00:00:00.000Z' }),
        row('a-new', { createdAt: '2026-09-01T00:00:00.000Z' }),
      ],
    };
  });

  it('purges expired operational rows and deleted-member private data without touching recent/active rows', async () => {
    const { runRetentionPurge } = await import('../src/services/retention');
    const stats = await runRetentionPurge({ now: new Date('2026-09-23T00:00:00.000Z'), batchSize: 50, maxBatches: 3 });

    expect(stats).toMatchObject({
      expiredUploadIntentsDeleted: 1,
      uploadFilesDeleted: 2,
      idempotencyKeysDeleted: 1,
      notificationsDeleted: 1,
      reportsDeleted: 1,
      auditEventsDeleted: 1,
      deletedProfilesScanned: 1,
      deletedMemberMessagesDeleted: 2,
      deletedMemberUploadIntentsDeleted: 2,
      evidenceAttachmentRefsCleared: 1,
    });
    expect(state.deletedFiles.sort()).toEqual(['evidence/expired-pending', 'evidence/f-evidence']);
    expect(tableRows(TABLES.uploadIntents).map((r) => r.$id).sort()).toEqual(['fresh-pending', 'recent-user-file']);
    expect(tableRows(TABLES.messages).map((r) => r.$id).sort()).toEqual(['m3', 'm4']);
    expect(tableRows(TABLES.evidenceItems).find((r) => r.$id === 'e1')?.attachmentFileIds).toEqual([]);
    expect(tableRows(TABLES.evidenceItems).find((r) => r.$id === 'e3')?.attachmentFileIds).toEqual(['recent-file']);
    expect(tableRows(TABLES.idempotencyKeys).map((r) => r.$id)).toEqual(['idem-new']);
    expect(tableRows(TABLES.notifications).map((r) => r.$id)).toEqual(['n-new']);
    expect(tableRows(TABLES.reports).map((r) => r.$id).sort()).toEqual(['r-new', 'r-open']);
    expect(tableRows(TABLES.auditEvents).map((r) => r.$id)).toEqual(['a-new']);
  });
});

