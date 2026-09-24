import type { EvidenceItem, EvidenceStatus, Feedback, GoalStatus, LearningGoal, LearningRelation, LearningRequest, LearningTask, ProofRecord, RelationNextAction, RelationStatus, RequestKind, RequestStatus, TaskStatus, Attachment } from '../contracts/api';
import type { EvidenceItemRow, FeedbackEntryRow, LearningGoalRow, LearningRelationRow, LearningRequestRow, LearningTaskRow, ProofRecordRow } from '../db/rows';
import type { PersonRef } from './profile';

export const toLearningRequest = (r: LearningRequestRow, counterpart: PersonRef): LearningRequest => ({
  id: r.$id, kind: r.kind as RequestKind, studentId: r.studentId, teacherId: r.teacherId, initiatorId: r.initiatorId,
  goalTitle: r.goalTitle, message: r.message ?? '', status: r.status as RequestStatus, relationId: r.relationId,
  createdAt: r.createdAt, respondedAt: r.respondedAt, counterpart,
});

export const NO_ACTION: RelationNextAction = { kind: 'none', count: 0, dueAt: null };

export const toRelation = (r: LearningRelationRow, student: PersonRef, teacher: PersonRef, nextAction: RelationNextAction = NO_ACTION): LearningRelation => ({
  id: r.$id, studentId: r.studentId, teacherId: r.teacherId, sourceRequestId: r.sourceRequestId, status: r.status as RelationStatus,
  conversationId: r.conversationId, currentGoalId: r.currentGoalId, startedAt: r.startedAt, endedAt: r.endedAt, version: r.version,
  pausedBy: r.pausedBy ?? null, pausedAt: r.pausedAt ?? null, endedBy: r.endedBy ?? null, endReason: r.endReason ?? null,
  student, teacher, summary: { openTasks: r.openTasks, evidenceCount: r.evidenceCount, lastActivityAt: r.lastActivityAt }, nextAction,
});

export const toGoal = (g: LearningGoalRow): LearningGoal => ({
  id: g.$id, relationId: g.relationId, title: g.title, description: g.description ?? '', status: g.status as GoalStatus, createdBy: g.createdBy, createdAt: g.createdAt, updatedAt: g.updatedAt,
});

export const toTask = (t: LearningTaskRow): LearningTask => ({
  id: t.$id, relationId: t.relationId, goalId: t.goalId, title: t.title, instructions: t.instructions ?? '', status: t.status as TaskStatus,
  assignedBy: t.assignedBy, dueAt: t.dueAt, createdAt: t.createdAt, updatedAt: t.updatedAt,
});

export const toFeedback = (f: FeedbackEntryRow): Feedback => ({ id: f.$id, evidenceId: f.evidenceId, authorId: f.authorId, body: f.body ?? '', nextStep: f.nextStep ?? '', createdAt: f.createdAt });

export const toEvidence = (e: EvidenceItemRow, feedback: FeedbackEntryRow[], attachments: Attachment[] = []): EvidenceItem => ({
  id: e.$id, relationId: e.relationId, taskId: e.taskId, goalId: e.goalId, authorId: e.authorId, title: e.title, body: e.body ?? '',
  attachmentFileIds: e.attachmentFileIds ?? [], attachments, status: e.status as EvidenceStatus, version: e.version, submittedAt: e.submittedAt, reviewedAt: e.reviewedAt,
  feedback: feedback.map(toFeedback),
});

export function toProof(p: ProofRecordRow): ProofRecord {
  let milestones: ProofRecord['milestones'] = [];
  try {
    milestones = JSON.parse(p.milestonesJson ?? '[]') as ProofRecord['milestones'];
  } catch {
    milestones = [];
  }
  return {
    relationId: p.relationId, currentFocus: p.currentFocus, milestones,
    counts: { tasksDone: p.tasksDone, evidenceSubmitted: p.evidenceSubmitted, feedbackReceived: p.feedbackReceived, revisions: p.revisions },
    recentChange: p.recentChange, nextStep: p.nextStep, computedAt: p.computedAt,
  };
}
