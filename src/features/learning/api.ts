import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey } from '@/infrastructure/api';
import { qk } from '@/state/query-keys';
import type {
  CreateEvidenceInput, CreateFeedbackInput, CreateGoalInput, CreateTaskInput, EvidenceItem, Feedback, LearningGoal, LearningRelation, LearningTask, Page,
  ProofRecord, RelationStatus, ReviewQueue, RelationWorkspace, ReviseEvidenceInput, Role, UpdateGoalInput, UpdateTaskInput,
} from '@/types/api';

const idem = () => ({ idempotencyKey: newIdempotencyKey() });
export const learningApi = {
  list: (role: Role, status?: RelationStatus) => api.get<Page<LearningRelation>>('/v1/relations', { query: { role, status, limit: 50 } }),
  get: (id: string) => api.get<LearningRelation>(`/v1/relations/${id}`),
  workspace: (id: string) => api.get<RelationWorkspace>(`/v1/relations/${id}/workspace`),
  setStatus: (id: string, input: { status: RelationStatus; reason?: string }) => api.post<LearningRelation>(`/v1/relations/${id}/status`, input, idem()),
  createGoal: (id: string, input: CreateGoalInput) => api.post<LearningGoal>(`/v1/relations/${id}/goals`, input, idem()),
  updateGoal: (id: string, goalId: string, input: UpdateGoalInput) => api.patch<LearningGoal>(`/v1/relations/${id}/goals/${goalId}`, input),
  createTask: (id: string, input: CreateTaskInput) => api.post<LearningTask>(`/v1/relations/${id}/tasks`, input, idem()),
  updateTask: (id: string, taskId: string, input: UpdateTaskInput) => api.patch<LearningTask>(`/v1/relations/${id}/tasks/${taskId}`, input),
  evidence: (id: string) => api.get<Page<EvidenceItem>>(`/v1/relations/${id}/evidence`, { query: { limit: 50 } }),
  evidenceItem: (id: string, evidenceId: string) => api.get<EvidenceItem>(`/v1/relations/${id}/evidence/${evidenceId}`),
  createEvidence: (id: string, input: CreateEvidenceInput) => api.post<EvidenceItem>(`/v1/relations/${id}/evidence`, input, idem()),
  createFeedback: (id: string, evidenceId: string, input: CreateFeedbackInput) => api.post<Feedback>(`/v1/relations/${id}/evidence/${evidenceId}/feedback`, input, idem()),
  reviseEvidence: (id: string, evidenceId: string, input: ReviseEvidenceInput) => api.patch<EvidenceItem>(`/v1/relations/${id}/evidence/${evidenceId}`, input),
  requestGoalCompletion: (id: string, goalId: string) => api.post<LearningGoal>(`/v1/relations/${id}/goals/${goalId}/request-completion`, {}, idem()),
  declineGoalCompletion: (id: string, goalId: string, note?: string) => api.post<LearningGoal>(`/v1/relations/${id}/goals/${goalId}/decline-completion`, note ? { note } : {}, idem()),
  reviewQueue: () => api.get<ReviewQueue>('/v1/review-queue'),
  proof: (id: string) => api.get<ProofRecord>(`/v1/relations/${id}/proof`),
};

export function useRelations(role: Role, status?: RelationStatus, enabled = true) {
  return useQuery({ queryKey: qk.relations.list(role, status), queryFn: () => learningApi.list(role, status), enabled });
}
/** Teacher-only. Refreshes every minute while mounted; mutations invalidate it through the ['relations'] root. */
export function useReviewQueue(enabled = true) {
  return useQuery({ queryKey: qk.relations.reviewQueue, queryFn: () => learningApi.reviewQueue(), enabled, refetchInterval: 60_000 });
}
export function useWorkspace(id: string) {
  return useQuery({ queryKey: qk.relations.workspace(id), queryFn: () => learningApi.workspace(id), enabled: !!id });
}
export function useEvidenceList(id: string) {
  return useQuery({ queryKey: qk.relations.evidence(id), queryFn: () => learningApi.evidence(id), enabled: !!id });
}
export function useEvidenceItem(id: string, evidenceId: string) {
  return useQuery({ queryKey: [...qk.relations.evidence(id), evidenceId], queryFn: () => learningApi.evidenceItem(id, evidenceId), enabled: !!id && !!evidenceId });
}

function useRelationInvalidate(id: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['relations'] });
    void qc.invalidateQueries({ queryKey: qk.relations.workspace(id) });
    void qc.invalidateQueries({ queryKey: qk.relations.evidence(id) });
    void qc.invalidateQueries({ queryKey: ['conversations'] });
  };
}
export function useSetRelationStatus(id: string) { const inv = useRelationInvalidate(id); return useMutation({ mutationFn: (i: { status: RelationStatus; reason?: string }) => learningApi.setStatus(id, i), onSuccess: inv }); }
export function useCreateGoal(id: string) { const inv = useRelationInvalidate(id); return useMutation({ mutationFn: (i: CreateGoalInput) => learningApi.createGoal(id, i), onSuccess: inv }); }
export function useUpdateGoal(id: string) { const inv = useRelationInvalidate(id); return useMutation({ mutationFn: (p: { goalId: string; input: UpdateGoalInput }) => learningApi.updateGoal(id, p.goalId, p.input), onSuccess: inv }); }
export function useCreateTask(id: string) { const inv = useRelationInvalidate(id); return useMutation({ mutationFn: (i: CreateTaskInput) => learningApi.createTask(id, i), onSuccess: inv }); }
export function useUpdateTask(id: string) { const inv = useRelationInvalidate(id); return useMutation({ mutationFn: (p: { taskId: string; input: UpdateTaskInput }) => learningApi.updateTask(id, p.taskId, p.input), onSuccess: inv }); }
export function useCreateEvidence(id: string) { const inv = useRelationInvalidate(id); return useMutation({ mutationFn: (i: CreateEvidenceInput) => learningApi.createEvidence(id, i), onSuccess: inv }); }
export function useCreateFeedback(id: string) { const inv = useRelationInvalidate(id); return useMutation({ mutationFn: (p: { evidenceId: string; input: CreateFeedbackInput }) => learningApi.createFeedback(id, p.evidenceId, p.input), onSuccess: inv }); }
export function useReviseEvidence(id: string) { const inv = useRelationInvalidate(id); return useMutation({ mutationFn: (p: { evidenceId: string; input: ReviseEvidenceInput }) => learningApi.reviseEvidence(id, p.evidenceId, p.input), onSuccess: inv }); }
export function useRequestGoalCompletion(id: string) { const inv = useRelationInvalidate(id); return useMutation({ mutationFn: (goalId: string) => learningApi.requestGoalCompletion(id, goalId), onSuccess: inv }); }
export function useDeclineGoalCompletion(id: string) { const inv = useRelationInvalidate(id); return useMutation({ mutationFn: (p: { goalId: string; note?: string }) => learningApi.declineGoalCompletion(id, p.goalId, p.note), onSuccess: inv }); }
