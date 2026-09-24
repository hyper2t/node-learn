import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey } from '@/infrastructure/api';
import { qk } from '@/state/query-keys';
import type {
  CreateQaQuestionInput, Page, QaAcceptedAnswer, QaQuestion, QaQuestionDetail, QaQuestionStatus, QaReportInput, QaTopicSlug, QaTopicSummary,
  QaAnswerInput, UpdateQaQuestionInput,
} from '@/types/api';

type Inbox = Page<QaQuestion> & { topics: QaTopicSlug[] };

export const qaApi = {
  topics: () => api.get<QaTopicSummary[]>('/v1/qa/topics'),
  questions: (p: { topic?: QaTopicSlug; status?: QaQuestionStatus; cursor?: string }) => api.get<Page<QaQuestion>>('/v1/qa/questions', { query: { ...p, limit: 20 } }),
  mine: (cursor?: string) => api.get<Page<QaQuestion>>('/v1/qa/questions/mine', { query: { cursor, limit: 20 } }),
  inbox: (cursor?: string) => api.get<Inbox>('/v1/qa/inbox', { query: { cursor, limit: 20 } }),
  detail: (id: string) => api.get<QaQuestionDetail>(`/v1/qa/questions/${id}`),
  accepted: (teacherId: string) => api.get<QaAcceptedAnswer[]>(`/v1/qa/teachers/${teacherId}/accepted`),
  ask: (input: CreateQaQuestionInput) => api.post<QaQuestion>('/v1/qa/questions', input, { idempotencyKey: newIdempotencyKey() }),
  update: (id: string, input: UpdateQaQuestionInput) => api.patch<QaQuestion>(`/v1/qa/questions/${id}`, input),
  close: (id: string) => api.post<QaQuestion>(`/v1/qa/questions/${id}/close`, {}),
  answer: (id: string, input: QaAnswerInput) => api.post<QaQuestionDetail>(`/v1/qa/questions/${id}/answers`, input, { idempotencyKey: newIdempotencyKey() }),
  editAnswer: (answerId: string, input: QaAnswerInput) => api.patch<QaQuestionDetail>(`/v1/qa/answers/${answerId}`, input),
  clarify: (answerId: string, body: string) => api.post<QaQuestionDetail>(`/v1/qa/answers/${answerId}/clarify`, { body }),
  accept: (answerId: string) => api.post<QaQuestionDetail>(`/v1/qa/answers/${answerId}/accept`, {}),
  report: (target: { type: 'question' | 'answer'; id: string }, input: QaReportInput) =>
    api.post<{ reported: true }>(`/v1/qa/${target.type === 'question' ? 'questions' : 'answers'}/${target.id}/report`, input),
};

export function useQaTopics() {
  return useQuery({ queryKey: qk.qa.topics, queryFn: qaApi.topics });
}

export function useQaQuestions(p: { topic?: QaTopicSlug; status?: QaQuestionStatus }) {
  return useInfiniteQuery({
    queryKey: qk.qa.list(p.topic ?? 'all', p.status ?? 'all'),
    queryFn: ({ pageParam }) => qaApi.questions({ ...p, cursor: pageParam || undefined }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useMyQaQuestions(enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.qa.mine,
    queryFn: ({ pageParam }) => qaApi.mine(pageParam || undefined),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

export function useQaInbox(enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.qa.inbox,
    queryFn: ({ pageParam }) => qaApi.inbox(pageParam || undefined),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

export function useQaQuestion(id: string) {
  return useQuery({ queryKey: qk.qa.detail(id), queryFn: () => qaApi.detail(id), enabled: !!id });
}

export function useAcceptedAnswers(teacherId: string) {
  return useQuery({ queryKey: qk.qa.accepted(teacherId), queryFn: () => qaApi.accepted(teacherId), enabled: !!teacherId });
}

/** Mutations that return a fresh detail write it straight into the cache, then refresh lists. */
function useDetailMutation<V>(id: string, fn: (v: V) => Promise<QaQuestionDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (detail) => {
      qc.setQueryData(qk.qa.detail(id), detail);
      void qc.invalidateQueries({ queryKey: ['qa'], predicate: (q) => q.queryKey[1] !== 'detail' });
    },
  });
}

export function useAnswerQuestion(id: string) { return useDetailMutation(id, (input: QaAnswerInput) => qaApi.answer(id, input)); }
export function useEditAnswer(id: string) { return useDetailMutation(id, ({ answerId, ...input }: QaAnswerInput & { answerId: string }) => qaApi.editAnswer(answerId, input)); }
export function useClarify(id: string) { return useDetailMutation(id, (v: { answerId: string; body: string }) => qaApi.clarify(v.answerId, v.body)); }
export function useAcceptAnswer(id: string) { return useDetailMutation(id, (answerId: string) => qaApi.accept(answerId)); }

export function useAskQuestion() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: qaApi.ask, onSuccess: () => { void qc.invalidateQueries({ queryKey: ['qa'] }); } });
}
export function useUpdateQuestion(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: UpdateQaQuestionInput) => qaApi.update(id, input), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['qa'] }); } });
}
export function useCloseQuestion(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => qaApi.close(id), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['qa'] }); } });
}
export function useReportQa() {
  return useMutation({ mutationFn: (v: { target: { type: 'question' | 'answer'; id: string } } & QaReportInput) => qaApi.report(v.target, { reason: v.reason, details: v.details }) });
}
