import { QA_TOPICS } from '@/types/api';

/** Suggested topics offered as tappable tags on the student profile (onboarding + settings). Same labels as the Q&A catalogue so profiles match Q&A topics. */
export const TOPIC_SUGGESTIONS = QA_TOPICS.map((t) => t.label);
