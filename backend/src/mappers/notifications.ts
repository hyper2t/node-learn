import type { Notification, NotificationType, PersonRef, ReportItem } from '../contracts/api';
import type { NotificationRow, ReportRow } from '../db/rows';

export function toNotification(r: NotificationRow, actor: PersonRef | null): Notification {
  return {
    id: r.$id, type: r.type as NotificationType, title: r.title, body: r.body ?? '', href: r.href ?? null,
    refType: r.refType ?? null, refId: r.refId ?? null, actor, readAt: r.readAt ?? null, createdAt: r.createdAt,
  };
}

export function toReportItem(r: ReportRow, reporter: PersonRef, target: PersonRef): ReportItem {
  return {
    id: r.$id, reporter, target, reason: r.reason as ReportItem['reason'], details: r.details ?? '',
    status: (r.status === 'resolved' ? 'resolved' : 'open'), resolution: (r.resolution as ReportItem['resolution']) ?? null,
    resolvedBy: r.resolvedBy ?? null, resolvedAt: r.resolvedAt ?? null, createdAt: r.createdAt,
  };
}
