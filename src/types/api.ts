/**
 * Node Learn API wire contract (v1). Single source of truth owned by the Expo app.
 * `backend/src/contracts/api.ts` is a byte-for-byte mirror checked by
 * `scripts/check-contract.mjs`. Pure TypeScript: no RN, Node or Appwrite imports.
 *
 * Times are UTC ISO-8601 strings; clients render in the user's locale.
 */

// ---------------------------------------------------------------- envelope

export type ApiSuccess<T> = { requestId: string; data: T; error: null };
export type ApiFailure = {
  requestId: string;
  data: null;
  error: { code: string; message: string; details?: unknown };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type Page<T> = { items: T[]; nextCursor: string | null };

// ---------------------------------------------------------------- identity

export type Role = 'student' | 'teacher';
export type AuthProvider = 'email' | 'google' | 'notion';
export type AgeBand = 'under_16' | '16_17' | '18_plus';
export type Visibility = 'public' | 'contacts' | 'relations' | 'private';

export type Me = {
  userId: string;
  email: string;
  emailVerified: boolean;
  handle: string | null;
  displayName: string;
  avatarFileId: string | null;
  locale: string;
  timeZone: string;
  availableRoles: Role[];
  activeRole: Role | null;
  ageBand: AgeBand | null;
  privacyAcceptedAt: string | null;
  onboarding: { student: boolean; teacher: boolean };
  /** Platform moderator (member of APPWRITE_ADMIN_TEAM_ID). */
  isAdmin: boolean;
  createdAt: string;
};

export type UpdateMeInput = Partial<{
  handle: string;
  displayName: string;
  locale: string;
  timeZone: string;
}>;

export type AgeGateInput = { ageBand: AgeBand; acceptPrivacy: true };
export type SelectRoleInput = { role: Role; activate?: boolean };
export type LinkedIdentity = { id: string; provider: AuthProvider; providerEmail: string | null; createdAt: string };

// ---------------------------------------------------------------- profiles

/** Minimal public reference to a person, embedded in lists. */
export type PersonRef = { userId: string; displayName: string; handle: string | null; avatarFileId: string | null };

export type StudentProfile = {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarFileId: string | null;
  headline: string;
  goalSummary: string;
  interests: string[];
  visibility: Visibility;
  updatedAt: string;
};

export type TeacherProfile = {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarFileId: string | null;
  headline: string;
  bio: string;
  subjects: string[];
  approach: string;
  /** Always true: teacher info is self-declared, never platform-verified. */
  selfDeclared: true;
  emailVerified: boolean;
  acceptingRequests: boolean;
  visibility: Visibility;
  /** Explainable trust signals only; no composite score. */
  signals: { activeRelations: number; evidenceReviewed: number; memberSince: string };
  updatedAt: string;
};

export type UpdateStudentProfileInput = Partial<Pick<StudentProfile, 'headline' | 'goalSummary' | 'interests' | 'visibility'>>;
export type UpdateTeacherProfileInput = Partial<
  Pick<TeacherProfile, 'headline' | 'bio' | 'subjects' | 'approach' | 'acceptingRequests' | 'visibility'>
>;

export type TeacherSort = 'relevance' | 'newest' | 'most_reviewed';
export type TeacherSearchParams = { q?: string; subject?: string; accepting?: boolean; sort?: TeacherSort; cursor?: string; limit?: number };

// ---------------------------------------------------------------- matching

export type RequestKind = 'learning_request' | 'teacher_invitation';
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export type LearningRequest = {
  id: string;
  kind: RequestKind;
  studentId: string;
  teacherId: string;
  initiatorId: string;
  goalTitle: string;
  message: string;
  status: RequestStatus;
  relationId: string | null;
  createdAt: string;
  respondedAt: string | null;
  counterpart: { userId: string; displayName: string; handle: string | null; avatarFileId: string | null };
};

export type CreateLearningRequestInput = { teacherId: string; goalTitle: string; message: string };
export type CreateTeacherInvitationInput = { studentId: string; goalTitle: string; message: string };
export type RequestListParams = { role: Role; status?: RequestStatus; cursor?: string; limit?: number };

// ---------------------------------------------------------------- learning

export type RelationStatus = 'active' | 'paused' | 'ended';
export type GoalStatus = 'active' | 'achieved' | 'dropped';
export type TaskStatus = 'open' | 'submitted' | 'reviewed' | 'done' | 'dropped';

export type LearningRelation = {
  id: string;
  studentId: string;
  teacherId: string;
  sourceRequestId: string;
  status: RelationStatus;
  conversationId: string;
  currentGoalId: string | null;
  startedAt: string;
  endedAt: string | null;
  version: number;
  student: { userId: string; displayName: string; handle: string | null; avatarFileId: string | null };
  teacher: { userId: string; displayName: string; handle: string | null; avatarFileId: string | null };
  summary: { openTasks: number; evidenceCount: number; lastActivityAt: string | null };
};

export type LearningGoal = {
  id: string;
  relationId: string;
  title: string;
  description: string;
  status: GoalStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type LearningTask = {
  id: string;
  relationId: string;
  goalId: string | null;
  title: string;
  instructions: string;
  status: TaskStatus;
  assignedBy: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateGoalInput = { title: string; description?: string };
export type UpdateGoalInput = Partial<{ title: string; description: string; status: GoalStatus }>;
export type CreateTaskInput = { title: string; instructions?: string; goalId?: string | null; dueAt?: string | null };
export type UpdateTaskInput = Partial<{ title: string; instructions: string; status: TaskStatus; dueAt: string | null }>;

export type RelationWorkspace = {
  relation: LearningRelation;
  goals: LearningGoal[];
  tasks: LearningTask[];
  recentEvidence: EvidenceItem[];
  proof: ProofRecord | null;
};

// ---------------------------------------------------------------- proof

export type EvidenceStatus = 'submitted' | 'reviewed' | 'revised';

/** Attachment metadata plus a short-lived, member-only view URL minted by the BFF. */
export type Attachment = {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Expires; re-fetch the evidence item to refresh. */
  url: string;
  expiresAt: string;
};

export type EvidenceItem = {
  id: string;
  relationId: string;
  taskId: string | null;
  goalId: string | null;
  authorId: string;
  title: string;
  body: string;
  attachmentFileIds: string[];
  attachments: Attachment[];
  status: EvidenceStatus;
  version: number;
  submittedAt: string;
  reviewedAt: string | null;
  feedback: Feedback[];
};

export type Feedback = {
  id: string;
  evidenceId: string;
  authorId: string;
  body: string;
  /** Non-judgemental: what changed / what to try next. */
  nextStep: string;
  createdAt: string;
};

export type CreateEvidenceInput = { title: string; body: string; taskId?: string | null; goalId?: string | null; attachmentFileIds?: string[] };
export type CreateFeedbackInput = { body: string; nextStep?: string; markTaskDone?: boolean };

/** Explainable projection, every number links back to evidence. */
export type ProofRecord = {
  relationId: string;
  currentFocus: string | null;
  milestones: { id: string; title: string; reachedAt: string; evidenceId: string | null }[];
  counts: { tasksDone: number; evidenceSubmitted: number; feedbackReceived: number; revisions: number };
  recentChange: string | null;
  nextStep: string | null;
  computedAt: string;
};

// ---------------------------------------------------------------- messaging

export type MessageType =
  | 'text'
  | 'goal_created'
  | 'task_assigned'
  | 'evidence_submitted'
  | 'feedback_added'
  | 'milestone_reached'
  | 'system';

export type MessagePayload =
  | { type: 'text'; text: string }
  | { type: 'goal_created'; goalId: string; title: string }
  | { type: 'task_assigned'; taskId: string; title: string; dueAt: string | null }
  | { type: 'evidence_submitted'; evidenceId: string; title: string; taskId: string | null }
  | { type: 'feedback_added'; feedbackId: string; evidenceId: string; excerpt: string }
  | { type: 'milestone_reached'; milestoneId: string; title: string }
  | { type: 'system'; text: string };

export type LearningMessage = {
  id: string;
  conversationId: string;
  sequence: number;
  senderId: string;
  type: MessageType;
  payloadVersion: 1;
  payload: MessagePayload;
  clientMessageId: string | null;
  createdAt: string;
  removedAt: string | null;
};

export type Conversation = {
  id: string;
  relationId: string | null;
  memberIds: string[];
  lastMessage: LearningMessage | null;
  lastSequence: number;
  myLastReadSequence: number;
  unreadCount: number;
  counterpart: { userId: string; displayName: string; handle: string | null; avatarFileId: string | null } | null;
  updatedAt: string;
};

export type SendMessageInput = { clientMessageId: string; text: string };
export type MessageListParams = { afterSequence?: number; beforeSequence?: number; limit?: number };
export type MarkReadInput = { sequence: number };

// ---------------------------------------------------------------- connections

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export type ConnectionRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: ConnectionStatus;
  source: 'handle' | 'invite' | 'relation';
  createdAt: string;
  respondedAt: string | null;
  counterpart: { userId: string; displayName: string; handle: string | null; avatarFileId: string | null };
};

export type Contact = {
  userId: string;
  displayName: string;
  handle: string | null;
  avatarFileId: string | null;
  connectedAt: string;
  conversationId: string | null;
};

export type UserLookup = { userId: string; displayName: string; handle: string; avatarFileId: string | null; roles: Role[] };
export type CreateConnectionRequestInput = { toUserId: string; message: string };
export type ReportInput = { targetUserId: string; reason: 'harassment' | 'spam' | 'inappropriate' | 'other'; details?: string };

// ---------------------------------------------------------------- notifications

export type NotificationType =
  | 'request.received'
  | 'request.accepted'
  | 'request.declined'
  | 'task.assigned'
  | 'evidence.submitted'
  | 'feedback.added'
  | 'connection.received'
  | 'connection.accepted'
  | 'system';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Deep-link target inside the app (e.g. `/requests/abc`). */
  href: string | null;
  refType: string | null;
  refId: string | null;
  actor: PersonRef | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListParams = { cursor?: string; limit?: number; unreadOnly?: boolean };
export type MarkNotificationsReadInput = { ids?: string[]; all?: boolean };
export type NotificationSummary = { unread: number };

// ---------------------------------------------------------------- admin (moderation)

export type ReportStatus = 'open' | 'resolved';
export type ReportAction = 'dismiss' | 'warn' | 'suspend';

export type ReportItem = {
  id: string;
  reporter: PersonRef;
  target: PersonRef;
  reason: ReportInput['reason'];
  details: string;
  status: ReportStatus;
  resolution: ReportAction | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type ReportListParams = { status?: ReportStatus; cursor?: string; limit?: number };
export type ResolveReportInput = { action: ReportAction; note?: string };

// ---------------------------------------------------------------- uploads

export type UploadPurpose = 'avatar' | 'evidence';
export type UploadIntentInput = { purpose: UploadPurpose; fileName: string; mimeType: string; sizeBytes: number; relationId?: string };
export type UploadIntent = { bucketId: string; fileId: string; expiresAt: string };
export type UploadComplete = { fileId: string; bucketId: string };

// ---------------------------------------------------------------- health

export type Health = { ok: true; version: string; uptimeSec: number; checks?: Record<string, { ok: boolean; latencyMs: number }> };
