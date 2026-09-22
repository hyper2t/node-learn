import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** Server-side runtime configuration. Read from env at process start; fails fast with every problem listed. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8070),

  APPWRITE_ENDPOINT: z.string().url(),
  APPWRITE_PROJECT_ID: z.string().min(1),
  /** Optional in the Function runtime: the adapter injects the per-execution dynamic key (x-appwrite-key). */
  APPWRITE_API_KEY: z.string().default(''),
  APPWRITE_DATABASE_ID: z.string().min(1).default('main'),
  APPWRITE_ADMIN_TEAM_ID: z.string().default(''),
  APPWRITE_EVIDENCE_BUCKET_ID: z.string().default('evidence'),
  APPWRITE_AVATAR_BUCKET_ID: z.string().default('avatars'),

  CORS_ORIGINS: z.string().default('http://localhost:8071'),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(120),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  API_DEV_BYPASS_USER_ID: z.string().default(''),
  /** Minimum self-declared age band allowed to use the product. Legal review pending. */
  MIN_AGE_BAND: z.enum(['16_17', '18_plus']).default('16_17'),
});

export type Env = z.infer<typeof envSchema>;

export type Config = {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  port: number;
  appwrite: {
    endpoint: string;
    projectId: string;
    apiKey: string;
    databaseId: string;
    adminTeamId: string | null;
    evidenceBucketId: string;
    avatarBucketId: string;
  };
  corsOrigins: string[];
  rateLimitPerMin: number;
  logLevel: Env['LOG_LEVEL'];
  devBypassUserId: string | null;
  minAgeBand: Env['MIN_AGE_BAND'];
};

/** Load backend/.env without a dotenv dependency (Node >= 20.12). */
function loadDotEnv(): void {
  const load = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  if (typeof load !== 'function') return;
  let here: string;
  try {
    here = fileURLToPath(new URL('.', import.meta.url));
  } catch {
    return;
  }
  for (const name of ['.env', '.env.local']) {
    try {
      load.call(process, resolve(here, '..', name));
    } catch {
      // absent
    }
  }
}

const toNullable = (v: string): string | null => (v === '' ? null : v);

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached) return cached;
  loadDotEnv();
  // Inside an Appwrite Function the runtime already tells us where we are.
  process.env.APPWRITE_ENDPOINT ||= process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  process.env.APPWRITE_PROJECT_ID ||= process.env.APPWRITE_FUNCTION_PROJECT_ID;
  if (process.env.APPWRITE_FUNCTION_ID && !process.env.NODE_ENV) process.env.NODE_ENV = 'production';
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`[config] Invalid environment: ${issues}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';
  cached = {
    env: e.NODE_ENV,
    isProduction,
    port: e.PORT,
    appwrite: {
      endpoint: e.APPWRITE_ENDPOINT,
      projectId: e.APPWRITE_PROJECT_ID,
      apiKey: e.APPWRITE_API_KEY,
      databaseId: e.APPWRITE_DATABASE_ID,
      adminTeamId: toNullable(e.APPWRITE_ADMIN_TEAM_ID),
      evidenceBucketId: e.APPWRITE_EVIDENCE_BUCKET_ID,
      avatarBucketId: e.APPWRITE_AVATAR_BUCKET_ID,
    },
    corsOrigins: e.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    rateLimitPerMin: e.RATE_LIMIT_PER_MIN,
    logLevel: e.LOG_LEVEL,
    devBypassUserId: isProduction ? null : toNullable(e.API_DEV_BYPASS_USER_ID),
    minAgeBand: e.MIN_AGE_BAND,
  };
  return cached;
}

export function resetConfigCache(): void {
  cached = null;
}
