import { getConfig, resetConfigCache } from './config';
import { resetClients } from './db/client';
import { log, setLogLevel } from './log';
import { reconcileRecentProofs } from './services/proof-projection';
import { runTaskReminders } from './services/reminders';

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
    const stats = await runTaskReminders();
    // Independent of reminders: a failure here must not hide reminder stats.
    const proofs = await reconcileRecentProofs().catch((err: unknown) => { log('error', 'proof_reconcile_failure', { message: err instanceof Error ? err.message : String(err) }); return null; });
    return res.send(JSON.stringify({ ok: true, durationMs: Date.now() - started, stats, proofs }), 200, jsonHeaders);
  } catch (err) {
    log('error', 'reminders_function_failure', { message: err instanceof Error ? err.message : String(err) });
    return res.send(JSON.stringify({ ok: false, error: 'reminders_failed' }), 500, jsonHeaders);
  }
};
