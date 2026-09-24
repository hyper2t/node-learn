import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.APPWRITE_ENDPOINT = 'https://example.invalid/v1';
process.env.APPWRITE_PROJECT_ID = 'test';
process.env.APPWRITE_API_KEY = 'test';
process.env.NODE_ENV = 'test';

type Row = { $id: string; [k: string]: unknown };
const db = vi.hoisted(() => ({ tables: new Map<string, Map<string, Record<string, unknown>>>(), seq: 0, messages: [] as unknown[], notes: [] as { userId: string; type: string; dedupeKey?: string }[] }));

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
vi.mock('../src/services/notifications', () => ({ notify: async (n: { userId: string; type: string; dedupeKey?: string }) => { db.notes.push(n); } }));
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
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; db.notes = []; });

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
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; db.notes = []; });

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
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; db.notes = []; });

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
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; db.notes = []; });

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

describe('L2 notifications', () => {
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; db.notes = []; });

  it('notifies the other member on pause, resume and end with unique dedupe keys', async () => {
    await seedRelation();
    const { updateRelationStatus } = await import('../src/services/learning');
    await updateRelationStatus('rel1', S, { status: 'paused' });
    await updateRelationStatus('rel1', S, { status: 'active' });
    await updateRelationStatus('rel1', S, { status: 'paused' });
    await updateRelationStatus('rel1', T, { status: 'ended', reason: 'Done' });
    expect(db.notes.map((n) => [n.userId, n.type])).toEqual([[T, 'relation.paused'], [T, 'relation.resumed'], [T, 'relation.paused'], [S, 'relation.ended']]);
    expect(new Set(db.notes.map((n) => n.dedupeKey)).size).toBe(4);
  });

  it('notifies on proposed goals and achieved goals, but not for the seed goal', async () => {
    const rel = await seedRelation();
    const L = await import('../src/services/learning');
    await L.createGoal(rel as never, T, { title: 'Seed' }, undefined, L.seedGoalId('rel1'));
    expect(db.notes).toHaveLength(0);
    const g = await L.createGoal(rel as never, S, { title: 'Proposed' });
    await L.updateGoal('rel1', g.id, T, { status: 'achieved' });
    expect(db.notes.map((n) => [n.userId, n.type])).toEqual([[T, 'goal.created'], [S, 'goal.achieved']]);
  });
});

describe('deriveNextAction', () => {
  const base = { status: 'active', awaitingReview: 0, awaitingRevision: 0, openTaskDueDates: [] as (string | null)[], goalCompletionRequests: 0 };
  it('follows the priority order', async () => {
    const { deriveNextAction } = await import('../src/services/learning');
    expect(deriveNextAction({ ...base, status: 'paused', awaitingReview: 3 }).kind).toBe('none');
    expect(deriveNextAction({ ...base, awaitingReview: 2, awaitingRevision: 1, openTaskDueDates: [null] })).toEqual({ kind: 'teacher_review', count: 2, dueAt: null });
    expect(deriveNextAction({ ...base, awaitingRevision: 1, openTaskDueDates: [null] }).kind).toBe('student_revise');
    expect(deriveNextAction({ ...base, openTaskDueDates: [null, '2026-10-02T00:00:00.000Z', '2026-10-01T00:00:00.000Z'], goalCompletionRequests: 1 }))
      .toEqual({ kind: 'student_submit', count: 3, dueAt: '2026-10-01T00:00:00.000Z' });
    expect(deriveNextAction({ ...base, goalCompletionRequests: 1 }).kind).toBe('teacher_confirm_goal');
    expect(deriveNextAction(base)).toEqual({ kind: 'teacher_assign', count: 0, dueAt: null });
  });

  it('is computed for relations in the workspace', async () => {
    db.tables.clear();
    const rel = await seedRelation();
    const L = await import('../src/services/learning');
    const P = await import('../src/services/proof');
    expect((await L.getRelation('rel1', S)).nextAction.kind).toBe('teacher_assign');
    await L.createTask('rel1', T, { title: 'Worksheet' });
    expect((await L.getRelation('rel1', S)).nextAction.kind).toBe('student_submit');
    await P.submitEvidence(rel as never, S, { title: 'Work', body: 'x' });
    expect((await L.getWorkspace('rel1', T)).relation.nextAction).toMatchObject({ kind: 'teacher_review', count: 1 });
  });
});

describe('L3 evidence revision loop', () => {
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; db.notes = []; });

  it('needs_revision → revise (v2, history kept) → approved; no second review', async () => {
    const rel = await seedRelation();
    const L = await import('../src/services/learning');
    const P = await import('../src/services/proof');
    const task = await L.createTask('rel1', T, { title: 'Essay' });
    const ev = await P.submitEvidence(rel as never, S, { title: 'Draft', body: 'first try', taskId: task.id });
    const fb = await P.addFeedback(rel as never, ev.id, T, { body: 'Add examples', outcome: 'needs_revision', markTaskDone: true });
    expect(fb.outcome).toBe('needs_revision');
    let item = await P.getEvidence('rel1', ev.id);
    expect(item.status).toBe('needs_revision');
    // Revision request never closes the task, even if markTaskDone was sent.
    expect((await L.getWorkspace('rel1', T)).tasks[0]!.status).toBe('submitted');
    expect((await L.getRelation('rel1', T)).nextAction.kind).toBe('student_revise');
    expect(await errorOf(P.addFeedback(rel as never, ev.id, T, { body: 'again' }))).toMatchObject({ status: 409, details: { reason: 'evidence_awaiting_revision' } });

    expect(await errorOf(P.reviseEvidence(rel as never, ev.id, T, { body: 'x' }))).toMatchObject({ status: 403 });
    item = await P.reviseEvidence(rel as never, ev.id, S, { body: 'second try with examples' });
    expect(item).toMatchObject({ status: 'revised', version: 2, body: 'second try with examples', title: 'Draft' });
    expect(item.revisions).toEqual([expect.objectContaining({ version: 1, body: 'first try' })]);
    expect((await L.getRelation('rel1', S)).nextAction.kind).toBe('teacher_review');
    expect(await errorOf(P.reviseEvidence(rel as never, ev.id, S, { body: 'y' }))).toMatchObject({ status: 409 });

    await P.addFeedback(rel as never, ev.id, T, { body: 'Great', markTaskDone: true });
    expect((await P.getEvidence('rel1', ev.id)).status).toBe('reviewed');
    expect((await L.getWorkspace('rel1', T)).tasks[0]!.status).toBe('done');
    expect(await errorOf(P.addFeedback(rel as never, ev.id, T, { body: 'more' }))).toMatchObject({ status: 409, details: { reason: 'evidence_reviewed' } });
    expect((await P.recomputeProof('rel1')).counts.revisions).toBe(1);
    expect(db.notes.map((n) => n.type)).toEqual(['task.assigned', 'evidence.submitted', 'evidence.revision_requested', 'evidence.revised', 'feedback.added']);
  });
});

describe('L3 goal completion', () => {
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; db.notes = []; });

  it('student requests, teacher declines then confirms; focus moves to the next goal', async () => {
    const rel = await seedRelation();
    const L = await import('../src/services/learning');
    const g1 = await L.createGoal(rel as never, T, { title: 'Fractions' });
    const g2 = await L.createGoal({ ...rel, currentGoalId: g1.id } as never, T, { title: 'Decimals' });
    expect((await L.getRelation('rel1', S)).currentGoalId).toBe(g1.id);

    expect(await errorOf(L.requestGoalCompletion('rel1', g1.id, T))).toMatchObject({ status: 403 });
    const req = await L.requestGoalCompletion('rel1', g1.id, S);
    expect(req.completionRequestedAt).toBeTruthy();
    expect((await L.getRelation('rel1', T)).nextAction.kind).toBe('teacher_confirm_goal');

    expect(await errorOf(L.declineGoalCompletion('rel1', g1.id, S, undefined))).toMatchObject({ status: 403 });
    const declined = await L.declineGoalCompletion('rel1', g1.id, T, 'Two more exercises');
    expect(declined.completionRequestedAt).toBeNull();
    expect(db.messages).toContainEqual(expect.objectContaining({ payload: { type: 'system', text: 'Goal "Fractions" is not complete yet. Two more exercises' } }));

    await L.requestGoalCompletion('rel1', g1.id, S);
    const achieved = await L.updateGoal('rel1', g1.id, T, { status: 'achieved' });
    expect(achieved).toMatchObject({ status: 'achieved', completionRequestedAt: null });
    expect((await L.getRelation('rel1', T)).currentGoalId).toBe(g2.id);
    await L.updateGoal('rel1', g2.id, T, { status: 'dropped' });
    expect((await L.getRelation('rel1', T)).currentGoalId).toBeNull();
  });
});

describe('L3 task reminders', () => {
  beforeEach(() => { db.tables.clear(); db.seq = 0; db.messages = []; db.notes = []; });
  const now = new Date('2026-09-24T12:00:00.000Z');
  const h = (n: number) => new Date(now.getTime() + n * 3_600_000).toISOString();

  it('selectDueTasks picks due-soon and overdue open tasks only', async () => {
    const { selectDueTasks } = await import('../src/services/reminders');
    const task = (id: string, dueAt: string | null, status = 'open') => ({ $id: id, relationId: 'rel1', title: id, status, dueAt });
    const out = selectDueTasks(now, [task('soon', h(5)), task('later', h(30)), task('late', h(-2)), task('ancient', h(-24 * 8)), task('done', h(-2), 'done'), task('none', null)]);
    expect(out.map((r) => [r.taskId, r.kind])).toEqual([['soon', 'due_soon'], ['late', 'overdue']]);
  });

  it('notifies student (and teacher when overdue), skips inactive relations, dedupes per due date', async () => {
    await seedRelation();
    const { createRow } = await import('../src/db/repo');
    const { TABLES } = await import('../src/db/schema');
    await createRow(TABLES.learningTasks, { relationId: 'rel1', title: 'Soon', status: 'open', dueAt: h(5) }, 't1');
    await createRow(TABLES.learningTasks, { relationId: 'rel1', title: 'Late', status: 'open', dueAt: h(-1) }, 't2');
    await createRow(TABLES.learningRelations, { studentId: 's2', teacherId: T, status: 'paused' }, 'rel2');
    await createRow(TABLES.learningTasks, { relationId: 'rel2', title: 'Paused', status: 'open', dueAt: h(-1) }, 't3');
    const { runTaskReminders } = await import('../src/services/reminders');
    const stats = await runTaskReminders(now);
    expect(stats).toMatchObject({ dueSoon: 1, overdue: 1, skippedInactive: 1 });
    expect(db.notes.map((n) => [n.userId, n.type])).toEqual([[S, 'task.due_soon'], [S, 'task.overdue'], [T, 'task.overdue']]);
    expect(new Set(db.notes.map((n) => n.dedupeKey)).size).toBe(3);
  });
});
