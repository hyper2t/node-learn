import type { Models } from 'node-appwrite';
import type { AgeBand, Me, Role, StudentProfile, TeacherProfile, Visibility } from '../contracts/api';
import { REVIEW_MIN_FOR_AVERAGE } from '../contracts/api';
import type { ProfileRow, RoleMembershipRow, StudentProfileRow, TeacherProfileRow } from '../db/rows';

export type PersonRef = { userId: string; displayName: string; handle: string | null; avatarFileId: string | null };

const ROLES: Role[] = ['student', 'teacher'];
const asRole = (r: string): Role | null => ((ROLES as string[]).includes(r) ? (r as Role) : null);

export function toMe(user: Models.User, p: ProfileRow, memberships: RoleMembershipRow[], isAdmin = false): Me {
  const roles = memberships.map((m) => asRole(m.role)).filter((r): r is Role => r !== null);
  const active = memberships.find((m) => m.active);
  return {
    userId: user.$id,
    email: user.email,
    emailVerified: user.emailVerification,
    handle: p.handle,
    displayName: p.displayName,
    avatarFileId: p.avatarFileId,
    locale: p.locale ?? 'en',
    timeZone: p.timeZone ?? 'UTC',
    availableRoles: roles,
    activeRole: active ? asRole(active.role) : (roles[0] ?? null),
    ageBand: (p.ageBand as AgeBand | null) ?? null,
    privacyAcceptedAt: p.privacyAcceptedAt,
    onboarding: {
      student: memberships.some((m) => m.role === 'student' && m.onboarded),
      teacher: memberships.some((m) => m.role === 'teacher' && m.onboarded),
    },
    isAdmin,
    createdAt: p.createdAt,
  };
}

export function toPersonRef(p: ProfileRow): PersonRef {
  return { userId: p.$id, displayName: p.displayName, handle: p.handle, avatarFileId: p.avatarFileId };
}

export function toStudentProfile(p: ProfileRow, s: StudentProfileRow | null): StudentProfile {
  return {
    ...toPersonRef(p),
    headline: s?.headline ?? '',
    goalSummary: s?.goalSummary ?? '',
    interests: s?.interests ?? [],
    visibility: (s?.visibility as Visibility | undefined) ?? 'relations',
    updatedAt: s?.updatedAt ?? p.updatedAt,
  };
}

export function toTeacherProfile(p: ProfileRow, t: TeacherProfileRow, emailVerified: boolean, signals: Omit<TeacherProfile['signals'], 'reviewCount' | 'avgRating'>): TeacherProfile {
  return {
    ...toPersonRef(p),
    headline: t.headline ?? '',
    bio: t.bio ?? '',
    subjects: t.subjects ?? [],
    approach: t.approach ?? '',
    selfDeclared: true,
    emailVerified,
    acceptingRequests: t.acceptingRequests,
    visibility: (t.visibility as Visibility | null) ?? 'public',
    signals: { ...signals, ...ratingSignals(t.reviewCount ?? 0, t.ratingSum ?? 0) },
    updatedAt: t.updatedAt,
  };
}

/** Average is hidden (null) until there are enough reviews to mean something; one decimal. */
export function ratingSignals(count: number, sum: number): { reviewCount: number; avgRating: number | null } {
  return { reviewCount: count, avgRating: count >= REVIEW_MIN_FOR_AVERAGE ? Math.round((sum / count) * 10) / 10 : null };
}
