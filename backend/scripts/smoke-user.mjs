
import { Client, Users, ID } from 'node-appwrite';
const c = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
const users = new Users(c);
const list = await users.list({ search: 'smoke@knownode.test' }).catch(()=>({users:[]}));
let u = list.users?.find(x=>x.email==='smoke@knownode.test');
if (!u) u = await users.create({ userId: ID.unique(), email: 'smoke@knownode.test', password: 'SmokeUser-2026!', name: 'Smoke Student' });
console.log('SMOKE_UID=' + u.$id);
