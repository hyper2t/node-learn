import { describe, expect, it } from 'vitest';
import { pairKey } from '../src/db/rows';

describe('pairKey', () => {
  it('is order independent', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
  });
});
