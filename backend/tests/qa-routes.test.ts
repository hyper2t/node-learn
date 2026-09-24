import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.APPWRITE_ENDPOINT = 'https://example.invalid/v1';
process.env.APPWRITE_PROJECT_ID = 'test';
process.env.APPWRITE_API_KEY = 'test';
process.env.NODE_ENV = 'test';
process.env.API_DEV_BYPASS_USER_ID = 'dev-user';

const state = vi.hoisted(() => ({ verified: true, roles: ['student'] as string[] }));
vi.mock('../src/services/identity', () => ({ resolveUserById: async () => ({ $id: 'dev-user', email: 'dev@example.com', emailVerification: state.verified }), resolveUserByJwt: async () => null }));
vi.mock('../src/services/roles', () => ({ getRolesOf: async () => state.roles }));
vi.mock('../src/services/idempotency', () => ({ withIdempotency: async (_u: string, _k: string | null, _p: unknown, fn: () => Promise<unknown>) => fn() }));
const svc = vi.hoisted(() => ({
  listTopics: vi.fn(async () => []), listQuestions: vi.fn(async (..._a: unknown[]) => ({ items: [], nextCursor: null })), listMyQuestions: vi.fn(async () => ({ items: [], nextCursor: null })),
  getQuestionDetail: vi.fn(async () => ({})), teacherInbox: vi.fn(async () => ({ items: [], nextCursor: null, topics: [] })), acceptedAnswersOf: vi.fn(async () => []),
  createQuestion: vi.fn(async (..._a: unknown[]) => ({ id: 'q1' })), updateQuestion: vi.fn(async () => ({})), closeQuestion: vi.fn(async () => ({})),
  createAnswer: vi.fn(async () => ({})), updateAnswer: vi.fn(async () => ({})), clarifyAnswer: vi.fn(async () => ({})), acceptAnswer: vi.fn(async () => ({})),
  reportContent: vi.fn(async (..._a: unknown[]) => ({ reported: true })),
}));
vi.mock('../src/services/qa', () => svc);

const headers = { 'x-dev-user-id': 'dev-user', 'content-type': 'application/json' };
const post = (path: string, body: unknown) => new Request(`http://x${path}`, { method: 'POST', headers, body: JSON.stringify(body) });

describe('qa routes', () => {
  let app: Awaited<ReturnType<typeof import('../src/app')['createApp']>>;
  beforeAll(async () => { app = (await import('../src/app')).createApp(); });
  beforeEach(() => { state.verified = true; state.roles = ['student']; vi.clearAllMocks(); });

  it('401s without identity', async () => {
    expect((await app.fetch(new Request('http://x/v1/qa/topics'))).status).toBe(401);
  });

  it('validates the topic filter against the catalogue', async () => {
    expect((await app.fetch(new Request('http://x/v1/qa/questions?topic=math&status=open', { headers }))).status).toBe(200);
    expect(svc.listQuestions).toHaveBeenCalledWith('dev-user', expect.objectContaining({ topic: 'math', status: 'open', limit: 20 }));
    expect((await app.fetch(new Request('http://x/v1/qa/questions?topic=cooking', { headers }))).status).toBe(422);
  });

  it('creates questions with a valid body and passes roles through', async () => {
    const res = await app.fetch(post('/v1/qa/questions', { topic: 'math', title: 'How do limits work?', body: 'I keep mixing up epsilon and delta in proofs.' }));
    expect(res.status).toBe(201);
    expect(svc.createQuestion).toHaveBeenCalledWith(expect.objectContaining({ roles: ['student'] }), expect.objectContaining({ topic: 'math' }), expect.any(String));
  });

  it('rejects too-short questions and unknown fields', async () => {
    expect((await app.fetch(post('/v1/qa/questions', { topic: 'math', title: 'Hi', body: 'short' }))).status).toBe(422);
    expect((await app.fetch(post('/v1/qa/questions', { topic: 'math', title: 'How do limits work?', body: 'x'.repeat(30), extra: 1 }))).status).toBe(422);
    expect(svc.createQuestion).not.toHaveBeenCalled();
  });

  it('requires a verified email for writes but not reads', async () => {
    state.verified = false;
    const res = await app.fetch(post('/v1/qa/questions/q1/answers', { body: 'Try drawing it first.' }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('email_not_verified');
    expect((await app.fetch(new Request('http://x/v1/qa/questions/q1', { headers }))).status).toBe(200);
  });

  it('routes content reports with their target type', async () => {
    expect((await app.fetch(post('/v1/qa/answers/a1/report', { reason: 'spam' }))).status).toBe(201);
    expect(svc.reportContent).toHaveBeenCalledWith(expect.anything(), { type: 'qa_answer', id: 'a1' }, { reason: 'spam' });
  });

  it('accepts up to 5 attachment ids on questions and answers', async () => {
    const q = { topic: 'math', title: 'How do limits work?', body: 'I keep mixing up epsilon and delta in proofs.' };
    expect((await app.fetch(post('/v1/qa/questions', { ...q, attachmentFileIds: ['f1', 'f2'] }))).status).toBe(201);
    expect(svc.createQuestion).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ attachmentFileIds: ['f1', 'f2'] }), expect.any(String));
    expect((await app.fetch(post('/v1/qa/questions', { ...q, attachmentFileIds: ['1', '2', '3', '4', '5', '6'] }))).status).toBe(422);
    expect((await app.fetch(post('/v1/qa/questions/q1/answers', { body: 'See the sketch.', attachmentFileIds: ['f3'] }))).status).toBe(201);
    expect(svc.createAnswer).toHaveBeenCalledWith('q1', expect.anything(), { body: 'See the sketch.', attachmentFileIds: ['f3'] }, expect.any(String));
  });

  it('does not accept attachments on clarifications', async () => {
    expect((await app.fetch(post('/v1/qa/answers/a1/clarify', { body: 'What about n = 0?', attachmentFileIds: ['f1'] }))).status).toBe(422);
  });
});
