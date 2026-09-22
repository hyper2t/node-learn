import { t } from '@/shared/i18n';
import type { LearningMessage } from '@/types/api';

export function messagePreview(m: LearningMessage | null): string {
  if (!m) return '';
  const p = m.payload;
  switch (p.type) {
    case 'text': return p.text;
    case 'goal_created': return t('messages.goalCreated', { title: p.title });
    case 'task_assigned': return t('messages.taskAssigned', { title: p.title });
    case 'evidence_submitted': return t('messages.evidenceSubmitted', { title: p.title });
    case 'feedback_added': return `${t('messages.feedbackAdded')}: ${p.excerpt}`;
    case 'milestone_reached': return t('messages.milestone', { title: p.title });
    case 'system': return p.text;
  }
}
