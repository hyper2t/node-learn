import { describe, expect, it } from 'vitest';
import { applySnippet, insideMath, isStemTopic, SNIPPET_GROUPS, type MathSnippet } from '../math-snippets';

const get = (id: string) => SNIPPET_GROUPS.flatMap((g) => g.snippets).find((s) => s.id === id) as MathSnippet;

describe('math snippets', () => {
  it('knows which topics are STEM', () => {
    expect(isStemTopic('math')).toBe(true);
    expect(isStemTopic('history')).toBe(false);
    expect(isStemTopic(null)).toBe(false);
  });

  it('detects math context', () => {
    expect(insideMath('a $x', 4)).toBe(true);
    expect(insideMath('a $x$ b', 7)).toBe(false);
    expect(insideMath('cost \\$5 ', 9)).toBe(false);
    expect(insideMath('$$\n', 3)).toBe(true);
  });

  it('wraps commands in $…$ outside math and places the cursor', () => {
    const r = applySnippet('Find ', { start: 5, end: 5 }, get('frac'));
    expect(r.value).toBe('Find $\\frac{}{}$');
    expect(r.selection).toEqual({ start: 12, end: 12 });
  });

  it('does not re-wrap inside math', () => {
    const r = applySnippet('$x + $', { start: 5, end: 5 }, get('sum'));
    expect(r.value).toBe('$x + \\sum_{i=1}^{n} $');
  });

  it('wraps the current selection', () => {
    const r = applySnippet('ab', { start: 0, end: 2 }, get('inline'));
    expect(r.value).toBe('$ab$');
    expect(r.selection).toEqual({ start: 1, end: 3 });
  });

  it('uses the inline form of block snippets in single-line fields', () => {
    expect(applySnippet('', { start: 0, end: 0 }, get('display'), { singleLine: true }).value).toBe('$$');
    expect(applySnippet('', { start: 0, end: 0 }, get('display')).value).toBe('$$\n\n$$\n');
    expect(applySnippet('text', { start: 4, end: 4 }, get('display')).value).toBe('text\n$$\n\n$$\n');
  });
});
