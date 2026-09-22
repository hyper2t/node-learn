import { describe, expect, it } from 'vitest';
import { parseMarkdown, slugify } from '../parse';

describe('slugify', () => {
  it('makes GitHub-style anchors', () => {
    expect(slugify('What we collect')).toBe('what-we-collect');
    expect(slugify('Your rights — export & delete!')).toBe('your-rights-export-delete');
    expect(slugify('Under 16')).toBe('under-16');
    expect(slugify('Résumé')).toBe('resume');
  });
});

describe('parseMarkdown', () => {
  it('builds headings with unique ids and a two-level toc', () => {
    const { blocks, toc } = parseMarkdown('## A\n\ntext\n\n### B\n\n## A\n\n#### deep');
    const ids = blocks.flatMap((b) => (b.type === 'heading' ? [b.id] : []));
    expect(ids).toEqual(['a', 'b', 'a-1', 'deep']);
    expect(toc).toEqual([
      { id: 'a', text: 'A', level: 2, depth: 0 },
      { id: 'b', text: 'B', level: 3, depth: 1 },
      { id: 'a-1', text: 'A', level: 2, depth: 0 },
    ]);
  });

  it('strips inline markup from toc text', () => {
    const { toc } = parseMarkdown('## Your **rights** and `code`');
    expect(toc[0]).toMatchObject({ id: 'your-rights-and-code', text: 'Your rights and code' });
  });

  it('parses inline emphasis, code and links', () => {
    const { blocks } = parseMarkdown('Hello **bold _both_** and `x` at [site](https://example.com).');
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', text: 'Hello ' },
        { type: 'strong', children: [{ type: 'text', text: 'bold ' }, { type: 'em', children: [{ type: 'text', text: 'both' }] }] },
        { type: 'text', text: ' and ' },
        { type: 'code', text: 'x' },
        { type: 'text', text: ' at ' },
        { type: 'link', href: 'https://example.com', children: [{ type: 'text', text: 'site' }] },
        { type: 'text', text: '.' },
      ],
    });
  });

  it('joins soft line breaks with a space and keeps hard breaks', () => {
    const { blocks } = parseMarkdown('line one\nline two  \nline three');
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', text: 'line one line two' }, { type: 'br' }, { type: 'text', text: 'line three' }],
    });
  });

  it('parses bullet, ordered (with start) and nested lists', () => {
    const { blocks } = parseMarkdown('- one\n- two\n  - nested\n\n3. three\n4. four');
    const list = blocks[0];
    if (list?.type !== 'list') throw new Error('expected list');
    expect(list).toMatchObject({ ordered: false, start: 1 });
    expect(list.items).toHaveLength(2);
    expect(list.items[1]?.[1]).toMatchObject({ type: 'list', items: [[{ type: 'paragraph', children: [{ type: 'text', text: 'nested' }] }]] });
    expect(blocks[1]).toMatchObject({ type: 'list', ordered: true, start: 3 });
  });

  it('parses blockquotes, rules and fenced code; raw html stays text', () => {
    const { blocks } = parseMarkdown('> quoted\n\n---\n\n```\ncode here\n```\n\n<b>not html</b>');
    expect(blocks.map((b) => b.type)).toEqual(['blockquote', 'hr', 'code', 'paragraph']);
    expect(blocks[2]).toEqual({ type: 'code', text: 'code here' });
    expect(blocks[3]).toEqual({ type: 'paragraph', children: [{ type: 'text', text: '<b>not html</b>' }] });
  });

  it('decodes escapes and entities into plain text', () => {
    const { blocks } = parseMarkdown('1\\*2 &amp; done');
    expect(blocks[0]).toEqual({ type: 'paragraph', children: [{ type: 'text', text: '1*2 & done' }] });
  });

  it('returns an empty toc when there are no headings', () => {
    expect(parseMarkdown('just text').toc).toEqual([]);
  });
});
