import type { LearningTask } from '@/types/api';

export const isOverdue = (task: Pick<LearningTask, 'status' | 'dueAt'>, now = Date.now()) => task.status === 'open' && !!task.dueAt && Date.parse(task.dueAt) < now;

/** YYYY-MM-DD (local) → end of that local day as ISO; null for empty; undefined when invalid or in the past. */
export function parseDueDate(input: string, now = new Date()): string | null | undefined {
  const v = input.trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 0, 0);
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return undefined;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d < startOfToday) return undefined;
  return d.toISOString();
}

/** ISO → local YYYY-MM-DD for the date field. */
export function toDateField(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysFromNow(n: number, now = new Date()): string {
  return toDateField(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n).toISOString());
}

/** Whose turn it is, phrased for the viewer. Returns null when there is nothing to say (relation not active). */
