import { describe, expect, it } from 'vitest';
import { parseMarkdown, slugify, splitInlineMath } from '../parse';

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

describe('math (opt-in)', () => {
  const m = (s: string) => parseMarkdown(s, { math: true }).blocks;

  it('is off by default', () => {
    expect(parseMarkdown('$x$').blocks).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: '$x$' }] }]);
  });

  it('parses inline $…$ and \\(…\\)', () => {
    expect(m('a $x^2$ b \\(y\\)')).toEqual([{ type: 'paragraph', children: [
      { type: 'text', text: 'a ' }, { type: 'math', tex: 'x^2', display: false },
      { type: 'text', text: ' b ' }, { type: 'math', tex: 'y', display: false },
    ] }]);
  });

  it('keeps prices and escaped dollars as text', () => {
    expect(m('costs $5 and $10 today')).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: 'costs $5 and $10 today' }] }]);
    expect(m('\\$x\\$')).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: '$x$' }] }]);
  });

  it('does not treat underscores inside math as emphasis', () => {
    expect(m('$a_1 + b_2$')).toEqual([{ type: 'paragraph', children: [{ type: 'math', tex: 'a_1 + b_2', display: false }] }]);
  });

  it('parses display blocks ($$ and \\[) across lines', () => {
    expect(m('intro\n\n$$\n\\frac{a}{b}\n$$\n\nafter')).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'intro' }] },
      { type: 'math', tex: '\\frac{a}{b}' },
      { type: 'paragraph', children: [{ type: 'text', text: 'after' }] },
    ]);
    expect(m('\\[ x = 1 \\]')).toEqual([{ type: 'math', tex: 'x = 1' }]);
    expect(m('text\n$$x$$')).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: 'text' }] }, { type: 'math', tex: 'x' }]);
  });

  it('leaves unterminated display math as text and code untouched', () => {
    expect(m('$$\nx')[0]!.type).toBe('paragraph');
    expect(m('`$x$`')).toEqual([{ type: 'paragraph', children: [{ type: 'code', text: '$x$' }] }]);
  });

  it('accepts spaced $ x^2 $ and full-width ＄ when the content looks like TeX', () => {
    expect(m('$ x^2 $')).toEqual([{ type: 'paragraph', children: [{ type: 'math', tex: 'x^2', display: false }] }]);
    expect(m('＄\\frac{1}{2}＄')).toEqual([{ type: 'paragraph', children: [{ type: 'math', tex: '\\frac{1}{2}', display: false }] }]);
    expect(m('价格 $5 和 $10')).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: '价格 $5 和 $10' }] }]);
    expect(m('from $ 5 to $ 10')).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: 'from $ 5 to $ 10' }] }]);
  });

  it('splitInlineMath handles titles', () => {
    expect(splitInlineMath('Why is $e^{i\\pi}=-1$ \\$5?')).toEqual([
      { type: 'text', text: 'Why is ' }, { type: 'math', tex: 'e^{i\\pi}=-1', display: false }, { type: 'text', text: ' $5?' },
    ]);
  });
});
