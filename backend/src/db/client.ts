import { Client, Storage, TablesDB, Users } from 'node-appwrite';
import { getConfig } from '../config';

/** Admin client (API key) is a service singleton and bypasses row permissions. JWT clients are per request. */
let adminClient: Client | null = null;
let tables: TablesDB | null = null;
let storage: Storage | null = null;
let users: Users | null = null;

export function getAdminClient(): Client {
  if (!adminClient) {
    const { endpoint, projectId, apiKey } = getConfig().appwrite;
    adminClient = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  }
  return adminClient;
}
export const getTablesDB = (): TablesDB => (tables ??= new TablesDB(getAdminClient()));
export const getStorage = (): Storage => (storage ??= new Storage(getAdminClient()));
export const getUsers = (): Users => (users ??= new Users(getAdminClient()));
export const getDatabaseId = (): string => getConfig().appwrite.databaseId;

export function clientForJwt(jwt: string): Client {
  const { endpoint, projectId } = getConfig().appwrite;
  return new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
}

export function resetClients(): void {
  adminClient = tables = storage = users = null;
}
