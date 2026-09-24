import type { Models } from 'node-appwrite';

/** Typed row shapes. Column names must match appwrite.config.json. */
type Stamped = Models.Row & { createdAt: string; updatedAt: string };

export type ProfileRow = Stamped & {
  email: string; handle: string | null; displayName: string; avatarFileId: string | null;
  locale: string | null; timeZone: string | null; ageBand: string | null; privacyAcceptedAt: string | null; status: string | null;
};
export type RoleMembershipRow = Stamped & { userId: string; role: string; active: boolean; onboarded: boolean };
export type StudentProfileRow = Stamped & { userId: string; headline: string | null; goalSummary: string | null; interests: string[] | null; visibility: string | null };
export type TeacherProfileRow = Stamped & {
  userId: string; headline: string | null; bio: string | null; subjects: string[] | null; approach: string | null;
  acceptingRequests: boolean; visibility: string | null; searchText: string | null;
};
export type LearningRequestRow = Stamped & {
  kind: string; studentId: string; teacherId: string; initiatorId: string; goalTitle: string; message: string | null;
  status: string; relationId: string | null; pairKey: string; respondedAt: string | null;
};
export type LearningRelationRow = Stamped & {
  studentId: string; teacherId: string; sourceRequestId: string; status: string; conversationId: string; currentGoalId: string | null;
  startedAt: string; endedAt: string | null; version: number;
  pausedBy?: string | null; pausedAt?: string | null; endedBy?: string | null; endReason?: string | null; openTasks: number; evidenceCount: number; lastActivityAt: string | null;
};
export type LearningGoalRow = Stamped & { relationId: string; title: string; description: string | null; status: string; createdBy: string; completionRequestedAt?: string | null };
export type LearningTaskRow = Stamped & { relationId: string; goalId: string | null; title: string; instructions: string | null; status: string; assignedBy: string; dueAt: string | null };
export type EvidenceItemRow = Stamped & {
  relationId: string; taskId: string | null; goalId: string | null; authorId: string; title: string; body: string | null;
  attachmentFileIds: string[] | null; status: string; version: number; submittedAt: string; reviewedAt: string | null;
};
export type FeedbackEntryRow = Stamped & { evidenceId: string; relationId: string; authorId: string; body: string | null; nextStep: string | null; outcome?: string | null };
export type RelationSummaryRow = Stamped & {
  relationId: string; studentId: string; teacherId: string; startedAt: string; endedAt: string; endedBy: string | null; endReason: string | null;
  goalsJson: string; countsJson: string; milestonesJson: string; closingNote: string | null; closingNoteAt: string | null;
};
export type EvidenceRevisionRow = Stamped & { evidenceId: string; relationId: string; authorId: string; version: number; title: string; body: string | null; attachmentFileIds: string[] | null };
export type ProofRecordRow = Stamped & {
  relationId: string; currentFocus: string | null; milestonesJson: string | null; tasksDone: number; evidenceSubmitted: number;
  feedbackReceived: number; revisions: number; recentChange: string | null; nextStep: string | null; computedAt: string;
};
export type ConversationRow = Stamped & { relationId: string | null; memberIds: string[]; pairKey: string; lastSequence: number; lastMessageAt: string | null };
export type ConversationMemberRow = Stamped & { conversationId: string; userId: string; lastReadSequence: number };
export type MessageRow = Stamped & {
  conversationId: string; sequence: number; senderId: string; type: string; payloadVersion: number; payloadJson: string | null;
  clientMessageId: string | null; dedupeKey: string | null; removedAt: string | null;
};
export type ConnectionRequestRow = Stamped & { fromUserId: string; toUserId: string; message: string | null; status: string; source: string; pairKey: string; respondedAt: string | null };
export type ContactRow = Stamped & { userId: string; contactUserId: string; conversationId: string | null; connectedAt: string };
export type BlockRow = Stamped & { blockerId: string; blockedId: string };
export type ReportRow = Stamped & { reporterId: string; targetUserId: string; reason: string; details: string | null; status: string | null; resolution: string | null; resolvedBy: string | null; resolvedAt: string | null; resolutionNote: string | null; targetType: string | null; targetId: string | null };
export type NotificationRow = Stamped & { userId: string; type: string; title: string; body: string | null; href: string | null; refType: string | null; refId: string | null; actorId: string | null; dedupeKey: string | null; readAt: string | null };
export type IdempotencyKeyRow = Stamped & { userId: string; key: string; status: string; requestHash: string; resultId: string | null; resultJson: string | null };
export type DomainEventRow = Stamped & { eventType: string; aggregateType: string; aggregateId: string; actorId: string; payloadVersion: number; payloadJson: string | null; requestId: string | null; occurredAt: string; status: string | null };
export type AuditEventRow = Stamped & { actorId: string; action: string; resourceType: string; resourceId: string; reason: string | null; requestId: string | null };
export type UploadIntentRow = Stamped & { userId: string; purpose: string; bucketId: string; fileId: string; relationId: string | null; fileName: string | null; mimeType: string; sizeBytes: number; status: string | null; expiresAt: string };
export type QaQuestionRow = Stamped & {
  authorId: string; topic: string; title: string; body: string; status: string; answerCount: number; acceptedAnswerId: string | null;
  lastActivityAt: string; removedAt: string | null; removedBy: string | null; attachmentFileIds?: string[] | null;
};
export type QaAnswerRow = Stamped & { questionId: string; authorId: string; kind: string; parentAnswerId: string | null; body: string; removedAt: string | null; removedBy: string | null; attachmentFileIds?: string[] | null };

export function isRowNotFound(err: unknown): boolean {
  const e = err as { code?: number; type?: string } | null;
  return e?.code === 404 || (e?.type ?? '').includes('not_found');
}
export function isConflict(err: unknown): boolean {
  return (err as { code?: number } | null)?.code === 409;
}
/** Sorted pair key so A↔B and B↔A collapse to one row. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('_');
}
export function nowIso(): string {
  return new Date().toISOString();
}
