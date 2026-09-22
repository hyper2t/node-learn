/** Minimal structured logger. Never pass JWTs, API keys, emails, message bodies or upload URLs in meta. */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type LogLevel = keyof typeof LEVELS;
let threshold: number = LEVELS.info;

export function setLogLevel(level: LogLevel): void {
  threshold = LEVELS[level];
}

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < threshold) return;
  const text = JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta });
  if (level === 'error') console.error(text);
  else if (level === 'warn') console.warn(text);
  else console.log(text);
}
