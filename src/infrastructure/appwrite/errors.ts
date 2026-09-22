export type AuthErrorCode =
  | 'invalid_credentials' | 'user_exists' | 'user_not_found' | 'invalid_email' | 'weak_password'
  | 'rate_limited' | 'session_expired' | 'unauthorized' | 'oauth_cancelled' | 'oauth_failed' | 'network' | 'unknown';

/** Stable auth error; UI maps `code` to an i18n string. */
export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number | undefined;
  constructor(code: AuthErrorCode, status?: number) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

type Like = { code?: unknown; type?: unknown; name?: unknown };

export function toAuthError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;
  const e = (err ?? {}) as Like;
  const status = typeof e.code === 'number' ? e.code : undefined;
  const type = typeof e.type === 'string' ? e.type : '';
  if (e.name === 'TypeError' || type === 'network' || status === 0) return new AuthError('network', status);
  switch (type) {
    case 'user_invalid_credentials': return new AuthError('invalid_credentials', status);
    case 'user_already_exists':
    case 'user_email_already_exists': return new AuthError('user_exists', status);
    case 'user_not_found': return new AuthError('user_not_found', status);
    case 'user_password_mismatch':
    case 'password_recently_used':
    case 'password_personal_data': return new AuthError('weak_password', status);
    case 'general_rate_limit_exceeded': return new AuthError('rate_limited', status);
    case 'user_session_not_found':
    case 'user_jwt_invalid': return new AuthError('session_expired', status);
    default: break;
  }
  if (status === 401) return new AuthError('unauthorized', status);
  if (status === 409) return new AuthError('user_exists', status);
  if (status === 429) return new AuthError('rate_limited', status);
  if (status === 400) return new AuthError('invalid_email', status);
  return new AuthError('unknown', status);
}

export function isUnauthorized(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 401 || (err instanceof AuthError && (err.code === 'unauthorized' || err.code === 'session_expired'));
}
