export type ApiErrorKind = 'network' | 'timeout' | 'aborted' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'rate_limited' | 'server' | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** Stable server code (e.g. `duplicate_request`, `email_not_verified`). */
  readonly code: string | undefined;
  readonly details: unknown;
  readonly requestId: string | undefined;
  constructor(kind: ApiErrorKind, message: string, o: { status?: number; code?: string; details?: unknown; requestId?: string } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = o.status ?? 0;
    this.code = o.code;
    this.details = o.details;
    this.requestId = o.requestId;
  }
  get isRetryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server';
  }
}

export function kindFromStatus(s: number): ApiErrorKind {
  if (s === 401) return 'unauthorized';
  if (s === 403) return 'forbidden';
  if (s === 404) return 'not_found';
  if (s === 409) return 'conflict';
  if (s === 400 || s === 422) return 'validation';
  if (s === 429) return 'rate_limited';
  if (s >= 500) return 'server';
  return 'unknown';
}

export function apiErrorFromBody(status: number, body: unknown): ApiError {
  const b = body as { requestId?: string; error?: { code?: string; message?: string; details?: unknown } } | null;
  return new ApiError(kindFromStatus(status), b?.error?.message || `Request failed (${status})`, { status, code: b?.error?.code, details: b?.error?.details, requestId: b?.requestId });
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if ((err as { name?: string } | null)?.name === 'AbortError') return new ApiError('aborted', 'Request cancelled');
  if (err instanceof TypeError) return new ApiError('network', 'Network unavailable');
  return new ApiError('unknown', err instanceof Error ? err.message : 'Unknown error');
}
