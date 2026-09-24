import { ID, Permission, Query, Role, Tokens } from 'node-appwrite';
import type { Attachment } from '../contracts/api';
import type { UploadIntent, UploadPurpose } from '../contracts/api';
import { getConfig } from '../config';
import { createRow, deleteRow, getRow, listRows, updateRow } from '../db/repo';
import type { ProfileRow, UploadIntentRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { getAdminClient, getStorage } from '../db/client';
import { conflict, forbidden, notFound, validation } from '../errors';
import { requireRelationMember } from './learning';

const DOCS = /^(image\/(jpeg|png|webp)|application\/(pdf|zip)|text\/(plain|markdown))$/;
const LIMITS: Record<UploadPurpose, { maxBytes: number; mime: RegExp }> = {
  avatar: { maxBytes: 2 * 1024 * 1024, mime: /^image\/(jpeg|png|webp)$/ },
  evidence: { maxBytes: 25 * 1024 * 1024, mime: DOCS },
  qa: { maxBytes: 25 * 1024 * 1024, mime: DOCS },
};

/**
 * Intent lifecycle: pending → complete (file verified, permissions set) → attached (bound to a
 * post). Q&A uploads that stay `complete` (abandoned drafts) are purged by retention.
 */
export const INTENT_ATTACHED = 'attached';

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
  const bucketId = input.purpose === 'avatar' ? cfg.avatarBucketId : input.purpose === 'qa' ? cfg.qaBucketId : cfg.evidenceBucketId;
  const fileId = ID.unique();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  await createRow<UploadIntentRow>(TABLES.uploadIntents, { userId, purpose: input.purpose, bucketId, fileId, relationId: input.relationId ?? null, fileName: input.fileName.slice(0, 255), mimeType: input.mimeType, sizeBytes: input.sizeBytes, status: 'pending', expiresAt }, fileId);
  return { bucketId, fileId, expiresAt };
}

/** After the client uploads, verify the object exists and lock permissions to the right people. */
export async function completeIntent(userId: string, fileId: string): Promise<{ fileId: string; bucketId: string }> {
  const intent = await getRow<UploadIntentRow>(TABLES.uploadIntents, fileId);
  if (!intent) throw notFound('not_found', 'Upload not found.');
  if (intent.userId !== userId) throw forbidden();
  if (intent.status === 'complete' || intent.status === INTENT_ATTACHED) return { fileId, bucketId: intent.bucketId };
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
  // Q&A is visible to every signed-in member; views still go through short-lived tokens.
  if (intent.purpose === 'qa') readers.push(Permission.read(Role.users()));
  if (intent.relationId) {
    const rel = await requireRelationMember(intent.relationId, userId);
    const other = rel.studentId === userId ? rel.teacherId : rel.studentId;
    readers.push(Permission.read(Role.user(other)));
  }
  await storage.updateFile({ bucketId: intent.bucketId, fileId, permissions: [...readers, Permission.delete(Role.user(userId))] });
  await updateRow(TABLES.uploadIntents, fileId, { status: 'complete' });
  if (intent.purpose === 'avatar') {
    const profile = await getRow<ProfileRow>(TABLES.profiles, userId);
    await updateRow(TABLES.profiles, userId, { avatarFileId: fileId });
    if (profile?.avatarFileId && profile.avatarFileId !== fileId) {
      await storage.deleteFile({ bucketId: getConfig().appwrite.avatarBucketId, fileId: profile.avatarFileId }).catch(() => undefined);
    }
  }
  return { fileId, bucketId: intent.bucketId };
}

/**
 * Evidence attachments must be complete uploads owned by the author for this
 * relation. Returns the ids in the order given (deduped).
 */
export async function assertEvidenceAttachments(userId: string, relationId: string, fileIds: string[]): Promise<string[]> {
  const ids = Array.from(new Set(fileIds)).slice(0, 5);
  if (!ids.length) return [];
  const rows = await listRows<UploadIntentRow>(TABLES.uploadIntents, [Query.equal('$id', ids), Query.limit(ids.length)]);
  for (const id of ids) {
    const row = rows.find((r) => r.$id === id);
    if (!row || row.userId !== userId || row.purpose !== 'evidence' || row.relationId !== relationId || row.status !== 'complete') {
      throw validation('One of the attachments is not a completed upload for this relation.', [{ path: 'attachmentFileIds', message: id }]);
    }
  }
  return ids;
}

/**
 * Q&A attachments must be the author's own finished `qa` uploads (complete, or already attached,
 * e.g. kept while editing). Returns ids deduped, in the order given.
 */
export async function assertQaAttachments(userId: string, fileIds: string[] | undefined, max = 5): Promise<string[]> {
  const ids = Array.from(new Set(fileIds ?? []));
  if (ids.length > max) throw validation(`You can attach up to ${max} files.`, [{ path: 'attachmentFileIds', message: `max ${max}` }]);
  if (!ids.length) return [];
  const rows = await listRows<UploadIntentRow>(TABLES.uploadIntents, [Query.equal('$id', ids), Query.limit(ids.length)]);
  for (const id of ids) {
    const row = rows.find((r) => r.$id === id);
    if (!row || row.userId !== userId || row.purpose !== 'qa' || (row.status !== 'complete' && row.status !== INTENT_ATTACHED)) {
      throw validation('One of the attachments is not a finished upload of yours.', [{ path: 'attachmentFileIds', message: id }]);
    }
  }
  return ids;
}

/** Marks uploads as bound to a post so the orphan purge leaves them alone. */
export async function markAttached(fileIds: string[]): Promise<void> {
  await Promise.all(fileIds.map((id) => updateRow(TABLES.uploadIntents, id, { status: INTENT_ATTACHED }).catch(() => undefined)));
}

/** Best effort: delete stored files and their intents (edits that drop files, removed content). */
export async function deleteUploads(fileIds: string[]): Promise<void> {
  if (!fileIds.length) return;
  const rows = await listRows<UploadIntentRow>(TABLES.uploadIntents, [Query.equal('$id', fileIds), Query.limit(fileIds.length)]);
  const storage = getStorage();
  await Promise.all(rows.map(async (r) => {
    await storage.deleteFile({ bucketId: r.bucketId, fileId: r.fileId }).catch(() => undefined);
    await deleteRow(TABLES.uploadIntents, r.$id).catch(() => undefined);
  }));
}

const TOKEN_TTL_MS = 30 * 60_000;
const tokenCache = new Map<string, { secret: string; expiresAt: number }>();

/** Short-lived, member-only view URLs. The caller has already been authorised on the evidence item. */
export async function resolveAttachments(fileIds: string[]): Promise<Attachment[]> {
  if (!fileIds.length) return [];
  const rows = await listRows<UploadIntentRow>(TABLES.uploadIntents, [Query.equal('$id', fileIds), Query.limit(fileIds.length)]);
  const cfg = getConfig().appwrite;
  const tokens = new Tokens(getAdminClient());
  const now = Date.now();
  const out: Attachment[] = [];
  for (const id of fileIds) {
    const row = rows.find((r) => r.$id === id);
    if (!row) continue;
    let tok = tokenCache.get(id);
    if (!tok || tok.expiresAt - 60_000 < now) {
      const expiresAt = now + TOKEN_TTL_MS;
      try {
        const t = await tokens.createFileToken({ bucketId: row.bucketId, fileId: id, expire: new Date(expiresAt).toISOString() });
        tok = { secret: t.secret, expiresAt };
        tokenCache.set(id, tok);
      } catch {
        continue; // file may have been deleted; omit rather than fail the whole item
      }
    }
    const url = `${cfg.endpoint}/storage/buckets/${row.bucketId}/files/${id}/view?project=${cfg.projectId}&token=${tok.secret}`;
    out.push({ fileId: id, fileName: row.fileName ?? 'attachment', mimeType: row.mimeType, sizeBytes: row.sizeBytes, url, expiresAt: new Date(tok.expiresAt).toISOString() });
  }
  return out;
}
