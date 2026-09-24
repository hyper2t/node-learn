import { Query } from 'node-appwrite';
import { getRow, listRows } from '../db/repo';
import type { LearningRelationRow, LearningTaskRow } from '../db/rows';
import { TABLES } from '../db/schema';
import { log } from '../log';
import { notify } from './notifications';

const HOUR = 3_600_000;
/** "Due soon" fires once when a task enters its last 24 hours. */
export const DUE_SOON_WINDOW_MS = 24 * HOUR;
/** Overdue tasks older than this are no longer scanned (they were notified long ago). */
export const OVERDUE_LOOKBACK_MS = 7 * 24 * HOUR;

export type ReminderKind = 'due_soon' | 'overdue';
export type Reminder = { taskId: string; relationId: string; title: string; dueAt: string; kind: ReminderKind };

/** Pure: which open tasks need which reminder at `now`. */
export function selectDueTasks(now: Date, tasks: Pick<LearningTaskRow, '$id' | 'relationId' | 'title' | 'status' | 'dueAt'>[]): Reminder[] {
  const t = now.getTime();
  const out: Reminder[] = [];
  for (const task of tasks) {
    if (task.status !== 'open' || !task.dueAt) continue;
    const due = Date.parse(task.dueAt);
    if (Number.isNaN(due)) continue;
    if (due <= t && due > t - OVERDUE_LOOKBACK_MS) out.push({ taskId: task.$id, relationId: task.relationId, title: task.title, dueAt: task.dueAt, kind: 'overdue' });
    else if (due > t && due <= t + DUE_SOON_WINDOW_MS) out.push({ taskId: task.$id, relationId: task.relationId, title: task.title, dueAt: task.dueAt, kind: 'due_soon' });
  }
  return out;
}

export type ReminderStats = { tasksScanned: number; dueSoon: number; overdue: number; skippedInactive: number };

/**
 * Hourly job. Idempotent: every notification carries a per-task dedupe key, so reruns and overlapping
 * schedules never double-notify. Only relations that are still active get reminders.
 */
export async function runTaskReminders(now = new Date(), batchSize = 200): Promise<ReminderStats> {
  const stats: ReminderStats = { tasksScanned: 0, dueSoon: 0, overdue: 0, skippedInactive: 0 };
  const from = new Date(now.getTime() - OVERDUE_LOOKBACK_MS).toISOString();
  const to = new Date(now.getTime() + DUE_SOON_WINDOW_MS).toISOString();
  const rels = new Map<string, LearningRelationRow | null>();
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const q = [Query.equal('status', 'open'), Query.greaterThan('dueAt', from), Query.lessThanEqual('dueAt', to), Query.orderAsc('$id'), Query.limit(batchSize)];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const tasks = await listRows<LearningTaskRow>(TABLES.learningTasks, q);
    stats.tasksScanned += tasks.length;
    for (const r of selectDueTasks(now, tasks)) {
      if (!rels.has(r.relationId)) rels.set(r.relationId, await getRow<LearningRelationRow>(TABLES.learningRelations, r.relationId));
      const rel = rels.get(r.relationId);
      if (!rel || rel.status !== 'active') { stats.skippedInactive++; continue; }
      const href = `/relations/${rel.$id}`;
      if (r.kind === 'due_soon') {
        await notify({ userId: rel.studentId, type: 'task.due_soon', title: 'Task due within 24 hours', body: r.title, href, refType: 'learning_task', refId: r.taskId, dedupeKey: `task.due_soon:${r.taskId}:${r.dueAt}` });
        stats.dueSoon++;
      } else {
        await notify({ userId: rel.studentId, type: 'task.overdue', title: 'Task is overdue', body: r.title, href, refType: 'learning_task', refId: r.taskId, dedupeKey: `task.overdue:${r.taskId}:${r.dueAt}` });
        await notify({ userId: rel.teacherId, type: 'task.overdue', title: 'A learner\'s task is overdue', body: r.title, href, refType: 'learning_task', refId: r.taskId, dedupeKey: `task.overdue:teacher:${r.taskId}:${r.dueAt}` });
        stats.overdue++;
      }
    }
    if (tasks.length < batchSize) break;
    cursor = tasks[tasks.length - 1]!.$id;
  }
  log('info', 'task_reminders_done', stats);
  return stats;
}
