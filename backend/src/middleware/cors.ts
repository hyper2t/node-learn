import { cors } from 'hono/cors';

function isPrivateNetworkOrigin(origin: string): boolean {
  let protocol: string, hostname: string;
  try {
    const u = new URL(origin);
    protocol = u.protocol;
    hostname = u.hostname;
  } catch {
    return false;
  }
  if (protocol !== 'http:' && protocol !== 'https:') return false;
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1') return true;
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const o = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : -1));
  const [a, b] = o;
  if (a === undefined || b === undefined || o.some((x) => x < 0 || x > 255)) return false;
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

/** Explicit-origin CORS; auth rides in Authorization header so credentials are never allowed. */
export function corsMiddleware(origins: string[], options: { allowPrivateNetworkOrigins?: boolean } = {}) {
  const allow = new Set(origins);
  const allowPrivate = options.allowPrivateNetworkOrigins === true;
  return cors({
    origin: (origin) => (allow.has(origin) || (allowPrivate && isPrivateNetworkOrigin(origin)) ? origin : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id', 'X-Dev-User-Id'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 86_400,
    credentials: false,
  });
}
