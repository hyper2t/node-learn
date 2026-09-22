import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey } from '@/infrastructure/api';
import { qk } from '@/state/query-keys';
import type { Page, ReportItem, ReportStatus, ResolveReportInput } from '@/types/api';

export const adminApi = {
  reports: (p: { status?: ReportStatus; cursor?: string }) => api.get<Page<ReportItem>>('/v1/admin/reports', { query: { ...p, limit: 30 } }),
  resolve: (id: string, input: ResolveReportInput) => api.post<ReportItem>(`/v1/admin/reports/${id}/resolve`, input, { idempotencyKey: newIdempotencyKey() }),
};

export function useReports(status: ReportStatus, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.admin.reports(status),
    queryFn: ({ pageParam }) => adminApi.reports({ status, cursor: pageParam || undefined }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}
export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { id: string } & ResolveReportInput) => adminApi.resolve(p.id, { action: p.action, note: p.note }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin'] }); },
  });
}
