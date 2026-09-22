import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, newIdempotencyKey } from '@/infrastructure/api';
import { qk } from '@/state/query-keys';
import type { ConnectionRequest, Contact, CreateConnectionRequestInput, Page, ReportInput, UserLookup } from '@/types/api';

const idem = () => ({ idempotencyKey: newIdempotencyKey() });
export const connectionsApi = {
  lookup: (handle: string) => api.get<UserLookup>('/v1/connections/lookup', { query: { handle } }),
  contacts: () => api.get<Page<Contact>>('/v1/connections/contacts', { query: { limit: 100 } }),
  requests: (direction: 'incoming' | 'outgoing') => api.get<Page<ConnectionRequest>>('/v1/connections/requests', { query: { direction, limit: 50 } }),
  create: (input: CreateConnectionRequestInput) => api.post<ConnectionRequest>('/v1/connections/requests', input, idem()),
  respond: (id: string, action: 'accept' | 'decline' | 'cancel') => api.post<ConnectionRequest>(`/v1/connections/requests/${id}/${action}`, {}, idem()),
  block: (userId: string) => api.post<{ ok: true }>('/v1/connections/blocks', { userId }, idem()),
  unblock: (userId: string) => api.delete<{ ok: true }>(`/v1/connections/blocks/${userId}`),
  report: (input: ReportInput) => api.post<{ ok: true }>('/v1/connections/reports', input, idem()),
};

export function useContacts() { return useQuery({ queryKey: qk.connections.contacts, queryFn: connectionsApi.contacts }); }
export function useConnectionRequests(direction: 'incoming' | 'outgoing') {
  return useQuery({ queryKey: qk.connections.requests(direction), queryFn: () => connectionsApi.requests(direction) });
}
export function useLookup(handle: string) {
  return useQuery({ queryKey: qk.connections.lookup(handle), queryFn: () => connectionsApi.lookup(handle), enabled: handle.length >= 3, retry: false });
}
function useInvalidateConnections() {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: ['connections'] }); void qc.invalidateQueries({ queryKey: qk.conversations.list }); };
}
export function useCreateConnection() { const inv = useInvalidateConnections(); return useMutation({ mutationFn: connectionsApi.create, onSuccess: inv }); }
export function useRespondConnection() {
  const inv = useInvalidateConnections();
  return useMutation({ mutationFn: (p: { id: string; action: 'accept' | 'decline' | 'cancel' }) => connectionsApi.respond(p.id, p.action), onSuccess: inv });
}
export function useBlockUser() { const inv = useInvalidateConnections(); return useMutation({ mutationFn: connectionsApi.block, onSuccess: inv }); }
export function useReportUser() { return useMutation({ mutationFn: connectionsApi.report }); }
