import { getConfig, resetConfigCache } from './config';
import { resetClients } from './db/client';
import { log, setLogLevel } from './log';
import { runRetentionPurge } from './services/retention';

type AppwriteRequest = { headers?: Record<string, string> };
type AppwriteResponse = { send: (body: string, statusCode?: number, headers?: Record<string, string>) => unknown };

let activeKey = '';

function adoptDynamicKey(headers: Record<string, string>): void {
  const dyn = headers['x-appwrite-key'];
  const key = dyn || process.env.APPWRITE_API_KEY || '';
  if (key && key !== activeKey) {
    process.env.APPWRITE_API_KEY = key;
    activeKey = key;
    resetConfigCache();
    resetClients();
  }
}

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };

export default async ({ req, res }: { req: AppwriteRequest; res: AppwriteResponse }): Promise<unknown> => {
  const started = Date.now();
  adoptDynamicKey(req.headers ?? {});
  try {
    setLogLevel(getConfig().logLevel);
    const stats = await runRetentionPurge();
    return res.send(JSON.stringify({ ok: true, durationMs: Date.now() - started, stats }), 200, jsonHeaders);
  } catch (err) {
    log('error', 'retention_function_failure', { message: err instanceof Error ? err.message : String(err) });
    return res.send(JSON.stringify({ ok: false, error: 'retention_failed' }), 500, jsonHeaders);
  }
};

