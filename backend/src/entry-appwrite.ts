import { createApp } from './app';
import { resetConfigCache } from './config';
import { resetClients } from './db/client';
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
let app: ReturnType<typeof createApp> | null = null;
let activeKey = '';

/**
 * Prefer Appwrite's dynamic API key (scoped by `scopes` in appwrite.config.json, valid for this
 * execution only) over a static APPWRITE_API_KEY variable. Rotating key ⇒ rebuild admin clients.
 */
function adoptDynamicKey(headers: Record<string, string>): void {
  const dyn = headers['x-appwrite-key'];
  const key = dyn || process.env.APPWRITE_API_KEY || '';
  if (key && key !== activeKey) {
    process.env.APPWRITE_API_KEY = key;
    activeKey = key;
    resetConfigCache();
    resetClients();
  }
  app ??= createApp();
}

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
  adoptDynamicKey(req.headers ?? {});
  const method = req.method.toUpperCase();
  const raw = BODY_METHODS.has(method) ? rawBody(req) : '';
  const request = new Request(buildUrl(req), { method, headers: req.headers, body: raw || undefined });
  try {
    const response = await app!.fetch(request);
    const body = await response.text();
    return res.send(body, response.status, Object.fromEntries(response.headers.entries()));
  } catch (err) {
    // app.onError handles HttpErrors; this only catches adapter-level failures. Keep the envelope shape.
    log('error', 'function_adapter_failure', { method, message: err instanceof Error ? err.message : String(err) });
    return res.send(JSON.stringify({ requestId: 'unknown', data: null, error: { code: 'internal', message: 'Something went wrong. Try again shortly.' } }), 500, { 'content-type': 'application/json; charset=utf-8' });
  }
};
