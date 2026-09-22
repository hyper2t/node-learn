import { useSyncExternalStore } from 'react';
import { getAuthState, subscribeAuthState, type AuthState } from '@/infrastructure/appwrite';

/** React binding for the Appwrite auth facade (single source of truth for session status). */
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuthState, getAuthState, getAuthState);
}
