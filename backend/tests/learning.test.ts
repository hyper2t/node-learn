import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.APPWRITE_ENDPOINT = 'https://example.invalid/v1';
process.env.APPWRITE_PROJECT_ID = 'test';
process.env.APPWRITE_API_KEY = 'test';
process.env.NODE_ENV = 'test';

type Row = { $id: string; [k: string]: unknown };
const db = vi.hoisted(() => ({ tables: new Map<string, Map<string, Record<string, unknown>>>(), seq: 0, messages: [] as unknown[] }));

vi.mock('../src/db/repo', () => {
  const table = (t: string) => { if (!db.tables.has(t)) db.tables.set(t, new Map()); return db.tables.get(t)!; };
  const matches = (row: Record<string, unknown>, queries: string[]) => queries.every((raw) => {
    const q = JSON.parse(raw) as { method: string; attribute?: string; values?: unknown[] };
    if (q.method !== 'equal') return true;
    return (q.values ?? []).includes(row[q.attribute!]);
  });
  const list = (t: string, queries: string[]) => [...table(t).values()].filter((r) => matches(r, queries)) as Row[];
  return {
    getRow: async (t: string, id: string) => (table(t).get(id) as Row) ?? null,
    createRow: async (t: string, data: Record<string, unknown>, id?: string) => {
      const rowId = id ?? `r${++db.seq}`;
      if (table(t).has(rowId)) throw Object.assign(new Error('exists'), { code: 409 });
      // Mirrors the unique index on learning_relations.sourceRequestId.
      if (data.sourceRequestId && [...table(t).values()].some((r) => r.sourceRequestId === data.sourceRequestId)) throw Object.assign(new Error('exists'), { code: 409 });
      const ts = new Date().toISOString();
      const row = { $id: rowId, createdAt: ts, updatedAt: ts, ...data };
      table(t).set(rowId, row);
      return row;
    },
    updateRow: async (t: string, id: string, data: Record<string, unknown>) => {
      const row = { ...table(t).get(id), ...data, $id: id };
      table(t).set(id, row);
      return row;
    },
    listRows: async (t: string, q: string[]) => list(t, q),
    findOne: async (t: string, q: string[]) => list(t, q)[0] ?? null,
  };
});
vi.mock('../src/services/messaging', () => ({
  appendMessage: async (m: unknown) => { db.messages.push(m); },
  getOrCreateConversation: async () => ({ $id: 'conv1' }),
}));
vi.mock('../src/services/events', () => ({ emitEvent: async () => undefined }));
vi.mock('../src/services/notifications', () => ({ notify: async () => undefined }));
vi.mock('../src/services/safety', () => ({ assertNotBlocked: async () => undefined }));
vi.mock('../src/services/uploads', () => ({ assertEvidenceAttachments: async () => [], resolveAttachments: async () => [] }));
vi.mock('../src/services/profiles', () => ({
  personRefs: async (ids: string[]) => new Map(ids.map((id) => [id, { userId: id, displayName: id, handle: id, avatarFileId: null }])),
}));

const T = 'teacher1';
const S = 'student1';

async function seedRelation(status = 'active'): Promise<Row> {
  const { createRow } = await import('../src/db/repo');
  const { TABLES } = await import('../src/db/schema');
  return createRow(TABLES.learningRelations, {
    studentId: S, teacherId: T, sourceRequestId: 'req1', status, conversationId: 'conv1', currentGoalId: null,
    startedAt: new Date().toISOString(), endedAt: null, version: 1, openTasks: 0, evidenceCount: 0, lastActivityAt: null,
  }, 'rel1') as Promise<Row>;
}

const errorOf = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as { status: number; code: string; details?: { reason?: string } }; } throw new Error('expected rejection'); };

describe('learning relation state machine', () => {
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; });

  it('allows active → paused → active → ended and records who and why', async () => {
    await seedRelation();
    const { updateRelationStatus } = await import('../src/services/learning');
    const paused = await updateRelationStatus('rel1', S, { status: 'paused' });
    expect(paused).toMatchObject({ status: 'paused', pausedBy: S });
    const resumed = await updateRelationStatus('rel1', T, { status: 'active' });
    expect(resumed).toMatchObject({ status: 'active', pausedBy: null });
    const ended = await updateRelationStatus('rel1', T, { status: 'ended', reason: 'Course finished' });
    expect(ended).toMatchObject({ status: 'ended', endedBy: T, endReason: 'Course finished' });
    expect(ended.endedAt).toBeTruthy();
  });

  it('rejects same-state transitions and anything after ended', async () => {
    await seedRelation();
    const { updateRelationStatus } = await import('../src/services/learning');
    expect(await errorOf(updateRelationStatus('rel1', S, { status: 'active' }))).toMatchObject({ status: 409, code: 'invalid_state' });
    await updateRelationStatus('rel1', S, { status: 'paused' });
    expect(await errorOf(updateRelationStatus('rel1', S, { status: 'paused' }))).toMatchObject({ status: 409 });
    await updateRelationStatus('rel1', S, { status: 'ended', reason: 'Moving abroad' });
    expect(await errorOf(updateRelationStatus('rel1', S, { status: 'active' }))).toMatchObject({ status: 409 });
  });

  it('requires a reason to end', async () => {
    await seedRelation();
    const { updateRelationStatus } = await import('../src/services/learning');
    expect(await errorOf(updateRelationStatus('rel1', S, { status: 'ended' }))).toMatchObject({ status: 422, code: 'validation' });
    expect(await errorOf(updateRelationStatus('rel1', S, { status: 'ended', reason: '   ' }))).toMatchObject({ status: 422 });
  });

  it('rejects non-members', async () => {
    await seedRelation();
    const { updateRelationStatus } = await import('../src/services/learning');
    expect(await errorOf(updateRelationStatus('rel1', 'stranger', { status: 'paused' }))).toMatchObject({ status: 403 });
  });
});

describe('writes require an active relation', () => {
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; });

  it.each(['paused', 'ended'])('blocks all six writes while %s', async (status) => {
    const rel = await seedRelation('active');
    const L = await import('../src/services/learning');
    const P = await import('../src/services/proof');
    const goal = await L.createGoal(rel as never, T, { title: 'Algebra' });
    const task = await L.createTask('rel1', T, { title: 'Worksheet 1' });
    const ev = await P.submitEvidence(rel as never, S, { title: 'My work', body: 'x' });
    const { updateRow } = await import('../src/db/repo');
    const { TABLES } = await import('../src/db/schema');
    const frozen = await updateRow(TABLES.learningRelations, 'rel1', { status }) as never;

    const results = await Promise.all([
      errorOf(L.createGoal(frozen, T, { title: 'Geometry' })),
      errorOf(L.updateGoal('rel1', goal.id, T, { title: 'Renamed' })),
      errorOf(L.createTask('rel1', T, { title: 'Worksheet 2' })),
      errorOf(L.updateTask('rel1', task.id, T, { title: 'Renamed' })),
      errorOf(P.submitEvidence(frozen, S, { title: 'More', body: 'y' })),
      errorOf(P.addFeedback(frozen, ev.id, T, { body: 'Nice' })),
    ]);
    for (const e of results) expect(e).toMatchObject({ status: 409, code: 'invalid_state' });
  });
});

describe('role matrix', () => {
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; });

  it('only the teacher can change task status or edit tasks', async () => {
    await seedRelation();
    const L = await import('../src/services/learning');
    const task = await L.createTask('rel1', T, { title: 'Worksheet' });
    expect(await errorOf(L.updateTask('rel1', task.id, S, { status: 'done' }))).toMatchObject({ status: 403 });
    expect(await errorOf(L.createTask('rel1', S, { title: 'Self-assigned' }))).toMatchObject({ status: 403 });
    await expect(L.updateTask('rel1', task.id, T, { status: 'done' })).resolves.toMatchObject({ status: 'done' });
  });

  it('students can propose and edit goals but not change their status', async () => {
    const rel = await seedRelation();
    const L = await import('../src/services/learning');
    const goal = await L.createGoal(rel as never, S, { title: 'Pass the exam' });
    await expect(L.updateGoal('rel1', goal.id, S, { description: 'June sitting' })).resolves.toMatchObject({ description: 'June sitting' });
    expect(await errorOf(L.updateGoal('rel1', goal.id, S, { status: 'achieved' }))).toMatchObject({ status: 403 });
    await expect(L.updateGoal('rel1', goal.id, T, { status: 'achieved' })).resolves.toMatchObject({ status: 'achieved' });
  });
});

describe('requests', () => {
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; });

  async function seedRequest(): Promise<void> {
    const { createRow } = await import('../src/db/repo');
    const { TABLES } = await import('../src/db/schema');
    await createRow(TABLES.learningRequests, {
      kind: 'learning_request', studentId: S, teacherId: T, initiatorId: S, goalTitle: 'Calculus', message: 'I struggle with limits.',
      status: 'pending', relationId: null, pairKey: 'k', respondedAt: null,
    }, 'req1');
  }

  it('a retried accept does not duplicate the seed goal, and the message goes to chat', async () => {
    await seedRequest();
    const { acceptRequest } = await import('../src/services/matching');
    const { updateRow, listRows } = await import('../src/db/repo');
    const { TABLES } = await import('../src/db/schema');
    const teacher = { $id: T } as never;
    const first = await acceptRequest('req1', teacher);
    // Simulate a crash after the goal was written but before the request was marked accepted.
    await updateRow(TABLES.learningRequests, 'req1', { status: 'pending', relationId: null });
    const second = await acceptRequest('req1', teacher);
    expect(second.relationId).toBe(first.relationId);
    const goals = await listRows(TABLES.learningGoals, []);
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ title: 'Calculus', description: '' });
    expect(db.messages).toContainEqual(expect.objectContaining({ type: 'text', senderId: S, payload: { type: 'text', text: 'I struggle with limits.' } }));
  });

  it('a paused relation blocks a new request and points at it', async () => {
    await seedRelation('paused');
    const { createRow } = await import('../src/db/repo');
    const { TABLES } = await import('../src/db/schema');
    await createRow(TABLES.teacherProfiles, { userId: T, acceptingRequests: true }, 'tp1');
    const { createLearningRequest } = await import('../src/services/matching');
    const e = await errorOf(createLearningRequest({ $id: S } as never, { teacherId: T, goalTitle: 'Again', message: '' }));
    expect(e).toMatchObject({ status: 409, code: 'duplicate_request', details: { reason: 'pair_relation_paused', relationId: 'rel1' } });
  });
});
