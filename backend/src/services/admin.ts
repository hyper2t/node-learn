import { Query } from 'node-appwrite';
import type { ReportAction, ReportItem } from '../contracts/api';
import { getUsers } from '../db/client';
import { getRow, listRows, updateRow } from '../db/repo';
import type { LearningRelationRow, ReportRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { conflict, notFound } from '../errors';
import { toReportItem } from '../mappers/notifications';
import { audit, emitEvent } from './events';
import { notify } from './notifications';
import { personRefs } from './profiles';

export async function listReports(p: { status?: 'open' | 'resolved'; limit: number; cursor?: string }): Promise<{ items: ReportItem[]; nextCursor: string | null }> {
  const q = [Query.orderDesc('createdAt'), Query.limit(p.limit + 1)];
  if (p.status) q.push(Query.equal('status', p.status));
  if (p.cursor) q.push(Query.cursorAfter(p.cursor));
  const rows = await listRows<ReportRow>(TABLES.reports, q);
  const hasMore = rows.length > p.limit;
  const page = hasMore ? rows.slice(0, p.limit) : rows;
  const refs = await personRefs(page.flatMap((r) => [r.reporterId, r.targetUserId]));
  const last = page[page.length - 1];
  return { items: page.map((r) => toReportItem(r, refs.get(r.reporterId)!, refs.get(r.targetUserId)!)), nextCursor: hasMore && last ? last.$id : null };
}

/**
 * Resolve a report. `suspend` disables the Appwrite account (existing JWTs stop
 * validating on the next request) and ends every active learning relation so the
 * counterpart is not left waiting on someone who cannot reply.
 */
export async function resolveReport(id: string, adminId: string, input: { action: ReportAction; note?: string }, requestId?: string): Promise<ReportItem> {
  const row = await getRow<ReportRow>(TABLES.reports, id);
  if (!row) throw notFound('not_found', 'This report could not be found.');
  if (row.status === 'resolved') throw conflict('invalid_state', 'This report is already resolved.');
  const now = new Date().toISOString();

  if (input.action === 'warn') {
    await notify({
      userId: row.targetUserId, type: 'system', title: 'A moderator reviewed a report about your account',
      body: input.note?.trim() || 'Please keep interactions respectful. Repeated reports can lead to suspension.', href: null, refType: 'report', refId: row.$id,
    });
  } else if (input.action === 'suspend') {
    await getUsers().updateStatus({ userId: row.targetUserId, status: false });
    const active = await listRows<LearningRelationRow>(TABLES.learningRelations, [
      Query.or([Query.equal('studentId', row.targetUserId), Query.equal('teacherId', row.targetUserId)]), Query.equal('status', 'active'), Query.limit(100),
    ]);
    for (const rel of active) {
      await updateRow(TABLES.learningRelations, rel.$id, { status: 'ended', endedAt: now, version: rel.version + 1 });
      const other = rel.studentId === row.targetUserId ? rel.teacherId : rel.studentId;
      await notify({ userId: other, type: 'system', title: 'A learning relation was ended by moderation', body: 'The other member\'s account was suspended.', href: `/relations/${rel.$id}`, refType: 'learning_relation', refId: rel.$id });
      await emitEvent({ eventType: 'relation.ended', aggregateType: 'learning_relation', aggregateId: rel.$id, actorId: adminId, payload: { reason: 'moderation' }, requestId });
    }
  }

  const updated = await updateRow<ReportRow>(TABLES.reports, id, { status: 'resolved', resolution: input.action, resolvedBy: adminId, resolvedAt: now, resolutionNote: input.note ?? '' });
  await audit({ actorId: adminId, action: `report.${input.action}`, resourceType: 'report', resourceId: id, reason: input.note, requestId });
  await emitEvent({ eventType: 'report.resolved', aggregateType: 'report', aggregateId: id, actorId: adminId, payload: { action: input.action, targetUserId: row.targetUserId }, requestId });
  const refs = await personRefs([updated.reporterId, updated.targetUserId]);
  return toReportItem(updated, refs.get(updated.reporterId)!, refs.get(updated.targetUserId)!);
}
