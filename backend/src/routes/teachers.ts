import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import type { Page, TeacherProfile } from '../contracts/api';
import { ok } from '../errors';
import { readQuery } from '../lib/body';
import { toTeacherProfile } from '../mappers/profile';
import * as S from '../schemas';
import { getTeacherProfile, searchTeachers } from '../services/profiles';

export const teacherRoutes = new Hono<AppEnv>();

teacherRoutes.get('/', async (c) => {
  const q = readQuery(c, S.teacherSearch);
  const { rows, profiles } = await searchTeachers(q);
  const hasMore = rows.length > q.limit;
  const page = hasMore ? rows.slice(0, q.limit) : rows;
  const items: TeacherProfile[] = [];
  for (const r of page) {
    const p = profiles.get(r.userId);
    if (p) items.push(toTeacherProfile(p, r, false, { activeRelations: 0, evidenceReviewed: 0, memberSince: p.createdAt }));
  }
  const last = page[page.length - 1];
  const body: Page<TeacherProfile> = { items, nextCursor: hasMore && last ? last.$id : null };
  return ok(c.get('requestId'), body);
});

teacherRoutes.get('/:userId', async (c) => ok(c.get('requestId'), await getTeacherProfile(c.req.param('userId'), c.get('user'))));
