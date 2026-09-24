import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/infrastructure/api';
import { qk } from '@/state/query-keys';
import type { QaReportInput, RelationReviewState, TeacherReview, TeacherReviewPage, UpsertReviewInput } from '@/types/api';

export const reviewsApi = {
  forRelation: (relationId: string) => api.get<RelationReviewState>(`/v1/relations/${relationId}/review`),
  upsert: (relationId: string, input: UpsertReviewInput) => api.put<RelationReviewState>(`/v1/relations/${relationId}/review`, input),
  forTeacher: (teacherId: string, cursor?: string) => api.get<TeacherReviewPage>(`/v1/teachers/${teacherId}/reviews`, { query: { limit: 10, cursor } }),
  reply: (reviewId: string, reply: string) => api.put<TeacherReview>(`/v1/teachers/reviews/${reviewId}/reply`, { reply }),
  report: (reviewId: string, input: QaReportInput) => api.post<{ reported: true }>(`/v1/teachers/reviews/${reviewId}/report`, input),
};

export function useRelationReview(relationId: string, enabled = true) {
  return useQuery({ queryKey: qk.reviews.relation(relationId), queryFn: () => reviewsApi.forRelation(relationId), enabled: enabled && !!relationId });
}
export function useUpsertReview(relationId: string, teacherId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertReviewInput) => reviewsApi.upsert(relationId, input),
    onSuccess: (data) => {
      qc.setQueryData(qk.reviews.relation(relationId), data);
      void qc.invalidateQueries({ queryKey: qk.reviews.teacher(teacherId) });
      void qc.invalidateQueries({ queryKey: qk.teachers.detail(teacherId) });
    },
  });
}
export function useTeacherReviews(teacherId: string) {
  return useInfiniteQuery({
    queryKey: qk.reviews.teacher(teacherId),
    queryFn: ({ pageParam }) => reviewsApi.forTeacher(teacherId, pageParam || undefined),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!teacherId,
  });
}
export function useReplyToReview(review: TeacherReview) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reply: string) => reviewsApi.reply(review.id, reply),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.reviews.teacher(review.teacherId) });
      void qc.invalidateQueries({ queryKey: qk.reviews.relation(review.relationId) });
    },
  });
}
export function useReportReview() {
  return useMutation({ mutationFn: (v: { id: string } & QaReportInput) => reviewsApi.report(v.id, { reason: v.reason, details: v.details }) });
}
