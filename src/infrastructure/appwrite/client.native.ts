import 'react-native-url-polyfill/auto';
import { Account, AppwriteException, Client, ID } from 'react-native-appwrite';
import { env } from '@/infrastructure/config/env';

export const client = new Client().setEndpoint(env.appwriteEndpoint).setProject(env.appwriteProjectId).setPlatform(env.appwritePlatform);
export const account = new Account(client);
export { AppwriteException, ID };
