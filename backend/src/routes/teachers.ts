import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import type { Page, TeacherProfile } from '../contracts/api';
import { ok } from '../errors';
import { readQuery } from '../lib/body';
import { toTeacherProfile } from '../mappers/profile';
import * as S from '../schemas';
import { getTeacherProfile, searchTeachers } from '../services/profiles';
import { listTeacherReviews, replyToReview, reportReview } from '../services/reviews';
import { currentUser } from '../middleware/auth';
import { readJsonBody } from '../lib/body';

export const teacherRoutes = new Hono<AppEnv>();

teacherRoutes.get('/', async (c) => {
  const q = readQuery(c, S.teacherSearch);
  const { rows, profiles, reviewed, nextCursor } = await searchTeachers(q);
  const items: TeacherProfile[] = [];
  for (const r of rows) {
    const p = profiles.get(r.userId);
    if (p) items.push(toTeacherProfile(p, r, false, { activeRelations: 0, evidenceReviewed: reviewed.get(r.userId) ?? 0, memberSince: p.createdAt }));
  }
  const body: Page<TeacherProfile> = { items, nextCursor };
  return ok(c.get('requestId'), body);
});

teacherRoutes.get('/:userId', async (c) => ok(c.get('requestId'), await getTeacherProfile(c.req.param('userId'), c.get('user'))));

teacherRoutes.get('/:userId/reviews', async (c) => {
  const q = readQuery(c, S.paged);
  return ok(c.get('requestId'), await listTeacherReviews(c.req.param('userId'), currentUser(c).$id, q));
});
teacherRoutes.put('/reviews/:id/reply', async (c) => {
  const body = await readJsonBody(c, S.reviewReply);
  return ok(c.get('requestId'), await replyToReview(c.req.param('id'), currentUser(c).$id, body.reply, c.get('requestId')));
});
teacherRoutes.post('/reviews/:id/report', async (c) => ok(c.get('requestId'), await reportReview(currentUser(c).$id, c.req.param('id'), await readJsonBody(c, S.qaReport)), 201));
