import { Storage } from 'appwrite';
import { client } from '@/infrastructure/appwrite/client.web';
import type { PickedFile } from './pick';
import type { UploadProgress } from './upload';

// Import the web client directly so TypeScript (which resolves the bare
// `client` module to native) checks this file against the web SDK types.
const storage = new Storage(client);

/** Web: turn the picker's blob/data URI into a File and stream it to Storage. */
export async function storageCreateFile(p: { bucketId: string; fileId: string; file: PickedFile; onProgress?: (u: UploadProgress) => void }): Promise<void> {
  const res = await fetch(p.file.uri);
  const blob = await res.blob();
  const file = new File([blob], p.file.name, { type: p.file.mimeType || blob.type });
  await storage.createFile({ bucketId: p.bucketId, fileId: p.fileId, file, onProgress: (u) => p.onProgress?.({ loaded: u.chunksUploaded, total: u.chunksTotal }) });
}
