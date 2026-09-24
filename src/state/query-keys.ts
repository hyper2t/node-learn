import type { Role } from '@/types/api';

/** Centralised query keys. All are user-scoped and dropped on sign-out. */
export const qk = {
  me: ['me'] as const,
  identities: ['me', 'identities'] as const,
  studentProfile: ['me', 'student-profile'] as const,
  teacherProfile: ['me', 'teacher-profile'] as const,
  teachers: { search: (q: string, subject: string) => ['teachers', 'search', q, subject] as const, detail: (id: string) => ['teachers', id] as const },
  requests: { list: (role: Role, status?: string) => ['requests', role, status ?? 'all'] as const, detail: (id: string) => ['requests', 'detail', id] as const },
  relations: { list: (role: Role, status?: string) => ['relations', role, status ?? 'all'] as const, workspace: (id: string) => ['relations', id, 'workspace'] as const, evidence: (id: string) => ['relations', id, 'evidence'] as const, reviewQueue: ['relations', 'review-queue'] as const, summary: (id: string) => ['relations', id, 'summary'] as const },
  conversations: { list: ['conversations'] as const, detail: (id: string) => ['conversations', id] as const, messages: (id: string) => ['conversations', id, 'messages'] as const },
  notifications: { summary: ['notifications', 'summary'] as const, list: (unreadOnly: boolean) => ['notifications', 'list', unreadOnly ? 'unread' : 'all'] as const },
  admin: { reports: (status: string) => ['admin', 'reports', status] as const },
  qa: {
    topics: ['qa', 'topics'] as const, list: (topic: string, status: string) => ['qa', 'list', topic, status] as const, mine: ['qa', 'mine'] as const,
    inbox: ['qa', 'inbox'] as const, detail: (id: string) => ['qa', 'detail', id] as const, accepted: (teacherId: string) => ['qa', 'accepted', teacherId] as const,
  },
  connections: { contacts: ['connections', 'contacts'] as const, requests: (dir: 'incoming' | 'outgoing') => ['connections', 'requests', dir] as const, lookup: (h: string) => ['connections', 'lookup', h] as const },
} as const;

export const userScopedRoots = [['me'], ['teachers'], ['requests'], ['relations'], ['conversations'], ['connections'], ['notifications'], ['admin'], ['qa']] as const;
