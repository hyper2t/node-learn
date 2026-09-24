import { describe, expect, it } from 'vitest';
import { daysFromNow, isOverdue, parseDueDate, toDateField } from '../dates';

const now = new Date(2026, 8, 24, 15, 0, 0); // 24 Sep 2026, 15:00 local

describe('parseDueDate', () => {
  it('empty means no due date', () => { expect(parseDueDate('  ', now)).toBeNull(); });
  it('rejects bad formats, impossible dates and the past', () => {
    expect(parseDueDate('2026/09/30', now)).toBeUndefined();
    expect(parseDueDate('2026-02-30', now)).toBeUndefined();
    expect(parseDueDate('2026-09-23', now)).toBeUndefined();
  });
  it('today is allowed and maps to the end of the local day', () => {
    const iso = parseDueDate('2026-09-24', now)!;
    const d = new Date(iso);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 8, 24, 23, 59]);
  });
  it('round-trips through the date field', () => {
    expect(toDateField(parseDueDate('2026-10-01', now))).toBe('2026-10-01');
    expect(daysFromNow(7, now)).toBe('2026-10-01');
  });
});

describe('isOverdue', () => {
  it('only open tasks past their due date', () => {
    const past = new Date(now.getTime() - 60_000).toISOString();
    expect(isOverdue({ status: 'open', dueAt: past }, now.getTime())).toBe(true);
    expect(isOverdue({ status: 'submitted', dueAt: past }, now.getTime())).toBe(false);
    expect(isOverdue({ status: 'open', dueAt: null }, now.getTime())).toBe(false);
  });
});
