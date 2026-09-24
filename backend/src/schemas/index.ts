import { z } from 'zod';
import { QA_MAX_ATTACHMENTS, QA_TOPICS, type QaTopicSlug } from '../contracts/api';

const trimmed = (max: number, min = 1) => z.string().trim().min(min).max(max);
const cursor = z.string().min(1).max(64).optional();
const limit = z.coerce.number().int().min(1).max(50).default(20);
export const role = z.enum(['student', 'teacher']);
export const visibility = z.enum(['public', 'contacts', 'relations', 'private']);

export const updateMe = z.object({
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{2,31}$/, 'Use 3–32 letters, numbers, dots, dashes or underscores.').optional(),
  displayName: trimmed(80).optional(),
  locale: z.string().trim().min(2).max(16).optional(),
  timeZone: z.string().trim().min(1).max(64).optional(),
}).strict();
export const ageGate = z.object({ ageBand: z.enum(['under_16', '16_17', '18_plus']), acceptPrivacy: z.literal(true) }).strict();
export const selectRole = z.object({ role, activate: z.boolean().optional() }).strict();

export const updateStudentProfile = z.object({
  headline: z.string().trim().max(120).optional(), goalSummary: z.string().trim().max(2000).optional(),
  interests: z.array(trimmed(64)).max(10).optional(), visibility: visibility.optional(),
}).strict();
export const updateTeacherProfile = z.object({
  headline: z.string().trim().max(120).optional(), bio: z.string().trim().max(4000).optional(), subjects: z.array(trimmed(64)).max(10).optional(),
  approach: z.string().trim().max(2000).optional(), acceptingRequests: z.boolean().optional(), visibility: visibility.optional(),
}).strict();
const boolish = z.preprocess((v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : v), z.boolean());
export const teacherSearch = z.object({ q: z.string().trim().max(80).optional(), subject: z.string().trim().max(64).optional(), accepting: boolish.optional(), sort: z.enum(['relevance', 'newest', 'most_reviewed']).optional(), cursor, limit });

export const createLearningRequest = z.object({ teacherId: trimmed(36), goalTitle: trimmed(120), message: z.string().trim().max(2000).default('') }).strict();
export const createTeacherInvitation = z.object({ studentId: trimmed(36), goalTitle: trimmed(120), message: z.string().trim().max(2000).default('') }).strict();
export const requestList = z.object({ role, status: z.enum(['pending', 'accepted', 'declined', 'cancelled', 'expired']).optional(), cursor, limit });

export const relationList = z.object({ role, status: z.enum(['active', 'paused', 'ended']).optional(), cursor, limit });
export const relationStatus = z.object({ status: z.enum(['active', 'paused', 'ended']), reason: z.string().trim().max(500).optional() }).strict();
export const createGoal = z.object({ title: trimmed(120), description: z.string().trim().max(2000).optional() }).strict();
export const updateGoal = z.object({ title: trimmed(120).optional(), description: z.string().trim().max(2000).optional(), status: z.enum(['active', 'achieved', 'dropped']).optional() }).strict();
export const createTask = z.object({ title: trimmed(120), instructions: z.string().trim().max(4000).optional(), goalId: z.string().max(36).nullable().optional(), dueAt: z.string().datetime().nullable().optional() }).strict();
export const updateTask = z.object({ title: trimmed(120).optional(), instructions: z.string().trim().max(4000).optional(), status: z.enum(['open', 'submitted', 'reviewed', 'done', 'dropped']).optional(), dueAt: z.string().datetime().nullable().optional() }).strict();

export const createEvidence = z.object({ title: trimmed(120), body: z.string().trim().max(8000), taskId: z.string().max(36).nullable().optional(), goalId: z.string().max(36).nullable().optional(), attachmentFileIds: z.array(z.string().max(36)).max(5).optional() }).strict();
export const createFeedback = z.object({ body: trimmed(4000), nextStep: z.string().trim().max(300).optional(), markTaskDone: z.boolean().optional(), outcome: z.enum(['approved', 'needs_revision']).optional() }).strict();
export const reviseEvidence = z.object({ title: trimmed(120).optional(), body: z.string().trim().max(8000).optional(), attachmentFileIds: z.array(z.string().max(36)).max(5).optional() }).strict()
  .refine((v) => v.title !== undefined || v.body !== undefined || v.attachmentFileIds !== undefined, { message: 'Change at least one field.' });
export const declineGoalCompletion = z.object({ note: z.string().trim().max(300).optional() }).strict();
export const paged = z.object({ cursor, limit });

export const sendMessage = z.object({ clientMessageId: trimmed(64), text: trimmed(4000) }).strict();
export const messageList = z.object({ afterSequence: z.coerce.number().int().min(0).optional(), beforeSequence: z.coerce.number().int().min(1).optional(), limit });
export const markRead = z.object({ sequence: z.number().int().min(0) }).strict();

export const lookup = z.object({ handle: trimmed(32) });
export const createConnectionRequest = z.object({ toUserId: trimmed(36), message: z.string().trim().max(500).default('') }).strict();
export const connectionList = z.object({ direction: z.enum(['incoming', 'outgoing']).default('incoming'), cursor, limit });
export const blockInput = z.object({ userId: trimmed(36) }).strict();
export const reportInput = z.object({ targetUserId: trimmed(36), reason: z.enum(['harassment', 'spam', 'inappropriate', 'other']), details: z.string().trim().max(2000).optional() }).strict();

export const uploadIntent = z.object({ purpose: z.enum(['avatar', 'evidence', 'qa']), fileName: trimmed(255), mimeType: trimmed(128), sizeBytes: z.number().int().min(1), relationId: z.string().max(36).optional() }).strict();
export const uploadComplete = z.object({ fileId: trimmed(36) }).strict();

export const notificationList = z.object({ cursor, limit, unreadOnly: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).optional() });
export const markNotificationsRead = z.object({ ids: z.array(trimmed(36)).max(100).optional(), all: z.boolean().optional() }).strict()
  .refine((v) => v.all || (v.ids && v.ids.length > 0), { message: 'Provide ids or all=true.' });
export const reportList = z.object({ status: z.enum(['open', 'resolved']).optional(), cursor, limit });
export const resolveReport = z.object({ action: z.enum(['dismiss', 'warn', 'suspend', 'remove_content']), note: z.string().trim().max(1000).optional() }).strict();

// --- topic Q&A
const qaTopicSlugs = QA_TOPICS.map((t) => t.slug) as [QaTopicSlug, ...QaTopicSlug[]];
export const qaTopic = z.enum(qaTopicSlugs);
export const qaQuestionList = z.object({ topic: qaTopic.optional(), status: z.enum(['open', 'answered', 'closed']).optional(), cursor, limit });
const qaAttachmentIds = z.array(z.string().trim().min(1).max(36)).max(QA_MAX_ATTACHMENTS);
export const createQaQuestion = z.object({ topic: qaTopic, title: trimmed(160, 8), body: trimmed(8000, 20), attachmentFileIds: qaAttachmentIds.optional() }).strict();
export const updateQaQuestion = z.object({ topic: qaTopic.optional(), title: trimmed(160, 8).optional(), body: trimmed(8000, 20).optional(), attachmentFileIds: qaAttachmentIds.optional() }).strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });
export const qaBody = z.object({ body: trimmed(8000, 2) }).strict();
export const qaAnswerBody = z.object({ body: trimmed(8000, 2), attachmentFileIds: qaAttachmentIds.optional() }).strict();
export const qaReport = z.object({ reason: z.enum(['harassment', 'spam', 'inappropriate', 'other']), details: z.string().trim().max(2000).optional() }).strict();
