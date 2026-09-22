import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/infrastructure/api';
import { qk } from '@/state/query-keys';
import type { Page, TeacherProfile } from '@/types/api';

export const teachersApi = {
  search: (p: { q?: string; subject?: string; cursor?: string }) => api.get<Page<TeacherProfile>>('/v1/teachers', { query: { ...p, limit: 20 } }),
  get: (userId: string) => api.get<TeacherProfile>(`/v1/teachers/${userId}`),
};

export function useTeacherSearch(q: string, subject = '') {
  return useInfiniteQuery({
    queryKey: qk.teachers.search(q, subject),
    queryFn: ({ pageParam }) => teachersApi.search({ q: q || undefined, subject: subject || undefined, cursor: pageParam || undefined }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
export function useTeacher(userId: string) {
  return useQuery({ queryKey: qk.teachers.detail(userId), queryFn: () => teachersApi.get(userId), enabled: !!userId });
}
