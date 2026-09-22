import { ID, Permission, Role } from 'node-appwrite';
import type { UploadIntent, UploadPurpose } from '../contracts/api';
import { getConfig } from '../config';
import { createRow, getRow, updateRow } from '../db/repo';
import type { UploadIntentRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { getStorage } from '../db/client';
import { conflict, forbidden, notFound, validation } from '../errors';
import { requireRelationMember } from './learning';

const LIMITS: Record<UploadPurpose, { maxBytes: number; mime: RegExp }> = {
  avatar: { maxBytes: 2 * 1024 * 1024, mime: /^image\/(jpeg|png|webp)$/ },
  evidence: { maxBytes: 25 * 1024 * 1024, mime: /^(image\/(jpeg|png|webp)|application\/(pdf|zip)|text\/(plain|markdown))$/ },
};

/**
 * Server-authorised upload: we mint the file ID and record intent; the client
 * uploads directly to Appwrite Storage with that ID (file-level permissions
 * are applied on complete). Unfinished intents expire.
 */
export async function createIntent(userId: string, input: { purpose: UploadPurpose; fileName: string; mimeType: string; sizeBytes: number; relationId?: string }): Promise<UploadIntent> {
  const lim = LIMITS[input.purpose];
  if (input.sizeBytes > lim.maxBytes) throw validation('This file is too large.', [{ path: 'sizeBytes', message: `max ${lim.maxBytes}` }]);
  if (!lim.mime.test(input.mimeType)) throw validation('This file type is not supported.', [{ path: 'mimeType', message: 'unsupported' }]);
  if (input.purpose === 'evidence') {
    if (!input.relationId) throw validation('Evidence uploads need a learning relation.', [{ path: 'relationId', message: 'required' }]);
    await requireRelationMember(input.relationId, userId);
  }
  const cfg = getConfig().appwrite;
  const bucketId = input.purpose === 'avatar' ? cfg.avatarBucketId : cfg.evidenceBucketId;
  const fileId = ID.unique();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  await createRow<UploadIntentRow>(TABLES.uploadIntents, { userId, purpose: input.purpose, bucketId, fileId, relationId: input.relationId ?? null, mimeType: input.mimeType, sizeBytes: input.sizeBytes, status: 'pending', expiresAt }, fileId);
  return { bucketId, fileId, expiresAt };
}

/** After the client uploads, verify the object exists and lock permissions to the right people. */
export async function completeIntent(userId: string, fileId: string): Promise<{ fileId: string; bucketId: string }> {
  const intent = await getRow<UploadIntentRow>(TABLES.uploadIntents, fileId);
  if (!intent) throw notFound('not_found', 'Upload not found.');
  if (intent.userId !== userId) throw forbidden();
  if (intent.status === 'complete') return { fileId, bucketId: intent.bucketId };
  if (new Date(intent.expiresAt).getTime() < Date.now()) throw conflict('invalid_state', 'This upload has expired. Start again.');
  const storage = getStorage();
  const file = await storage.getFile({ bucketId: intent.bucketId, fileId }).catch(() => null);
  if (!file) throw conflict('invalid_state', 'The file has not been uploaded yet.');
  if (file.sizeOriginal > intent.sizeBytes * 1.05 + 1024) {
    await storage.deleteFile({ bucketId: intent.bucketId, fileId });
    throw validation('Uploaded file does not match the declared size.');
  }
  const readers = [Permission.read(Role.user(userId))];
  if (intent.purpose === 'avatar') readers.push(Permission.read(Role.any()));
  if (intent.relationId) {
    const rel = await requireRelationMember(intent.relationId, userId);
    const other = rel.studentId === userId ? rel.teacherId : rel.studentId;
    readers.push(Permission.read(Role.user(other)));
  }
  await storage.updateFile({ bucketId: intent.bucketId, fileId, permissions: [...readers, Permission.delete(Role.user(userId))] });
  await updateRow(TABLES.uploadIntents, fileId, { status: 'complete' });
  if (intent.purpose === 'avatar') await updateRow(TABLES.profiles, userId, { avatarFileId: fileId });
  return { fileId, bucketId: intent.bucketId };
}
