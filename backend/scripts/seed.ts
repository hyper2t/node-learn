/**
 * Seeds demo data for local development: one teacher and one student
 * (Appwrite users + KnowNode profiles + roles). Idempotent by email.
 *   npm run seed
 */
import { ID, Query } from 'node-appwrite';
import type { Models } from 'node-appwrite';
import { getUsers } from '../src/db/client';
import { applyAgeGate, getOrCreateProfile, updateMe, upsertStudentProfile, upsertTeacherProfile } from '../src/services/profiles';
import { grantRole } from '../src/services/roles';

const users = getUsers();
async function ensureUser(email: string, name: string): Promise<Models.User> {
  const found = await users.list({ queries: [Query.equal('email', email)] });
  return found.users[0] ?? users.create({ userId: ID.unique(), email, password: 'Seed-Password-2026!', name });
}

const teacher = await ensureUser('teacher@knownode.test', 'Ada Teacher');
await getOrCreateProfile(teacher);
await applyAgeGate(teacher, '18_plus');
await grantRole(teacher.$id, 'teacher', true);
await updateMe(teacher, { handle: 'ada_teacher' }).catch(() => undefined);
await upsertTeacherProfile(teacher, {
  headline: 'Systems thinking for self-taught programmers',
  bio: 'I help learners move from copying code to reasoning about it.',
  subjects: ['programming', 'systems thinking', 'recursion'],
  approach: 'Small tasks, real evidence, honest feedback.',
  acceptingRequests: true,
  visibility: 'public',
});

const student = await ensureUser('student@knownode.test', 'Sam Student');
await getOrCreateProfile(student);
await applyAgeGate(student, '18_plus');
await grantRole(student.$id, 'student', true);
await updateMe(student, { handle: 'sam_student' }).catch(() => undefined);
await upsertStudentProfile(student, { goalSummary: 'Reason about recursion without tracing every call', headline: '', interests: ['programming'], visibility: 'public' });

console.log(`seeded teacher=${teacher.$id} (teacher@knownode.test) student=${student.$id} (student@knownode.test) password=Seed-Password-2026!`);
