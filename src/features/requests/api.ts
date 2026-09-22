import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey } from '@/infrastructure/api';
import { qk } from '@/state/query-keys';
import type { CreateLearningRequestInput, CreateTeacherInvitationInput, LearningRequest, Page, RequestStatus, Role } from '@/types/api';

export const requestsApi = {
  list: (role: Role, status?: RequestStatus) => api.get<Page<LearningRequest>>('/v1/requests', { query: { role, status, limit: 50 } }),
  get: (id: string) => api.get<LearningRequest>(`/v1/requests/${id}`),
  create: (input: CreateLearningRequestInput) => api.post<LearningRequest>('/v1/requests', input, { idempotencyKey: newIdempotencyKey() }),
  invite: (input: CreateTeacherInvitationInput) => api.post<LearningRequest>('/v1/requests/invitations', input, { idempotencyKey: newIdempotencyKey() }),
  accept: (id: string) => api.post<LearningRequest>(`/v1/requests/${id}/accept`, {}, { idempotencyKey: newIdempotencyKey() }),
  decline: (id: string) => api.post<LearningRequest>(`/v1/requests/${id}/decline`, {}, { idempotencyKey: newIdempotencyKey() }),
  cancel: (id: string) => api.post<LearningRequest>(`/v1/requests/${id}/cancel`, {}, { idempotencyKey: newIdempotencyKey() }),
};

export function useRequests(role: Role, status?: RequestStatus, enabled = true) {
  return useQuery({ queryKey: qk.requests.list(role, status), queryFn: () => requestsApi.list(role, status), enabled });
}
export function useRequest(id: string) {
  return useQuery({ queryKey: qk.requests.detail(id), queryFn: () => requestsApi.get(id), enabled: !!id });
}
function useInvalidateRequests() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['requests'] });
    void qc.invalidateQueries({ queryKey: ['relations'] });
    void qc.invalidateQueries({ queryKey: qk.conversations.list });
  };
}
export function useCreateRequest() { const inv = useInvalidateRequests(); return useMutation({ mutationFn: requestsApi.create, onSuccess: inv }); }
export function useCreateInvitation() { const inv = useInvalidateRequests(); return useMutation({ mutationFn: requestsApi.invite, onSuccess: inv }); }
export function useRespondRequest() {
  const inv = useInvalidateRequests();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' | 'cancel' }) => requestsApi[action](id),
    onSuccess: inv,
  });
}
