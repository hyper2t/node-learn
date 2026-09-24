import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.APPWRITE_ENDPOINT = 'https://example.invalid/v1';
process.env.APPWRITE_PROJECT_ID = 'test';
process.env.APPWRITE_API_KEY = 'test';
process.env.NODE_ENV = 'test';

type Row = { $id: string; [k: string]: unknown };
const state = vi.hoisted(() => ({ intents: [] as Row[], created: [] as Row[], deleted: [] as string[], updated: [] as [string, Record<string, unknown>][] }));

vi.mock('../src/db/repo', () => ({
  listRows: async (_t: string, queries: string[]) => {
    const ids = queries.map((q) => JSON.parse(q) as { method: string; attribute?: string; values?: string[] }).find((q) => q.attribute === '$id')?.values ?? [];
    return state.intents.filter((r) => ids.includes(r.$id));
  },
  getRow: async (_t: string, id: string) => state.intents.find((r) => r.$id === id) ?? null,
  createRow: async (_t: string, data: Record<string, unknown>, id: string) => { const r = { $id: id, ...data }; state.created.push(r); return r; },
  updateRow: async (_t: string, id: string, data: Record<string, unknown>) => { state.updated.push([id, data]); return { $id: id, ...data }; },
  deleteRow: async (_t: string, id: string) => { state.deleted.push(`row:${id}`); },
}));
vi.mock('../src/db/client', () => ({
  getStorage: () => ({ deleteFile: async ({ bucketId, fileId }: { bucketId: string; fileId: string }) => { state.deleted.push(`${bucketId}/${fileId}`); } }),
  getAdminClient: () => ({}),
}));
vi.mock('../src/services/learning', () => ({ requireRelationMember: async () => ({}) }));

const intent = (id: string, data: Partial<Row> = {}): Row => ({ $id: id, userId: 'u1', purpose: 'qa', status: 'complete', bucketId: 'qa', fileId: id, ...data });

describe('Q&A uploads', () => {
  beforeEach(() => { state.intents = []; state.created = []; state.deleted = []; state.updated = []; });

  it('mints qa intents in the qa bucket without a relation', async () => {
    const { createIntent } = await import('../src/services/uploads');
    const out = await createIntent('u1', { purpose: 'qa', fileName: 'graph.png', mimeType: 'image/png', sizeBytes: 1000 });
    expect(out.bucketId).toBe('qa');
    expect(state.created[0]).toMatchObject({ purpose: 'qa', bucketId: 'qa', relationId: null });
  });

  it('rejects unsupported types and oversize files', async () => {
    const { createIntent } = await import('../src/services/uploads');
    await expect(createIntent('u1', { purpose: 'qa', fileName: 'a.exe', mimeType: 'application/x-msdownload', sizeBytes: 10 })).rejects.toMatchObject({ status: 422 });
    await expect(createIntent('u1', { purpose: 'qa', fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 26 * 1024 * 1024 })).rejects.toMatchObject({ status: 422 });
  });

  it('only accepts the author\'s own finished qa uploads', async () => {
    const { assertQaAttachments } = await import('../src/services/uploads');
    state.intents = [intent('ok'), intent('kept', { status: 'attached' }), intent('pending', { status: 'pending' }), intent('theirs', { userId: 'u2' }), intent('ev', { purpose: 'evidence' })];
    await expect(assertQaAttachments('u1', ['ok', 'kept', 'ok'])).resolves.toEqual(['ok', 'kept']);
    for (const bad of ['pending', 'theirs', 'ev', 'missing']) await expect(assertQaAttachments('u1', [bad])).rejects.toMatchObject({ status: 422 });
    await expect(assertQaAttachments('u1', ['a', 'b', 'c'], 2)).rejects.toMatchObject({ status: 422 });
    await expect(assertQaAttachments('u1', undefined)).resolves.toEqual([]);
  });

  it('marks attached and deletes files with their intents', async () => {
    const { deleteUploads, markAttached } = await import('../src/services/uploads');
    await markAttached(['ok']);
    expect(state.updated).toEqual([['ok', { status: 'attached' }]]);
    state.intents = [intent('gone')];
    await deleteUploads(['gone']);
    expect(state.deleted).toEqual(['qa/gone', 'row:gone']);
  });
});
