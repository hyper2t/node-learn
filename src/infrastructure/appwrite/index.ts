/**
 * Unified auth facade over Appwrite Account. Only identity lives here;
 * business data goes through the BFF (infrastructure/api).
 */
import { Platform } from 'react-native';
import { account, ID } from './client';
import { AuthError, isUnauthorized, toAuthError } from './errors';
import { type OAuthProviderName, type OAuthReturnParams, openOAuth } from './oauth';

export type { OAuthProviderName, OAuthReturnParams } from './oauth';
export { OAUTH_PROVIDERS, OAUTH_RETURN_PATH, callbackScheme, oauthReturnUrl } from './oauth';
export { AuthError, isUnauthorized, toAuthError } from './errors';
export type { AuthErrorCode } from './errors';

export type AuthUser = { id: string; email: string; name: string; emailVerified: boolean; createdAt: string };
export type AuthState = { status: 'loading'; user: null } | { status: 'guest'; user: null } | { status: 'authenticated'; user: AuthUser };
type Listener = (s: AuthState) => void;

type UserLike = { $id: string; email: string; name: string; emailVerification: boolean; $createdAt: string };
const toUser = (u: UserLike): AuthUser => ({ id: u.$id, email: u.email, name: u.name, emailVerified: u.emailVerification, createdAt: u.$createdAt });

let current: AuthState = { status: 'loading', user: null };
const listeners = new Set<Listener>();
function emit(next: AuthState) {
  current = next;
  listeners.forEach((l) => {
    try {
      l(next);
    } catch {
      /* listeners must not break auth */
    }
  });
}
export const getAuthState = (): AuthState => current;
export function subscribeAuthState(l: Listener): () => void {
  listeners.add(l);
  l(current);
  return () => void listeners.delete(l);
}
/** Called by the API client when the BFF rejects the JWT twice. */
export function markSessionExpired(): void {
  if (current.status !== 'guest') emit({ status: 'guest', user: null });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const u = toUser(await account.get());
    emit({ status: 'authenticated', user: u });
    return u;
  } catch (err) {
    if (isUnauthorized(err)) {
      emit({ status: 'guest', user: null });
      return null;
    }
    if (current.status === 'loading') emit({ status: 'guest', user: null });
    throw toAuthError(err);
  }
}

export async function signIn(p: { email: string; password: string }): Promise<AuthUser> {
  try {
    await account.createEmailPasswordSession({ email: p.email, password: p.password });
    const u = toUser(await account.get());
    emit({ status: 'authenticated', user: u });
    return u;
  } catch (err) {
    throw toAuthError(err);
  }
}

export async function signUp(p: { email: string; password: string; name: string }): Promise<AuthUser> {
  try {
    await account.create({ userId: ID.unique(), email: p.email, password: p.password, name: p.name });
  } catch (err) {
    throw toAuthError(err);
  }
  return signIn({ email: p.email, password: p.password });
}

export async function signOut(): Promise<void> {
  try {
    await account.deleteSession({ sessionId: 'current' });
  } catch (err) {
    if (!isUnauthorized(err)) {
      emit({ status: 'guest', user: null });
      throw toAuthError(err);
    }
  }
  emit({ status: 'guest', user: null });
}

/** Google / Notion. Web never resolves (page navigates); native resolves after the browser returns. */
export async function signInWithOAuth(provider: OAuthProviderName): Promise<AuthUser> {
  const outcome = await openOAuth(provider);
  if (outcome.kind === 'redirecting') return new Promise<AuthUser>(() => undefined);
  if (outcome.kind === 'cancelled') throw new AuthError('oauth_cancelled');
  if (Platform.OS !== 'web' && !outcome.params.userId) throw new AuthError('oauth_failed');
  return completeOAuthSession(outcome.params);
}

/** Exchange redirected token for a session (idempotent; web cookie flow passes no params). */
export async function completeOAuthSession(params: OAuthReturnParams = {}): Promise<AuthUser> {
  try {
    if (params.userId && params.secret) {
      try {
        await account.createSession({ userId: params.userId, secret: params.secret });
      } catch {
        /* already exchanged by a sibling handler */
      }
    }
    const u = toUser(await account.get());
    emit({ status: 'authenticated', user: u });
    return u;
  } catch (err) {
    const m = toAuthError(err);
    throw m.code === 'network' ? m : new AuthError('oauth_failed');
  }
}

/** Short-lived JWT for the BFF. Never persist or log. */
export async function createJWT(): Promise<string> {
  try {
    return (await account.createJWT()).jwt;
  } catch (err) {
    const m = toAuthError(err);
    if (m.code === 'unauthorized' || m.code === 'session_expired') markSessionExpired();
    throw m;
  }
}

export async function sendEmailVerification(url: string): Promise<void> {
  try {
    await account.createVerification({ url });
  } catch (err) {
    throw toAuthError(err);
  }
}
export async function completeEmailVerification(p: { userId: string; secret: string }): Promise<void> {
  try {
    await account.updateVerification({ userId: p.userId, secret: p.secret });
    await getCurrentUser();
  } catch (err) {
    throw toAuthError(err);
  }
}
export async function requestPasswordRecovery(p: { email: string; url: string }): Promise<void> {
  try {
    await account.createRecovery({ email: p.email, url: p.url });
  } catch (err) {
    throw toAuthError(err);
  }
}
export async function completePasswordRecovery(p: { userId: string; secret: string; password: string }): Promise<void> {
  try {
    await account.updateRecovery({ userId: p.userId, secret: p.secret, password: p.password });
  } catch (err) {
    throw toAuthError(err);
  }
}
export async function setPassword(p: { password: string; oldPassword?: string }): Promise<void> {
  try {
    await account.updatePassword({ password: p.password, oldPassword: p.oldPassword });
  } catch (err) {
    throw toAuthError(err);
  }
}
export const assertAuthError = (err: unknown): AuthError => (err instanceof AuthError ? err : toAuthError(err));
