import { describe, expect, it } from 'vitest';
import { addMany, addTag, hasTag, MAX_TAGS, normalizeTag, removeTag } from '../tags';

describe('tags', () => {
  it('normalizes whitespace', () => {
    expect(normalizeTag('  machine   learning ')).toBe('machine learning');
  });

  it('adds trimmed tags and de-duplicates case-insensitively', () => {
    let list = addTag([], ' Math ');
    list = addTag(list, 'math');
    list = addTag(list, 'MATH');
    expect(list).toEqual(['Math']);
    list = addTag(list, 'Physics');
    expect(list).toEqual(['Math', 'Physics']);
  });

  it('caps at max and returns the same reference when nothing changed', () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`);
    expect(addTag(full, 'extra')).toBe(full);
    expect(addTag(['a'], '   ')).toEqual(['a']);
  });

  it('hasTag ignores case and surrounding whitespace', () => {
    expect(hasTag(['Exam prep'], ' exam  PREP ')).toBe(true);
    expect(hasTag(['Exam prep'], 'exams')).toBe(false);
  });

  it('addMany splits comma separated input', () => {
    expect(addMany([], 'music, Music ,art,')).toEqual(['music', 'art']);
  });

  it('removeTag removes exact entries', () => {
    expect(removeTag(['a', 'b'], 'a')).toEqual(['b']);
  });
});

