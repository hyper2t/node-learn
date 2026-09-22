import { env } from '@/infrastructure/config/env';
import { createJWT, getAuthState, markSessionExpired } from '@/infrastructure/appwrite';
import type { ApiResponse } from '@/types/api';
import { ApiError, apiErrorFromBody, toApiError } from './errors';

export type AuthMode = 'auto' | 'required' | 'none';
export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  auth?: AuthMode;
  idempotencyKey?: string;
  headers?: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const JWT_TTL_MS = 15 * 60_000;
const JWT_REFRESH_MARGIN_MS = 60_000;

// In-memory JWT cache: never persisted, never logged.
let jwtCache: { token: string; expiresAt: number } | null = null;
let jwtInflight: Promise<string> | null = null;
export function clearJwtCache(): void {
  jwtCache = null;
  jwtInflight = null;
}
async function getJwt(force = false): Promise<string> {
  const now = Date.now();
  if (!force && jwtCache && jwtCache.expiresAt - JWT_REFRESH_MARGIN_MS > now) return jwtCache.token;
  if (!force && jwtInflight) return jwtInflight;
  jwtInflight = (async () => {
    try {
      const token = await createJWT();
      jwtCache = { token, expiresAt: Date.now() + JWT_TTL_MS };
      return token;
    } finally {
      jwtInflight = null;
    }
  })();
  return jwtInflight;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = env.apiBaseUrl.replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const parts = Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `${url}?${parts.join('&')}` : url;
}

function combineSignals(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return { signal: controller.signal, didTimeout: () => timedOut, cleanup: () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); } };
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, timeoutMs = DEFAULT_TIMEOUT_MS, auth = 'auto' } = options;
  const signedIn = getAuthState().status === 'authenticated';
  if (auth === 'required' && !signedIn) throw new ApiError('unauthorized', 'Sign in to continue.', { status: 401 });
  const useAuth = auth !== 'none' && signedIn;
  const url = buildUrl(path, query);

  const doFetch = async (token: string | null): Promise<Response> => {
    const c = combineSignals(signal, timeoutMs);
    try {
      return await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
          ...options.headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: c.signal,
      });
    } catch (err) {
      if (c.didTimeout()) throw new ApiError('timeout', 'The request timed out.');
      if (signal?.aborted) throw new ApiError('aborted', 'Request cancelled');
      throw toApiError(err);
    } finally {
      c.cleanup();
    }
  };

  let token: string | null = useAuth ? await getJwt() : null;
  let res = await doFetch(token);
  // Exactly one refresh-and-retry on 401.
  if (res.status === 401 && useAuth) {
    clearJwtCache();
    try {
      token = await getJwt(true);
    } catch {
      markSessionExpired();
      throw new ApiError('unauthorized', 'Your session expired. Sign in again.', { status: 401 });
    }
    res = await doFetch(token);
    if (res.status === 401) {
      clearJwtCache();
      markSessionExpired();
      throw new ApiError('unauthorized', 'Your session expired. Sign in again.', { status: 401 });
    }
  }
  const parsed = (await parseBody(res)) as ApiResponse<T> | null;
  if (!res.ok) throw apiErrorFromBody(res.status, parsed);
  if (parsed && typeof parsed === 'object' && 'data' in parsed) return parsed.data as T;
  return parsed as unknown as T;
}

export const api = {
  get: <T>(path: string, o?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...o, method: 'GET' }),
  post: <T>(path: string, body?: unknown, o?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...o, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, o?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...o, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, o?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...o, method: 'PATCH', body }),
  delete: <T>(path: string, o?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...o, method: 'DELETE' }),
};

/** Random idempotency key for business writes. */
export function newIdempotencyKey(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID ? g.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
