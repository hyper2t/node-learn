/**
 * Server-authorised upload: BFF intent → direct Appwrite Storage upload with
 * the minted file id → BFF complete (locks permissions, binds to profile).
 */
import { api } from '@/infrastructure/api';
import type { UploadComplete, UploadIntent, UploadPurpose } from '@/types/api';
import type { PickedFile } from './pick';
import { storageCreateFile } from './storage';
import { UploadError, validateFile } from './limits';

export type UploadProgress = { loaded: number; total: number };
export type UploadedFile = { fileId: string; bucketId: string; name: string; mimeType: string; size: number; localUri: string };

export { UPLOAD_LIMITS, UploadError, validateFile } from './limits';

export async function uploadFile(purpose: UploadPurpose, f: PickedFile, opts: { relationId?: string; onProgress?: (p: UploadProgress) => void } = {}): Promise<UploadedFile> {
  validateFile(purpose, f);
  const size = f.size || (await sizeOf(f.uri));
  const intent = await api.post<UploadIntent>('/v1/uploads/intents', { purpose, fileName: f.name, mimeType: f.mimeType, sizeBytes: Math.max(1, size), relationId: opts.relationId });
  try {
    await storageCreateFile({ bucketId: intent.bucketId, fileId: intent.fileId, file: { ...f, size }, onProgress: opts.onProgress });
  } catch (e) {
    throw new UploadError('failed', e instanceof Error ? e.message : 'Upload failed.');
  }
  const done = await api.post<UploadComplete>('/v1/uploads/complete', { fileId: intent.fileId });
  return { fileId: done.fileId, bucketId: done.bucketId, name: f.name, mimeType: f.mimeType, size, localUri: f.uri };
}

async function sizeOf(uri: string): Promise<number> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return blob.size;
  } catch {
    return 0;
  }
}
