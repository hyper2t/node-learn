import { Query } from 'node-appwrite';
import type { Notification, NotificationType } from '../contracts/api';
import { createRow, getRow, listRows, updateRow } from '../db/repo';
import { isConflict, type NotificationRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { log } from '../log';
import { toNotification } from '../mappers/notifications';
import { personRefs } from './profiles';

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string | null;
  refType?: string;
  refId?: string;
  actorId?: string | null;
  /** Same key = same notification; a repeat write is a no-op (unique index). */
  dedupeKey?: string;
};

/**
 * In-app notifications, written synchronously right after the business write
 * (no queue yet — see audit plan C1). Best-effort: a failure here must never
 * fail the user's action, so errors are logged and swallowed.
 */
export async function notify(input: NotifyInput): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return; // never notify yourself
  try {
    await createRow<NotificationRow>(TABLES.notifications, {
      userId: input.userId, type: input.type, title: input.title.slice(0, 160), body: (input.body ?? '').slice(0, 500),
      href: input.href ?? null, refType: input.refType ?? null, refId: input.refId ?? null, actorId: input.actorId ?? null,
      dedupeKey: input.dedupeKey ?? null, readAt: null,
    });
  } catch (err) {
    if (isConflict(err)) return;
    log('warn', 'notification_write_failed', { type: input.type, message: err instanceof Error ? err.message : String(err) });
  }
}

export async function listNotifications(userId: string, p: { limit: number; cursor?: string; unreadOnly?: boolean }): Promise<{ items: Notification[]; nextCursor: string | null }> {
  const q = [Query.equal('userId', userId), Query.orderDesc('createdAt'), Query.limit(p.limit + 1)];
  if (p.unreadOnly) q.push(Query.isNull('readAt'));
  if (p.cursor) q.push(Query.cursorAfter(p.cursor));
  const rows = await listRows<NotificationRow>(TABLES.notifications, q);
  const hasMore = rows.length > p.limit;
  const page = hasMore ? rows.slice(0, p.limit) : rows;
  const refs = await personRefs(page.map((r) => r.actorId).filter((x): x is string => !!x));
  const last = page[page.length - 1];
  return { items: page.map((r) => toNotification(r, r.actorId ? refs.get(r.actorId) ?? null : null)), nextCursor: hasMore && last ? last.$id : null };
}

export async function countUnread(userId: string): Promise<number> {
  // Cheap bounded count: the badge caps at 99+ anyway.
  const rows = await listRows<NotificationRow>(TABLES.notifications, [Query.equal('userId', userId), Query.isNull('readAt'), Query.select(['$id']), Query.limit(100)]);
  return rows.length;
}

export async function markRead(userId: string, input: { ids?: string[]; all?: boolean }): Promise<{ updated: number; unread: number }> {
  const now = new Date().toISOString();
  let updated = 0;
  if (input.all) {
    // Loop in pages; each user rarely has more than a few hundred unread.
    for (let i = 0; i < 20; i++) {
      const rows = await listRows<NotificationRow>(TABLES.notifications, [Query.equal('userId', userId), Query.isNull('readAt'), Query.select(['$id']), Query.limit(100)]);
      if (!rows.length) break;
      await Promise.all(rows.map((r) => updateRow(TABLES.notifications, r.$id, { readAt: now })));
      updated += rows.length;
      if (rows.length < 100) break;
    }
  } else {
    for (const id of input.ids ?? []) {
      const row = await getRow<NotificationRow>(TABLES.notifications, id);
      if (!row || row.userId !== userId || row.readAt) continue; // silently skip: ids of others must not leak existence
      await updateRow(TABLES.notifications, id, { readAt: now });
      updated++;
    }
  }
  return { updated, unread: await countUnread(userId) };
}
