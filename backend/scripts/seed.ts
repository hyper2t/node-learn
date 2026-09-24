/**
 * Seeds demo data for local development: one teacher and one student
 * (Appwrite users + Node Learn profiles + roles). Idempotent by email.
 *   npm run seed
 */
import { ID, Query } from 'node-appwrite';
import type { Models } from 'node-appwrite';
import { getUsers } from '../src/db/client';
import { applyAgeGate, getOrCreateProfile, updateMe, upsertStudentProfile, upsertTeacherProfile } from '../src/services/profiles';
import { grantRole } from '../src/services/roles';
import { findOne } from '../src/db/repo';
import type { QaQuestionRow } from '../src/db/rows';
import { TABLES } from '../src/db/schema';
import { acceptAnswer, createAnswer, createQuestion } from '../src/services/qa';

const users = getUsers();
async function ensureUser(email: string, name: string): Promise<Models.User> {
  const found = await users.list({ queries: [Query.equal('email', email)] });
  return found.users[0] ?? users.create({ userId: ID.unique(), email, password: 'Seed-Password-2026!', name });
}

const teacher = await ensureUser('teacher@node-learn.test', 'Ada Teacher');
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

const student = await ensureUser('student@node-learn.test', 'Sam Student');
await getOrCreateProfile(student);
await applyAgeGate(student, '18_plus');
await grantRole(student.$id, 'student', true);
await updateMe(student, { handle: 'sam_student' }).catch(() => undefined);
await upsertStudentProfile(student, { goalSummary: 'Reason about recursion without tracing every call', headline: '', interests: ['programming'], visibility: 'public' });

// Topic Q&A demo: one answered + accepted question (idempotent by author + title). Needs `npm run api:tables` first.
const QA_TITLE = 'Why does my recursive function never stop?';
if (!(await findOne<QaQuestionRow>(TABLES.qaQuestions, [Query.equal('authorId', student.$id), Query.equal('title', QA_TITLE)]))) {
  const q = await createQuestion({ user: student, roles: ['student'] }, {
    topic: 'programming', title: QA_TITLE,
    body: 'I wrote `count(n)` that calls `count(n - 1)`, but it overflows the stack. I thought returning at `n == 0` was enough. What am I missing?',
  });
  const detail = await createAnswer(q.id, { user: teacher, roles: ['teacher'] }, {
    body: 'Check that every path moves toward the base case. If `n` can start negative, `n - 1` walks *away* from zero forever.\n\n**Try next:** add `if (n <= 0) return` and write down the first three calls by hand.',
  });
  const answerId = detail.answers[0]?.id;
  if (answerId) await acceptAnswer(answerId, { user: student, roles: ['student'] });
}

console.log(`seeded teacher=${teacher.$id} (teacher@node-learn.test) student=${student.$id} (student@node-learn.test) password=Seed-Password-2026!`);
