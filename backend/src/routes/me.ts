import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { ok } from '../errors';
import { idempotencyKeyOf, readJsonBody } from '../lib/body';
import { currentUser } from '../middleware/auth';
import * as S from '../schemas';
import { deleteAccount, exportData, listIdentities, unlinkIdentity } from '../services/account';
import { withIdempotency } from '../services/idempotency';
import { applyAgeGate, getMe, getStudentProfile, getTeacherProfile, updateMe, upsertStudentProfile, upsertTeacherProfile } from '../services/profiles';
import { grantRole, setActiveRole } from '../services/roles';

export const meRoutes = new Hono<AppEnv>();

meRoutes.get('/', async (c) => ok(c.get('requestId'), await getMe(currentUser(c))));
meRoutes.patch('/', async (c) => ok(c.get('requestId'), await updateMe(currentUser(c), await readJsonBody(c, S.updateMe))));
meRoutes.post('/age-gate', async (c) => {
  const body = await readJsonBody(c, S.ageGate);
  return ok(c.get('requestId'), await applyAgeGate(currentUser(c), body.ageBand));
});
meRoutes.post('/roles', async (c) => {
  const user = currentUser(c);
  const body = await readJsonBody(c, S.selectRole);
  await grantRole(user.$id, body.role, body.activate ?? true);
  return ok(c.get('requestId'), await getMe(user));
});
meRoutes.post('/roles/active', async (c) => {
  const user = currentUser(c);
  const body = await readJsonBody(c, S.selectRole);
  const roles = c.get('roles');
  if (!roles.includes(body.role)) await grantRole(user.$id, body.role, true);
  else await setActiveRole(user.$id, body.role);
  return ok(c.get('requestId'), await getMe(user));
});

meRoutes.get('/student-profile', async (c) => ok(c.get('requestId'), await getStudentProfile(currentUser(c).$id)));
meRoutes.put('/student-profile', async (c) => ok(c.get('requestId'), await upsertStudentProfile(currentUser(c), await readJsonBody(c, S.updateStudentProfile))));
meRoutes.get('/teacher-profile', async (c) => {
  const user = currentUser(c);
  return ok(c.get('requestId'), await getTeacherProfile(user.$id, user));
});
meRoutes.put('/teacher-profile', async (c) => ok(c.get('requestId'), await upsertTeacherProfile(currentUser(c), await readJsonBody(c, S.updateTeacherProfile))));

meRoutes.get('/identities', async (c) => ok(c.get('requestId'), await listIdentities(currentUser(c))));
meRoutes.delete('/identities/:id', async (c) => ok(c.get('requestId'), await unlinkIdentity(currentUser(c), c.req.param('id'))));
meRoutes.get('/export', async (c) => ok(c.get('requestId'), await exportData(currentUser(c).$id)));
meRoutes.delete('/', async (c) => {
  const user = currentUser(c);
  await withIdempotency(user.$id, idempotencyKeyOf(c), { delete: user.$id }, () => deleteAccount(user, c.get('requestId')));
  return ok(c.get('requestId'), { deleted: true });
});
