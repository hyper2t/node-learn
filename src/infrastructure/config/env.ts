import { z } from 'zod';

/**
 * Public runtime configuration. Every value is inlined into the client bundle
 * by Expo (EXPO_PUBLIC_*), so NOTHING secret may ever be added here.
 * Business code must import `env` from this module, never read process.env.
 */
const schema = z.object({
  appwriteEndpoint: z.string().url(),
  appwriteProjectId: z.string().min(1),
  appwriteProjectName: z.string().min(1).default('KnowNode'),
  appwritePlatform: z.string().min(1).default('com.knownode.app'),
  apiBaseUrl: z.string().url(),
  apiMock: z.boolean(),
  webUrl: z.string().url(),
});

export type AppEnv = z.infer<typeof schema>;

function readBool(v: string | undefined, fallback = false): boolean {
  if (v === undefined || v === '') return fallback;
  return v === '1' || v.toLowerCase() === 'true';
}

// Access each variable statically so Metro can inline it.
const raw = {
  appwriteEndpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  appwriteProjectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  appwriteProjectName: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_NAME,
  appwritePlatform: process.env.EXPO_PUBLIC_APPWRITE_PLATFORM,
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8070',
  apiMock: readBool(process.env.EXPO_PUBLIC_API_MOCK, false),
  webUrl: process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:8071',
};

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`[env] Invalid EXPO_PUBLIC_* configuration: ${issues}`);
}

export const env: AppEnv = parsed.data;
export const APP_NAME = 'KnowNode';
