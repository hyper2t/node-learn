import type { RelationSummary } from '@/types/api';

type Labels = {
  title: string; period: (from: string, to: string, weeks: number) => string; achieved: string; dropped: string; open: string; numbers: string;
  tasksDone: string; evidence: string; feedback: string; revisions: string; closingNote: string; endReason: string; none: string;
};

/** Plain Markdown so it pastes cleanly into notes, email or a portfolio. `date` formats ISO strings for display. */
export function summaryToMarkdown(s: RelationSummary, l: Labels, date: (iso: string) => string): string {
  const out: string[] = [];
  out.push(`# ${l.title}`, '', `${s.student.displayName} · ${s.teacher.displayName}`, l.period(date(s.startedAt), date(s.endedAt), s.weeks), '');
  const list = (heading: string, items: string[]) => { out.push(`## ${heading}`); out.push(...(items.length ? items.map((i) => `- ${i}`) : [`- ${l.none}`]), ''); };
  list(l.achieved, s.goals.achieved.map((g) => `${g.title} (${date(g.achievedAt)})`));
  if (s.goals.open.length) list(l.open, s.goals.open.map((g) => g.title));
  if (s.goals.dropped.length) list(l.dropped, s.goals.dropped.map((g) => g.title));
  out.push(`## ${l.numbers}`, `- ${l.tasksDone}: ${s.counts.tasksDone}`, `- ${l.evidence}: ${s.counts.evidenceSubmitted}`, `- ${l.feedback}: ${s.counts.feedbackReceived}`, `- ${l.revisions}: ${s.counts.revisions}`, '');
  if (s.closingNote) out.push(`## ${l.closingNote}`, ...s.closingNote.split('\n').map((line) => `> ${line}`), '');
  if (s.endReason) out.push(`${l.endReason}: ${s.endReason}`, '');
  return out.join('\n').trimEnd() + '\n';
}
