import { log, setLogLevel } from './log';
import { runHealthcheck } from './services/healthcheck';

type AppwriteResponse = { send: (body: string, statusCode?: number, headers?: Record<string, string>) => unknown };

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };

export default async ({ res }: { res: AppwriteResponse }): Promise<unknown> => {
  try {
    const level = process.env.LOG_LEVEL;
    if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') setLogLevel(level);
    const result = await runHealthcheck();
    return res.send(JSON.stringify({ ok: result.ok, result }), result.ok ? 200 : 503, jsonHeaders);
  } catch (err) {
    log('error', 'healthcheck_function_failure', { message: err instanceof Error ? err.message : String(err) });
    return res.send(JSON.stringify({ ok: false, error: 'healthcheck_failed' }), 500, jsonHeaders);
  }
};

