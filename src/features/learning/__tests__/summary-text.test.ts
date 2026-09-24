import { describe, expect, it } from 'vitest';
import { summaryToMarkdown } from '../summary-text';
import type { RelationSummary } from '@/types/api';

const person = (name: string) => ({ userId: name, displayName: name, handle: null, avatarFileId: null });
const base: RelationSummary = {
  relationId: 'r1', student: person('Mia'), teacher: person('Mr Lee'), startedAt: '2026-06-01T00:00:00.000Z', endedAt: '2026-09-01T00:00:00.000Z', weeks: 13,
  endedBy: 'Mr Lee', endReason: 'Exam passed',
  goals: { achieved: [{ id: 'g1', title: 'Fractions', achievedAt: '2026-07-01T00:00:00.000Z' }], dropped: [], open: [{ id: 'g2', title: 'Decimals' }] },
  counts: { tasksDone: 8, evidenceSubmitted: 10, feedbackReceived: 9, revisions: 2 }, milestones: [],
  closingNote: 'Great work.\nKeep practising.', closingNoteAt: '2026-09-02T00:00:00.000Z', closingNoteEditableUntil: '2026-09-15T00:00:00.000Z', generatedAt: '2026-09-01T00:00:00.000Z',
};
const labels = {
  title: 'Learning summary', period: (a: string, b: string, w: number) => `${a} – ${b} (${w} weeks)`, achieved: 'Goals achieved', dropped: 'Dropped', open: 'Not finished',
  numbers: 'In numbers', tasksDone: 'Tasks done', evidence: 'Evidence', feedback: 'Feedback', revisions: 'Revisions', closingNote: 'Closing note', endReason: 'Reason', none: 'None',
};

describe('summaryToMarkdown', () => {
  it('renders every section with quoted multi-line notes', () => {
    const md = summaryToMarkdown(base, labels, (iso) => iso.slice(0, 10));
    expect(md).toContain('# Learning summary');
    expect(md).toContain('2026-06-01 – 2026-09-01 (13 weeks)');
    expect(md).toContain('- Fractions (2026-07-01)');
    expect(md).toContain('## Not finished\n- Decimals');
    expect(md).not.toContain('## Dropped');
    expect(md).toContain('- Revisions: 2');
    expect(md).toContain('> Great work.\n> Keep practising.');
    expect(md.endsWith('Reason: Exam passed\n')).toBe(true);
  });
  it('shows "None" when nothing was achieved and omits the note when absent', () => {
    const md = summaryToMarkdown({ ...base, goals: { achieved: [], dropped: [], open: [] }, closingNote: null, endReason: null }, labels, (iso) => iso);
    expect(md).toContain('## Goals achieved\n- None');
    expect(md).not.toContain('Closing note');
  });
});
