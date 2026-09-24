/**
 * Ops dashboard in the terminal (definitions: docs/ops/2026-09-24-early-ops-12-week-plan.md, appendix A).
 *   npm --prefix backend run metrics
 *   npm --prefix backend run metrics -- --weeks 4
 *   npm --prefix backend run metrics -- --csv > metrics.csv
 * Set METRICS_EXCLUDE_EMAILS (regex) to drop test accounts.
 */
import { getConfig } from '../src/config';
import type { MetricRate } from '../src/contracts/api';
import { loadMetrics } from '../src/services/metrics';

getConfig();
const arg = (name: string) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
const weeks = Math.min(52, Math.max(1, Number(arg('--weeks') ?? 12) || 12));
const csv = process.argv.includes('--csv');
const m = await loadMetrics(weeks);

const pct = (r: MetricRate) => (r.pct === null ? '—' : `${r.pct}% (${r.num}/${r.den})`);
const n = (v: number | null) => (v === null ? '—' : String(v));
const day = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 10);

if (csv) {
  console.log('week_start,signups,activation48h_pct,new_relations,active_relations,evidence,evidence_per_active,feedback_median_h,reviews,complete_cumulative');
  for (const w of m.weekly) console.log([day(w.weekStart), w.signups, w.activation48h.pct ?? '', w.newRelations, w.activeRelations, w.evidence, w.evidencePerActive ?? '', w.feedbackMedianHours ?? '', w.reviews, w.completeRelations].join(','));
  process.exit(0);
}

const t = m.totals;
console.log(`\nNode Learn metrics · last ${m.weeks} weeks · ${m.timeZone} · excluded ${m.excludedUsers} accounts\n`);
console.table({
  '★ Complete relations (all time)': t.completeRelations,
  '48h activation': pct(t.activation48h),
  '  students': pct(t.activationStudents),
  '  teachers': pct(t.activationTeachers),
  'Evidence / active relation / week': n(t.evidencePerActiveWeek),
  'Feedback median (h)': n(t.feedbackMedianHours),
  'Awaiting feedback > 48h': t.awaitingOver48h,
  '4-week retention (all time)': pct(t.retention4w),
  'Review rate (all time)': pct(t.reviewRate),
});
console.log('Funnel'); console.table(m.funnel);
console.log('Q&A'); console.table({ questions: m.qa.questions, answered24h: pct(m.qa.answered24h), accepted: m.qa.accepted, toRequests: m.qa.toRequests });
console.log('Weekly');
console.table(m.weekly.map((w) => ({ week: day(w.weekStart), signups: w.signups, act48h: w.activation48h.pct ?? '—', newRel: w.newRelations, active: w.activeRelations, evidence: w.evidence, perActive: n(w.evidencePerActive), fbMedianH: n(w.feedbackMedianHours), reviews: w.reviews, complete: w.completeRelations })));
if (m.awaiting.length) {
  console.log('Awaiting feedback > 48h');
  console.table(m.awaiting.map((a) => ({ hours: a.hours, teacher: a.teacherName, student: a.studentName, title: a.title })));
}
process.exit(0);
