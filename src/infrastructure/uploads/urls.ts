import { env } from '@/infrastructure/config/env';

/** Public avatar preview (bucket + file grant read("any") for avatars). */
export function avatarUrl(fileId: string | null | undefined, size = 128): string | null {
  if (!fileId) return null;
  return `${env.appwriteEndpoint}/storage/buckets/avatars/files/${fileId}/preview?project=${env.appwriteProjectId}&width=${size}&height=${size}&gravity=center&quality=80&output=webp`;
}
