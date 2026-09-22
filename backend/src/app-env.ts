import type { Models } from 'node-appwrite';
import type { Role } from './contracts/api';

export type AuthUser = Models.User;

/** Per-request context: identity resolved by requireAuth, plus the caller's roles from the DB. */
export type AppVariables = {
  requestId: string;
  user: AuthUser | null;
  roles: Role[];
};

export type AppEnv = { Variables: AppVariables };
