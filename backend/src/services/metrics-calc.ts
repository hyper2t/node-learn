/**
 * Pure ops-dashboard math. Inputs are plain rows (already filtered for test accounts);
 * all definitions follow docs/ops/2026-09-24-early-ops-12-week-plan.md appendix A.
 */
import type { AdminMetrics, AwaitingFeedback, MetricRate, MetricsWeek } from '../contracts/api';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;
/** Monday 1970-01-05 00:00 in Asia/Taipei (UTC+8, no DST). */
const TAIPEI_MONDAY_0 = 4 * DAY - 8 * HOUR;

export const weekStartOf = (ms: number) => TAIPEI_MONDAY_0 + Math.floor((ms - TAIPEI_MONDAY_0) / WEEK) * WEEK;

export function rate(num: number, den: number): MetricRate {
  return { num, den, pct: den ? Math.round((num / den) * 1000) / 10 : null };
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  const v = s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  return Math.round(v * 10) / 10;
}

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const inRange = (t: number, from: number, to: number) => t >= from && t < to;

export type MUser = { id: string; createdAt: string };
export type MRole = { userId: string; role: string; onboarded: boolean };
export type MRequest = { studentId: string; teacherId: string; status: string; relationId: string | null; createdAt: string };
export type MRelation = { id: string; studentId: string; teacherId: string; status: string; startedAt: string; endedAt: string | null; pausedAt?: string | null };
export type MEvidence = { id: string; relationId: string; title: string; status: string; submittedAt: string; updatedAt: string };
export type MFeedback = { evidenceId: string; createdAt: string };
export type MReview = { relationId: string; createdAt: string; removedAt: string | null };
export type MQuestion = { id: string; authorId: string; createdAt: string; acceptedAnswerId: string | null; removedAt: string | null };
export type MAnswer = { id: string; questionId: string; authorId: string; kind: string; createdAt: string; removedAt: string | null };
export type MetricsInput = {
  now: number; weeks: number;
  users: MUser[]; roles: MRole[]; requests: MRequest[]; relations: MRelation[]; evidence: MEvidence[]; feedback: MFeedback[];
  reviews: MReview[]; questions: MQuestion[]; answers: MAnswer[];
  names: Map<string, string>; excludedUsers: number;
};

/** When a relation became "complete": ≥28 days running and 3 evidence items with feedback. Null if never (or ended early). */
export function completedAt(rel: MRelation, firstFeedbackByEvidence: Map<string, number>, evidenceByRelation: Map<string, MEvidence[]>): number | null {
  const start = ms(rel.startedAt);
  const day28 = start + 28 * DAY;
  if (rel.endedAt && ms(rel.endedAt) < day28) return null;
  const fbTimes = (evidenceByRelation.get(rel.id) ?? []).map((e) => firstFeedbackByEvidence.get(e.id)).filter((t): t is number => t !== undefined).sort((a, b) => a - b);
  if (fbTimes.length < 3) return null;
  return Math.max(day28, fbTimes[2]!);
}

export function computeMetrics(inp: MetricsInput): AdminMetrics {
  const { now } = inp;
  const firstWeek = weekStartOf(now) - (inp.weeks - 1) * WEEK;
  const from = firstWeek;

  // Indexes
  const firstFb = new Map<string, number>();
  for (const f of inp.feedback) {
    const t = ms(f.createdAt);
    const cur = firstFb.get(f.evidenceId);
    if (cur === undefined || t < cur) firstFb.set(f.evidenceId, t);
  }
  const evByRel = new Map<string, MEvidence[]>();
  for (const e of inp.evidence) evByRel.set(e.relationId, [...(evByRel.get(e.relationId) ?? []), e]);
  const firstRelOf = new Map<string, number>();
  for (const r of inp.relations) for (const u of [r.studentId, r.teacherId]) {
    const t = ms(r.startedAt);
    if (!firstRelOf.has(u) || t < firstRelOf.get(u)!) firstRelOf.set(u, t);
  }
  const rolesOf = new Map<string, MRole[]>();
  for (const r of inp.roles) rolesOf.set(r.userId, [...(rolesOf.get(r.userId) ?? []), r]);
  const complete = new Map<string, number>();
  for (const r of inp.relations) { const c = completedAt(r, firstFb, evByRel); if (c !== null && c <= now) complete.set(r.id, c); }
  const liveReviews = new Set(inp.reviews.filter((r) => !r.removedAt).map((r) => r.relationId));

  const activated = (u: MUser) => { const t = firstRelOf.get(u.id); return t !== undefined && t <= ms(u.createdAt) + 48 * HOUR; };
  const activationOf = (users: MUser[]) => {
    const eligible = users.filter((u) => ms(u.createdAt) + 48 * HOUR <= now || activated(u)); // don't count people still inside their 48h
    return rate(eligible.filter(activated).length, eligible.length);
  };
  const activeIn = (r: MRelation, a: number, b: number) => ms(r.startedAt) < b && (!r.endedAt || ms(r.endedAt) >= a) && !(r.status === 'paused' && ms(r.pausedAt) < b);
  const fbHours = (evs: MEvidence[]) => evs.map((e) => firstFb.get(e.id)).map((t, i) => (t === undefined ? null : (t - ms(evs[i]!.submittedAt)) / HOUR)).filter((h): h is number => h !== null && h >= 0);

  // Weekly
  const weekly: MetricsWeek[] = [];
  for (let w = 0; w < inp.weeks; w++) {
    const a = firstWeek + w * WEEK;
    const b = a + WEEK;
    const signups = inp.users.filter((u) => inRange(ms(u.createdAt), a, b));
    const active = inp.relations.filter((r) => activeIn(r, a, b)).length;
    const evs = inp.evidence.filter((e) => inRange(ms(e.submittedAt), a, b));
    weekly.push({
      weekStart: new Date(a).toISOString(),
      signups: signups.length,
      activation48h: activationOf(signups),
      newRelations: inp.relations.filter((r) => inRange(ms(r.startedAt), a, b)).length,
      activeRelations: active,
      evidence: evs.length,
      evidencePerActive: active ? Math.round((evs.length / active) * 100) / 100 : null,
      feedbackMedianHours: median(fbHours(evs)),
      reviews: inp.reviews.filter((r) => !r.removedAt && inRange(ms(r.createdAt), a, b)).length,
      completeRelations: [...complete.values()].filter((t) => t < b).length,
    });
  }

  // Window totals
  const winUsers = inp.users.filter((u) => ms(u.createdAt) >= from);
  const isRole = (u: MUser, role: string) => (rolesOf.get(u.id) ?? []).some((r) => r.role === role);
  const winEvidence = inp.evidence.filter((e) => ms(e.submittedAt) >= from);
  const fullWeeks = weekly.slice(0, -1).filter((w) => w.activeRelations > 0); // exclude the running week
  const evPerActive = fullWeeks.length ? Math.round((fullWeeks.reduce((n, w) => n + w.evidence, 0) / fullWeeks.reduce((n, w) => n + w.activeRelations, 0)) * 100) / 100 : null;

  const awaiting: AwaitingFeedback[] = [];
  const relById = new Map(inp.relations.map((r) => [r.id, r]));
  for (const e of inp.evidence) {
    if (e.status !== 'submitted' && e.status !== 'revised') continue;
    const rel = relById.get(e.relationId);
    if (!rel || rel.status !== 'active') continue;
    const since = e.status === 'revised' ? ms(e.updatedAt) : ms(e.submittedAt);
    const hours = (now - since) / HOUR;
    if (hours < 48) continue;
    awaiting.push({
      evidenceId: e.id, relationId: e.relationId, title: e.title, teacherId: rel.teacherId,
      teacherName: inp.names.get(rel.teacherId) ?? rel.teacherId, studentName: inp.names.get(rel.studentId) ?? rel.studentId,
      waitingSince: new Date(since).toISOString(), hours: Math.round(hours),
    });
  }
  awaiting.sort((x, y) => y.hours - x.hours);

  const matured = inp.relations.filter((r) => ms(r.startedAt) + 28 * DAY <= now);
  const ended = inp.relations.filter((r) => r.status === 'ended');

  // Funnel (events inside the window)
  const winRels = inp.relations.filter((r) => ms(r.startedAt) >= from);
  const winReq = inp.requests.filter((r) => ms(r.createdAt) >= from);

  // Q&A
  const winQ = inp.questions.filter((q) => !q.removedAt && ms(q.createdAt) >= from);
  const answersByQ = new Map<string, MAnswer[]>();
  for (const a of inp.answers) if (a.kind === 'answer' && !a.removedAt) answersByQ.set(a.questionId, [...(answersByQ.get(a.questionId) ?? []), a]);
  const q24 = winQ.filter((q) => ms(q.createdAt) + 24 * HOUR <= now || (answersByQ.get(q.id) ?? []).length);
  const answered24 = q24.filter((q) => (answersByQ.get(q.id) ?? []).some((a) => ms(a.createdAt) - ms(q.createdAt) <= 24 * HOUR));
  const qById = new Map(inp.questions.map((q) => [q.id, q]));
  const toRequests = winReq.filter((req) => inp.answers.some((a) => a.kind === 'answer' && a.authorId === req.teacherId && ms(a.createdAt) < ms(req.createdAt) && qById.get(a.questionId)?.authorId === req.studentId)).length;

  return {
    generatedAt: new Date(now).toISOString(), timeZone: 'Asia/Taipei', weeks: inp.weeks,
    totals: {
      signups: winUsers.length,
      activation48h: activationOf(winUsers),
      activationStudents: activationOf(winUsers.filter((u) => isRole(u, 'student'))),
      activationTeachers: activationOf(winUsers.filter((u) => isRole(u, 'teacher'))),
      evidencePerActiveWeek: evPerActive,
      feedbackMedianHours: median(fbHours(winEvidence)),
      awaitingOver48h: awaiting.length,
      retention4w: rate(matured.filter((r) => !r.endedAt || ms(r.endedAt) >= ms(r.startedAt) + 28 * DAY).length, matured.length),
      reviewRate: rate(ended.filter((r) => liveReviews.has(r.id)).length, ended.length),
      completeRelations: complete.size,
    },
    funnel: {
      signups: winUsers.length,
      studentsOnboarded: winUsers.filter((u) => (rolesOf.get(u.id) ?? []).some((r) => r.role === 'student' && r.onboarded)).length,
      teachersOnboarded: winUsers.filter((u) => (rolesOf.get(u.id) ?? []).some((r) => r.role === 'teacher' && r.onboarded)).length,
      requests: winReq.length,
      accepted: winReq.filter((r) => r.status === 'accepted' || !!r.relationId).length,
      firstEvidence: winRels.filter((r) => (evByRel.get(r.id) ?? []).length > 0).length,
      firstFeedback: winRels.filter((r) => (evByRel.get(r.id) ?? []).some((e) => firstFb.has(e.id))).length,
      complete: winRels.filter((r) => complete.has(r.id)).length,
    },
    qa: { questions: winQ.length, answered24h: rate(answered24.length, q24.length), accepted: winQ.filter((q) => !!q.acceptedAnswerId).length, toRequests },
    weekly,
    awaiting: awaiting.slice(0, 50),
    excludedUsers: inp.excludedUsers,
  };
}
