import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, clearJwtCache, newIdempotencyKey } from '@/infrastructure/api';
import { signOut as appwriteSignOut } from '@/infrastructure/appwrite';
import { qk } from '@/state/query-keys';
import type {
  AgeGateInput, LinkedIdentity, Me, Role, SelectRoleInput, StudentProfile, TeacherProfile, UpdateMeInput, UpdateStudentProfileInput, UpdateTeacherProfileInput,
} from '@/types/api';

export const meApi = {
  get: () => api.get<Me>('/v1/me'),
  update: (input: UpdateMeInput) => api.patch<Me>('/v1/me', input),
  ageGate: (input: AgeGateInput) => api.post<Me>('/v1/me/age-gate', input),
  addRole: (input: SelectRoleInput) => api.post<Me>('/v1/me/roles', input),
  setActiveRole: (role: Role) => api.post<Me>('/v1/me/roles/active', { role }),
  studentProfile: () => api.get<StudentProfile>('/v1/me/student-profile'),
  putStudentProfile: (input: UpdateStudentProfileInput) => api.put<StudentProfile>('/v1/me/student-profile', input),
  teacherProfile: () => api.get<TeacherProfile>('/v1/me/teacher-profile'),
  putTeacherProfile: (input: UpdateTeacherProfileInput) => api.put<TeacherProfile>('/v1/me/teacher-profile', input),
  identities: () => api.get<LinkedIdentity[]>('/v1/me/identities'),
  unlinkIdentity: (id: string) => api.delete<{ ok: true }>(`/v1/me/identities/${id}`),
  exportData: () => api.get<unknown>('/v1/me/export'),
  deleteAccount: () => api.delete<{ ok: true }>('/v1/me', { idempotencyKey: newIdempotencyKey() }),
};

export function useMe(enabled = true) {
  return useQuery({ queryKey: qk.me, queryFn: meApi.get, enabled, staleTime: 60_000 });
}
export function useStudentProfile(enabled = true) {
  return useQuery({ queryKey: qk.studentProfile, queryFn: meApi.studentProfile, enabled, retry: false });
}
export function useTeacherProfile(enabled = true) {
  return useQuery({ queryKey: qk.teacherProfile, queryFn: meApi.teacherProfile, enabled, retry: false });
}
export function useIdentities() {
  return useQuery({ queryKey: qk.identities, queryFn: meApi.identities });
}

function useMeMutation<I>(fn: (i: I) => Promise<Me>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (me) => qc.setQueryData(qk.me, me) });
}
export const useUpdateMe = () => useMeMutation(meApi.update);
export const useAgeGate = () => useMeMutation(meApi.ageGate);
export const useAddRole = () => useMeMutation(meApi.addRole);
export const useSetActiveRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: meApi.setActiveRole,
    onSuccess: (me) => {
      qc.setQueryData(qk.me, me);
      void qc.invalidateQueries({ queryKey: ['requests'] });
      void qc.invalidateQueries({ queryKey: ['relations'] });
    },
  });
};
export function useSaveStudentProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: meApi.putStudentProfile,
    onSuccess: (p) => { qc.setQueryData(qk.studentProfile, p); void qc.invalidateQueries({ queryKey: qk.me }); },
  });
}
export function useSaveTeacherProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: meApi.putTeacherProfile,
    onSuccess: (p) => { qc.setQueryData(qk.teacherProfile, p); void qc.invalidateQueries({ queryKey: qk.me }); },
  });
}
export function useUnlinkIdentity() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: meApi.unlinkIdentity, onSuccess: () => void qc.invalidateQueries({ queryKey: qk.identities }) });
}
export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => { await appwriteSignOut(); },
    onSettled: () => { clearJwtCache(); qc.clear(); },
  });
}
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => { await meApi.deleteAccount(); try { await appwriteSignOut(); } catch { /* session already gone */ } },
    onSettled: () => { clearJwtCache(); qc.clear(); },
  });
}
