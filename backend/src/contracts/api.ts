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

export type RelationNextActionKind =
  | 'none'
  | 'teacher_review'
  | 'student_revise'
  | 'student_submit'
  | 'teacher_confirm_goal'
  | 'teacher_assign';
export type RelationNextAction = { kind: RelationNextActionKind; count: number; dueAt: string | null };

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
  /** Who paused the relation (null unless paused). */
  pausedBy: string | null;
  pausedAt: string | null;
  endedBy: string | null;
  /** Required when ending; visible to both members. */
  endReason: string | null;
  version: number;
  student: { userId: string; displayName: string; handle: string | null; avatarFileId: string | null };
  teacher: { userId: string; displayName: string; handle: string | null; avatarFileId: string | null };
  summary: { openTasks: number; evidenceCount: number; lastActivityAt: string | null };
  /** Who needs to act next, derived on read. `count`/`dueAt` describe the pending items. */
  nextAction: RelationNextAction;
};

export type LearningGoal = {
  id: string;
  relationId: string;
  title: string;
  description: string;
  status: GoalStatus;
  createdBy: string;
  /** Set when the learner asks the teacher to confirm the goal is achieved. */
  completionRequestedAt: string | null;
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

/** End-of-relation snapshot (L4.2). Frozen when the relation ends; only the teacher's closing note changes later. */
export type RelationSummary = {
  relationId: string;
  student: { userId: string; displayName: string; handle: string | null; avatarFileId: string | null };
  teacher: { userId: string; displayName: string; handle: string | null; avatarFileId: string | null };
  startedAt: string;
  endedAt: string;
  weeks: number;
  endedBy: string | null;
  endReason: string | null;
  goals: {
    achieved: { id: string; title: string; achievedAt: string }[];
    dropped: { id: string; title: string }[];
    open: { id: string; title: string }[];
  };
  counts: { tasksDone: number; evidenceSubmitted: number; feedbackReceived: number; revisions: number };
  milestones: { id: string; title: string; reachedAt: string; evidenceId: string | null }[];
  closingNote: string | null;
  closingNoteAt: string | null;
  /** The teacher may write or edit the note until this time (14 days after the end). */
  closingNoteEditableUntil: string;
  generatedAt: string;
};

/** Teacher's cross-relation to-do list (L4.1). Oldest first. */
export type ReviewQueueItem = {
  kind: 'evidence' | 'goal';
  /** Evidence id or goal id. */
  id: string;
  relationId: string;
  student: { userId: string; displayName: string; handle: string | null; avatarFileId: string | null };
  title: string;
  /** When it started waiting: evidence submittedAt/updatedAt, or goal completionRequestedAt. */
  since: string;
  /** Evidence only: >1 means a resubmission. */
  version: number | null;
};
export type ReviewQueue = { items: ReviewQueueItem[]; counts: { evidence: number; goals: number } };

export type RelationWorkspace = {
  relation: LearningRelation;
  goals: LearningGoal[];
  tasks: LearningTask[];
  recentEvidence: EvidenceItem[];
  proof: ProofRecord | null;
};

// ---------------------------------------------------------------- proof

/** submitted → reviewed | needs_revision; needs_revision → revised (resubmitted, awaiting review again) → reviewed | needs_revision. */
export type EvidenceStatus = 'submitted' | 'reviewed' | 'needs_revision' | 'revised';
export type FeedbackOutcome = 'approved' | 'needs_revision';

/** Snapshot of an evidence item before a resubmission replaced it. */
export type EvidenceRevision = { version: number; title: string; body: string; attachmentFileIds: string[]; createdAt: string };

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
  /** Earlier versions, newest first. Only filled on the detail endpoint. */
  revisions?: EvidenceRevision[];
};

export type Feedback = {
  id: string;
  evidenceId: string;
  authorId: string;
  body: string;
  /** Non-judgemental: what changed / what to try next. */
  nextStep: string;
  outcome: FeedbackOutcome;
  createdAt: string;
};

export type CreateEvidenceInput = { title: string; body: string; taskId?: string | null; goalId?: string | null; attachmentFileIds?: string[] };
export type CreateFeedbackInput = { body: string; nextStep?: string; markTaskDone?: boolean; outcome?: FeedbackOutcome };
export type ReviseEvidenceInput = { title?: string; body?: string; attachmentFileIds?: string[] };

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
  | 'relation.paused'
  | 'relation.resumed'
  | 'relation.ended'
  | 'goal.created'
  | 'goal.achieved'
  | 'goal.completion_requested'
  | 'goal.completion_declined'
  | 'evidence.revision_requested'
  | 'evidence.revised'
  | 'task.due_soon'
  | 'task.overdue'
  | 'relation.closing_note'
  | 'connection.received'
  | 'connection.accepted'
  | 'qa.answered'
  | 'qa.clarified'
  | 'qa.accepted'
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
export type ReportAction = 'dismiss' | 'warn' | 'suspend' | 'remove_content';
export type ReportTargetType = 'user' | 'qa_question' | 'qa_answer';

export type ReportItem = {
  id: string;
  reporter: PersonRef;
  /** The person responsible (for content reports: the author). */
  target: PersonRef;
  targetType: ReportTargetType;
  /** Content id for qa_* reports; null for user reports. */
  targetId: string | null;
  /** Short excerpt of the reported content, for moderator context. Null for user reports or removed rows. */
  contentExcerpt: string | null;
  /** In-app link to the reported content, when there is one. */
  contentHref: string | null;
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

// ---------------------------------------------------------------- topic Q&A

/**
 * Fixed topic catalogue for Q&A. Profile interests/subjects stay free-form; teachers are
 * matched to topics by case-insensitive label or slug.
 */
export const QA_TOPICS = [
  { slug: 'programming', label: 'Programming' },
  { slug: 'math', label: 'Math' },
  { slug: 'physics', label: 'Physics' },
  { slug: 'languages', label: 'Languages' },
  { slug: 'writing', label: 'Writing' },
  { slug: 'music', label: 'Music' },
  { slug: 'art-design', label: 'Art & design' },
  { slug: 'science', label: 'Science' },
  { slug: 'history', label: 'History' },
  { slug: 'exam-prep', label: 'Exam prep' },
  { slug: 'public-speaking', label: 'Public speaking' },
  { slug: 'learning-how-to-learn', label: 'Learning how to learn' },
] as const;

export type QaTopicSlug = (typeof QA_TOPICS)[number]['slug'];
export type QaTopic = { slug: QaTopicSlug; label: string };
export type QaTopicSummary = QaTopic & { openCount: number };

/** Questions close by themselves after this many days without activity. */
export const QA_AUTO_CLOSE_DAYS = 14;

export type QaQuestionStatus = 'open' | 'answered' | 'closed';

export type QaQuestion = {
  id: string;
  topic: QaTopicSlug;
  title: string;
  body: string;
  status: QaQuestionStatus;
  answerCount: number;
  acceptedAnswerId: string | null;
  /** Minors are shown as "A student" with no handle/avatar. */
  author: PersonRef;
  isMine: boolean;
  lastActivityAt: string;
  /** Number of attached images/files; the files themselves come with the detail. */
  attachmentCount: number;
  /** When the question will auto-close; null once closed. */
  closesAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The asker's single follow-up to one answer. */
export type QaClarification = { id: string; body: string; createdAt: string };

export type QaAnswer = {
  id: string;
  questionId: string;
  author: PersonRef;
  body: string;
  accepted: boolean;
  isMine: boolean;
  clarification: QaClarification | null;
  /** Short-lived view URLs; re-fetch the question to refresh. */
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
};

export type QaQuestionDetail = {
  question: QaQuestion;
  /** The question's images/files (short-lived view URLs). */
  attachments: Attachment[];
  answers: QaAnswer[];
  /** Server-computed so the client never re-implements the rules. */
  permissions: { canAnswer: boolean; canEdit: boolean; canClose: boolean; canAccept: boolean; canClarify: boolean; canReport: boolean };
};

/** A teacher's accepted answer, shown on their profile as trust evidence. */
export type QaAcceptedAnswer = { answerId: string; questionId: string; topic: QaTopicSlug; questionTitle: string; excerpt: string; acceptedAt: string };

export type QaQuestionListParams = { topic?: QaTopicSlug; status?: QaQuestionStatus; cursor?: string; limit?: number };
/** Max images/files on one question or answer. */
export const QA_MAX_ATTACHMENTS = 5;
export type CreateQaQuestionInput = { topic: QaTopicSlug; title: string; body: string; attachmentFileIds?: string[] };
/** `attachmentFileIds` replaces the whole list; files left out are deleted. */
export type UpdateQaQuestionInput = Partial<{ topic: QaTopicSlug; title: string; body: string; attachmentFileIds: string[] }>;
export type QaBodyInput = { body: string };
export type QaAnswerInput = { body: string; attachmentFileIds?: string[] };
export type QaReportInput = { reason: ReportInput['reason']; details?: string };

// ---------------------------------------------------------------- uploads

export type UploadPurpose = 'avatar' | 'evidence' | 'qa';
export type UploadIntentInput = { purpose: UploadPurpose; fileName: string; mimeType: string; sizeBytes: number; relationId?: string };
export type UploadIntent = { bucketId: string; fileId: string; expiresAt: string };
export type UploadComplete = { fileId: string; bucketId: string };

// ---------------------------------------------------------------- health

export type Health = { ok: true; version: string; uptimeSec: number; checks?: Record<string, { ok: boolean; latencyMs: number }> };
