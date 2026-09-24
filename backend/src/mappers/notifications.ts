import type { Notification, NotificationType, PersonRef, ReportItem, ReportTargetType } from '../contracts/api';
import type { NotificationRow, ReportRow } from '../db/rows';

export function toNotification(r: NotificationRow, actor: PersonRef | null): Notification {
  return {
    id: r.$id, type: r.type as NotificationType, title: r.title, body: r.body ?? '', href: r.href ?? null,
    refType: r.refType ?? null, refId: r.refId ?? null, actor, readAt: r.readAt ?? null, createdAt: r.createdAt,
  };
}

export function toReportItem(r: ReportRow, reporter: PersonRef, target: PersonRef, content: { excerpt: string | null; href: string | null } = { excerpt: null, href: null }): ReportItem {
  const targetType: ReportTargetType = r.targetType === 'qa_question' || r.targetType === 'qa_answer' ? r.targetType : 'user';
  return {
    id: r.$id, reporter, target, targetType, targetId: r.targetId ?? null, contentExcerpt: content.excerpt, contentHref: content.href, reason: r.reason as ReportItem['reason'], details: r.details ?? '',
    status: (r.status === 'resolved' ? 'resolved' : 'open'), resolution: (r.resolution as ReportItem['resolution']) ?? null,
    resolvedBy: r.resolvedBy ?? null, resolvedAt: r.resolvedAt ?? null, createdAt: r.createdAt,
  };
}
