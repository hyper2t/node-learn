import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/infrastructure/api';
import { qk } from '@/state/query-keys';
import type { Page, TeacherProfile, TeacherSearchParams } from '@/types/api';

export const teachersApi = {
  search: (p: TeacherSearchParams) => api.get<Page<TeacherProfile>>('/v1/teachers', { query: { ...p, limit: 20 } }),
  get: (userId: string) => api.get<TeacherProfile>(`/v1/teachers/${userId}`),
};

export type TeacherFilters = { subject?: string; accepting?: boolean; sort?: TeacherSearchParams['sort'] };
export function useTeacherSearch(q: string, filters: TeacherFilters = {}) {
  const subject = (filters.subject ?? '').trim().toLowerCase();
  const accepting = filters.accepting ?? true;
  const sort = filters.sort ?? 'relevance';
  return useInfiniteQuery({
    queryKey: qk.teachers.search(q, `${subject}|${accepting}|${sort}`),
    queryFn: ({ pageParam }) => teachersApi.search({ q: q || undefined, subject: subject || undefined, accepting, sort, cursor: pageParam || undefined }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
export function useTeacher(userId: string) {
  return useQuery({ queryKey: qk.teachers.detail(userId), queryFn: () => teachersApi.get(userId), enabled: !!userId });
}
