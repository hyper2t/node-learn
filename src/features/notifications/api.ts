import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/infrastructure/api';
import { qk } from '@/state/query-keys';
import type { MarkNotificationsReadInput, Notification, NotificationSummary, Page } from '@/types/api';

export const notificationsApi = {
  list: (p: { cursor?: string; unreadOnly?: boolean }) => api.get<Page<Notification>>('/v1/notifications', { query: { ...p, limit: 30 } }),
  summary: () => api.get<NotificationSummary>('/v1/notifications/summary'),
  markRead: (input: MarkNotificationsReadInput) => api.post<{ updated: number; unread: number }>('/v1/notifications/read', input),
};

/** Unread badge; polled while the app is open (no push yet). */
export function useUnreadCount(enabled = true) {
  return useQuery({ queryKey: qk.notifications.summary, queryFn: notificationsApi.summary, enabled, refetchInterval: 45_000, staleTime: 30_000 });
}
export function useNotifications(unreadOnly = false) {
  return useInfiniteQuery({
    queryKey: qk.notifications.list(unreadOnly),
    queryFn: ({ pageParam }) => notificationsApi.list({ cursor: pageParam || undefined, unreadOnly: unreadOnly || undefined }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: (res) => {
      qc.setQueryData<NotificationSummary>(qk.notifications.summary, { unread: res.unread });
      void qc.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}
