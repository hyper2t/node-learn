import type { Models } from 'node-appwrite';
import { getStorage } from '../db/client';
import { deleteRow, listRows, Query, updateRow } from '../db/repo';
import type { AuditEventRow, EvidenceItemRow, IdempotencyKeyRow, MessageRow, NotificationRow, ProfileRow, QaAnswerRow, QaQuestionRow, ReportRow, UploadIntentRow } from '../db/rows';
import { autoCloseCutoff } from './qa-policy';
import { TABLES, type TableId } from '../db/schema';
import { log } from '../log';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_BATCHES = 20;

export type RetentionPurgeOptions = {
  now?: Date;
  batchSize?: number;
  maxBatches?: number;
};

export type RetentionPurgeStats = {
  expiredUploadIntentsDeleted: number;
  uploadFilesDeleted: number;
  idempotencyKeysDeleted: number;
  notificationsDeleted: number;
  reportsDeleted: number;
  auditEventsDeleted: number;
  deletedProfilesScanned: number;
  deletedMemberMessagesDeleted: number;
  deletedMemberUploadIntentsDeleted: number;
  evidenceAttachmentRefsCleared: number;
  deletedMemberQaQuestionsDeleted: number;
  deletedMemberQaAnswersDeleted: number;
  qaQuestionsAutoClosed: number;
  qaOrphanUploadsDeleted: number;
};

function blankStats(): RetentionPurgeStats {
  return {
    expiredUploadIntentsDeleted: 0,
    uploadFilesDeleted: 0,
    idempotencyKeysDeleted: 0,
    notificationsDeleted: 0,
    reportsDeleted: 0,
    auditEventsDeleted: 0,
    deletedProfilesScanned: 0,
    deletedMemberMessagesDeleted: 0,
    deletedMemberUploadIntentsDeleted: 0,
    evidenceAttachmentRefsCleared: 0,
    deletedMemberQaQuestionsDeleted: 0,
    deletedMemberQaAnswersDeleted: 0,
    qaQuestionsAutoClosed: 0,
    qaOrphanUploadsDeleted: 0,
  };
}

function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

function isMissing(err: unknown): boolean {
  const e = err as { code?: number; type?: string; response?: { code?: number } } | null;
  return e?.code === 404 || e?.response?.code === 404 || (e?.type ?? '').includes('not_found');
}

async function deleteStorageFile(bucketId: string, fileId: string): Promise<boolean> {
  try {
    await getStorage().deleteFile({ bucketId, fileId });
    return true;
  } catch (err) {
    if (isMissing(err)) return false;
    log('warn', 'retention_storage_delete_failed', { reason: err instanceof Error ? err.name : typeof err });
    throw err;
  }
}

async function deleteRows<T extends Models.Row>(
  tableId: TableId,
  queries: string[],
  options: Required<Pick<RetentionPurgeOptions, 'batchSize' | 'maxBatches'>>,
  beforeDelete?: (row: T) => Promise<void>,
): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < options.maxBatches; batch++) {
    const rows = await listRows<T>(tableId, [...queries, Query.limit(options.batchSize)]);
    if (!rows.length) break;
    for (const row of rows) {
      if (beforeDelete) await beforeDelete(row);
      await deleteRow(tableId, row.$id);
      deleted++;
    }
    if (rows.length < options.batchSize) break;
  }
  return deleted;
}

async function purgeExpiredUploadIntents(stats: RetentionPurgeStats, now: Date, options: Required<Pick<RetentionPurgeOptions, 'batchSize' | 'maxBatches'>>): Promise<void> {
  const cutoff = daysAgo(now, 1);
  stats.expiredUploadIntentsDeleted += await deleteRows<UploadIntentRow>(
    TABLES.uploadIntents,
    [Query.equal('status', 'pending'), Query.lessThan('expiresAt', cutoff)],
    options,
    async (row) => { if (await deleteStorageFile(row.bucketId, row.fileId)) stats.uploadFilesDeleted++; },
  );
}

/** Q&A uploads finished but never attached to a post (abandoned drafts) go after a day. */
async function purgeOrphanQaUploads(stats: RetentionPurgeStats, now: Date, options: Required<Pick<RetentionPurgeOptions, 'batchSize' | 'maxBatches'>>): Promise<void> {
  const cutoff = daysAgo(now, 1);
  stats.qaOrphanUploadsDeleted += await deleteRows<UploadIntentRow>(
    TABLES.uploadIntents,
    [Query.equal('purpose', 'qa'), Query.equal('status', 'complete'), Query.lessThan('updatedAt', cutoff)],
    options,
    async (row) => { if (await deleteStorageFile(row.bucketId, row.fileId)) stats.uploadFilesDeleted++; },
  );
}

async function purgeDeletedMemberData(stats: RetentionPurgeStats, now: Date, options: Required<Pick<RetentionPurgeOptions, 'batchSize' | 'maxBatches'>>): Promise<void> {
  const cutoff = daysAgo(now, 30);
  const profiles = await listRows<ProfileRow>(TABLES.profiles, [Query.equal('status', 'deleted'), Query.lessThan('updatedAt', cutoff), Query.orderAsc('updatedAt'), Query.limit(options.batchSize)]);
  stats.deletedProfilesScanned += profiles.length;
  for (const profile of profiles) {
    const userId = profile.$id;
    stats.deletedMemberMessagesDeleted += await deleteRows<MessageRow>(TABLES.messages, [Query.equal('senderId', userId)], options);

    for (let batch = 0; batch < options.maxBatches; batch++) {
      const evidenceRows = await listRows<EvidenceItemRow>(TABLES.evidenceItems, [Query.equal('authorId', userId), Query.limit(options.batchSize), Query.offset(batch * options.batchSize)]);
      if (!evidenceRows.length) break;
      for (const evidence of evidenceRows) {
        if ((evidence.attachmentFileIds?.length ?? 0) > 0) {
          await updateRow(TABLES.evidenceItems, evidence.$id, { attachmentFileIds: [] });
          stats.evidenceAttachmentRefsCleared++;
        }
      }
      if (evidenceRows.length < options.batchSize) break;
    }

    // Q&A: a deleted member's questions go (with every answer under them), as do their answers elsewhere.
    stats.deletedMemberQaQuestionsDeleted += await deleteRows<QaQuestionRow>(TABLES.qaQuestions, [Query.equal('authorId', userId)], options, async (question) => {
      stats.deletedMemberQaAnswersDeleted += await deleteRows<QaAnswerRow>(TABLES.qaAnswers, [Query.equal('questionId', question.$id)], options);
    });
    stats.deletedMemberQaAnswersDeleted += await deleteRows<QaAnswerRow>(TABLES.qaAnswers, [Query.equal('authorId', userId)], options);

    stats.deletedMemberUploadIntentsDeleted += await deleteRows<UploadIntentRow>(
      TABLES.uploadIntents,
      [Query.equal('userId', userId)],
      options,
      async (row) => { if (await deleteStorageFile(row.bucketId, row.fileId)) stats.uploadFilesDeleted++; },
    );
  }
}

/** Close questions idle for QA_AUTO_CLOSE_DAYS so nothing lingers unanswered ("not a thread that goes cold"). */
async function autoCloseQuestions(stats: RetentionPurgeStats, now: Date, options: Required<Pick<RetentionPurgeOptions, 'batchSize' | 'maxBatches'>>): Promise<void> {
  const cutoff = autoCloseCutoff(now);
  for (const status of ['open', 'answered']) {
    for (let batch = 0; batch < options.maxBatches; batch++) {
      const rows = await listRows<QaQuestionRow>(TABLES.qaQuestions, [Query.equal('status', status), Query.lessThan('lastActivityAt', cutoff), Query.limit(options.batchSize)]);
      if (!rows.length) break;
      for (const row of rows) {
        await updateRow(TABLES.qaQuestions, row.$id, { status: 'closed' });
        stats.qaQuestionsAutoClosed++;
      }
      if (rows.length < options.batchSize) break;
    }
  }
}

/** Scheduled production retention/deletion purge. Safe to re-run; missing rows/files are ignored. */
export async function runRetentionPurge(opts: RetentionPurgeOptions = {}): Promise<RetentionPurgeStats> {
  const now = opts.now ?? new Date();
  const options = {
    batchSize: opts.batchSize ?? DEFAULT_BATCH_SIZE,
    maxBatches: opts.maxBatches ?? DEFAULT_MAX_BATCHES,
  };
  const stats = blankStats();
  log('info', 'retention_purge_started');

  await purgeExpiredUploadIntents(stats, now, options);
  await purgeOrphanQaUploads(stats, now, options);
  await purgeDeletedMemberData(stats, now, options);
  await autoCloseQuestions(stats, now, options);
  stats.idempotencyKeysDeleted += await deleteRows<IdempotencyKeyRow>(TABLES.idempotencyKeys, [Query.lessThan('createdAt', daysAgo(now, 1))], options);
  stats.notificationsDeleted += await deleteRows<NotificationRow>(TABLES.notifications, [Query.lessThan('createdAt', daysAgo(now, 90))], options);
  stats.reportsDeleted += await deleteRows<ReportRow>(TABLES.reports, [Query.equal('status', 'resolved'), Query.lessThan('resolvedAt', daysAgo(now, 365))], options);
  stats.auditEventsDeleted += await deleteRows<AuditEventRow>(TABLES.auditEvents, [Query.lessThan('createdAt', daysAgo(now, 365))], options);

  log('info', 'retention_purge_finished', stats);
  return stats;
}

