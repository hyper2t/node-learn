import { Account, AppwriteException, Client, ID } from 'appwrite';
import { env } from '@/infrastructure/config/env';

export const client = new Client().setEndpoint(env.appwriteEndpoint).setProject(env.appwriteProjectId);
export const account = new Account(client);
export { AppwriteException, ID };
