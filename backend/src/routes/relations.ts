import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { forbidden, ok } from '../errors';
import { idempotencyKeyOf, readJsonBody, readQuery } from '../lib/body';
import { currentUser } from '../middleware/auth';
import * as S from '../schemas';
import { withIdempotency } from '../services/idempotency';
import { createGoal, createTask, declineGoalCompletion, requestGoalCompletion, getRelation, getWorkspace, listRelations, requireRelationMember, updateGoal, updateRelationStatus, updateTask } from '../services/learning';
import { addFeedback, getEvidence, listEvidence, recomputeProof, reviseEvidence, submitEvidence } from '../services/proof';

export const relationRoutes = new Hono<AppEnv>();

relationRoutes.get('/', async (c) => {
  const q = readQuery(c, S.relationList);
  return ok(c.get('requestId'), await listRelations(currentUser(c).$id, q.role, q.status, q.limit, q.cursor));
});
relationRoutes.get('/:id', async (c) => ok(c.get('requestId'), await getRelation(c.req.param('id'), currentUser(c).$id)));
relationRoutes.get('/:id/workspace', async (c) => ok(c.get('requestId'), await getWorkspace(c.req.param('id'), currentUser(c).$id)));
relationRoutes.post('/:id/status', async (c) => {
  const body = await readJsonBody(c, S.relationStatus);
  return ok(c.get('requestId'), await updateRelationStatus(c.req.param('id'), currentUser(c).$id, body, c.get('requestId')));
});

relationRoutes.post('/:id/goals', async (c) => {
  const user = currentUser(c);
  const rel = await requireRelationMember(c.req.param('id'), user.$id);
  const body = await readJsonBody(c, S.createGoal);
  return ok(c.get('requestId'), await withIdempotency(user.$id, idempotencyKeyOf(c), body, () => createGoal(rel, user.$id, body, c.get('requestId'))), 201);
});
relationRoutes.patch('/:id/goals/:goalId', async (c) =>
  ok(c.get('requestId'), await updateGoal(c.req.param('id'), c.req.param('goalId'), currentUser(c).$id, await readJsonBody(c, S.updateGoal), c.get('requestId'))));

relationRoutes.post('/:id/goals/:goalId/request-completion', async (c) =>
  ok(c.get('requestId'), await requestGoalCompletion(c.req.param('id'), c.req.param('goalId'), currentUser(c).$id, c.get('requestId'))));
relationRoutes.post('/:id/goals/:goalId/decline-completion', async (c) => {
  const body = await readJsonBody(c, S.declineGoalCompletion);
  return ok(c.get('requestId'), await declineGoalCompletion(c.req.param('id'), c.req.param('goalId'), currentUser(c).$id, body.note, c.get('requestId')));
});

relationRoutes.post('/:id/tasks', async (c) => {
  const user = currentUser(c);
  const rel = await requireRelationMember(c.req.param('id'), user.$id);
  if (rel.teacherId !== user.$id) throw forbidden('Only the teacher assigns tasks.');
  const body = await readJsonBody(c, S.createTask);
  return ok(c.get('requestId'), await withIdempotency(user.$id, idempotencyKeyOf(c), body, () => createTask(rel.$id, user.$id, body, c.get('requestId'))), 201);
});
relationRoutes.patch('/:id/tasks/:taskId', async (c) =>
  ok(c.get('requestId'), await updateTask(c.req.param('id'), c.req.param('taskId'), currentUser(c).$id, await readJsonBody(c, S.updateTask))));

relationRoutes.get('/:id/evidence', async (c) => {
  await requireRelationMember(c.req.param('id'), currentUser(c).$id);
  const q = readQuery(c, S.paged);
  return ok(c.get('requestId'), await listEvidence(c.req.param('id'), q.limit, q.cursor));
});
relationRoutes.post('/:id/evidence', async (c) => {
  const user = currentUser(c);
  const rel = await requireRelationMember(c.req.param('id'), user.$id);
  if (rel.studentId !== user.$id) throw forbidden('Only the learner submits evidence.');
  const body = await readJsonBody(c, S.createEvidence);
  return ok(c.get('requestId'), await withIdempotency(user.$id, idempotencyKeyOf(c), body, () => submitEvidence(rel, user.$id, body, c.get('requestId'))), 201);
});
relationRoutes.get('/:id/evidence/:evidenceId', async (c) => {
  await requireRelationMember(c.req.param('id'), currentUser(c).$id);
  return ok(c.get('requestId'), await getEvidence(c.req.param('id'), c.req.param('evidenceId')));
});
relationRoutes.patch('/:id/evidence/:evidenceId', async (c) => {
  const user = currentUser(c);
  const rel = await requireRelationMember(c.req.param('id'), user.$id);
  const body = await readJsonBody(c, S.reviseEvidence);
  return ok(c.get('requestId'), await reviseEvidence(rel, c.req.param('evidenceId'), user.$id, body, c.get('requestId')));
});
relationRoutes.post('/:id/evidence/:evidenceId/feedback', async (c) => {
  const user = currentUser(c);
  const rel = await requireRelationMember(c.req.param('id'), user.$id);
  if (rel.teacherId !== user.$id) throw forbidden('Only the teacher gives feedback.');
  const body = await readJsonBody(c, S.createFeedback);
  return ok(c.get('requestId'), await withIdempotency(user.$id, idempotencyKeyOf(c), body, () => addFeedback(rel, c.req.param('evidenceId'), user.$id, body, c.get('requestId'))), 201);
});
relationRoutes.get('/:id/proof', async (c) => {
  await requireRelationMember(c.req.param('id'), currentUser(c).$id);
  return ok(c.get('requestId'), await recomputeProof(c.req.param('id')));
});
