import { createApp } from './app';
import { log } from './log';

/** Appwrite Function adapter: translate runtime req/res ↔ Web Request/Response. No business logic here. */
type AppwriteRequest = {
  body?: string | Record<string, unknown>;
  headers: Record<string, string>;
  method: string;
  path: string;
  query: Record<string, string>;
  queryString: string;
};
type AppwriteResponse = { send: (body: string, statusCode?: number, headers?: Record<string, string>) => unknown };

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const app = createApp();

function rawBody(req: AppwriteRequest): string {
  const b = req.body;
  if (typeof b === 'string') return b;
  if (b && typeof b === 'object') return JSON.stringify(b);
  return '';
}

function buildUrl(req: AppwriteRequest): string {
  const q = req.queryString ? (req.queryString.startsWith('?') ? req.queryString : `?${req.queryString}`) : '';
  return `http://appwrite.internal${req.path.startsWith('/') ? req.path : `/${req.path}`}${q}`;
}

export default async ({ req, res }: { req: AppwriteRequest; res: AppwriteResponse }): Promise<unknown> => {
  const method = req.method.toUpperCase();
  const raw = BODY_METHODS.has(method) ? rawBody(req) : '';
  const request = new Request(buildUrl(req), { method, headers: req.headers, body: raw || undefined });
  const started = Date.now();
  const response = await app.fetch(request);
  const body = await response.text();
  log('info', 'request', { method, path: req.path, status: response.status, ms: Date.now() - started });
  return res.send(body, response.status, Object.fromEntries(response.headers.entries()));
};
