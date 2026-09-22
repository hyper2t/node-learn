import type { ApiFailure, ApiSuccess } from './contracts/api';
import { log } from './log';

/** Stable error vocabulary. Clients match `code`, never the English message. */
export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'email_not_verified'
  | 'age_gate_required'
  | 'role_required'
  | 'route_not_found'
  | 'not_found'
  | 'user_not_found'
  | 'handle_taken'
  | 'conflict'
  | 'invalid_state'
  | 'blocked'
  | 'not_member'
  | 'duplicate_request'
  | 'request_in_progress'
  | 'validation'
  | 'payload_too_large'
  | 'rate_limited'
  | 'service_unavailable'
  | 'internal';

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;
  readonly headers: Record<string, string>;
  constructor(status: number, code: ErrorCode, message: string, opts: { details?: unknown; headers?: Record<string, string> } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = opts.details;
    this.headers = opts.headers ?? {};
  }
}

export type ValidationField = { path: string; message: string };

export const unauthorized = (msg = 'Sign in to continue.'): HttpError => new HttpError(401, 'unauthorized', msg);
export const forbidden = (msg = 'You do not have access to this.'): HttpError => new HttpError(403, 'forbidden', msg);
export const emailNotVerified = (): HttpError => new HttpError(403, 'email_not_verified', 'Verify your email to continue.');
export const ageGateRequired = (): HttpError => new HttpError(403, 'age_gate_required', 'Confirm your age and privacy choices first.');
export const roleRequired = (role: string): HttpError => new HttpError(403, 'role_required', `This action needs the ${role} role.`);
export const notFound = (code: 'route_not_found' | 'not_found' | 'user_not_found', message: string): HttpError => new HttpError(404, code, message);
export const conflict = (
  code: 'conflict' | 'handle_taken' | 'invalid_state' | 'blocked' | 'not_member' | 'duplicate_request' | 'request_in_progress',
  message: string,
  details?: unknown,
): HttpError => new HttpError(409, code, message, { details });
export const payloadTooLarge = (limitBytes: number): HttpError => new HttpError(413, 'payload_too_large', `Request body exceeds ${limitBytes} bytes.`);
export const validation = (message: string, fields?: ValidationField[]): HttpError =>
  new HttpError(422, 'validation', message, fields ? { details: { fields } } : {});
export const rateLimited = (retryAfterSeconds: number): HttpError =>
  new HttpError(429, 'rate_limited', 'Too many requests. Try again shortly.', {
    headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  });
export const internal = (): HttpError => new HttpError(500, 'internal', 'Something went wrong. Try again shortly.');
export const serviceUnavailable = (msg = 'This service is not available right now.'): HttpError => new HttpError(503, 'service_unavailable', msg);

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' } as const;

export function ok<T>(requestId: string, data: T, status = 200, headers: Record<string, string> = {}): Response {
  const body: ApiSuccess<T> = { requestId, data, error: null };
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function failure(requestId: string, err: HttpError): Response {
  const body: ApiFailure = { requestId, data: null, error: { code: err.code, message: err.message, details: err.details } };
  return new Response(JSON.stringify(body), { status: err.status, headers: { ...JSON_HEADERS, ...err.headers } });
}

export function toErrorResponse(err: unknown, context: { requestId: string; path?: string }): Response {
  if (err instanceof HttpError) return failure(context.requestId, err);
  log('error', 'unhandled_error', {
    requestId: context.requestId,
    path: context.path,
    name: err instanceof Error ? err.name : typeof err,
    message: err instanceof Error ? err.message : String(err),
  });
  return failure(context.requestId, internal());
}
