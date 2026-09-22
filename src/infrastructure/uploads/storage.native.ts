import { storage } from '@/infrastructure/appwrite/client';
import type { PickedFile } from './pick';
import type { UploadProgress } from './upload';

/** Native: react-native-appwrite accepts { name, type, size, uri }. */
export async function storageCreateFile(p: { bucketId: string; fileId: string; file: PickedFile; onProgress?: (u: UploadProgress) => void }): Promise<void> {
  await storage.createFile({
    bucketId: p.bucketId, fileId: p.fileId,
    file: { name: p.file.name, type: p.file.mimeType, size: p.file.size, uri: p.file.uri },
    onProgress: (u) => p.onProgress?.({ loaded: u.chunksUploaded, total: u.chunksTotal }),
  });
}
