/**
 * Creates (or finds) an Appwrite user for local development and prints the id
 * to put into backend/.env as API_DEV_BYPASS_USER_ID.
 *   npm run make-dev-user -- [email] [name]
 */
import { ID, Query } from 'node-appwrite';
import { getUsers } from '../src/db/client';

const email = process.argv[2] ?? 'dev@knownode.test';
const name = process.argv[3] ?? 'Dev User';
const users = getUsers();
const existing = await users.list({ queries: [Query.equal('email', email)] });
const user = existing.users[0] ?? (await users.create({ userId: ID.unique(), email, password: `Dev-${ID.unique()}!aA1`, name }));
console.log(`API_DEV_BYPASS_USER_ID=${user.$id}  (${user.email})`);
