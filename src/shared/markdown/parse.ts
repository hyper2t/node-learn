import MarkdownIt from 'markdown-it';

/**
 * Markdown → a small block/inline tree that the app renders with its own Text/View primitives
 * (no HTML, no WebView). Parsing is done by markdown-it (CommonMark, raw HTML disabled); this
 * module only reshapes its flat token stream and derives heading ids + a table of contents.
 *
 * Supported: headings, paragraphs, bullet/ordered (nested) lists, blockquotes, fenced code,
 * horizontal rules, **bold**, _italic_, `code`, [links](…). Anything else degrades to plain text.
 * Opt-in (`{ math: true }`): TeX math — inline `$…$` / `\(…\)`, display `$$…$$` / `\[…\]`.
 */
export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'br' }
  | { type: 'math'; tex: string; display: boolean };

export type HeadingBlock = { type: 'heading'; level: number; id: string; text: string; children: Inline[] };
export type Block =
  | HeadingBlock
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'code'; text: string }
  | { type: 'hr' }
  | { type: 'math'; tex: string };

/** `depth` is relative to the shallowest heading in the document (0 = top level, 1 = nested). */
export type TocEntry = { id: string; text: string; level: number; depth: number };
export type ParsedMarkdown = { blocks: Block[]; toc: TocEntry[] };

const md = new MarkdownIt('commonmark', { html: false, linkify: false, typographer: false });
type Token = ReturnType<typeof md.parse>[number];
type InlineState = Parameters<Parameters<typeof md.inline.ruler.before>[2]>[0];
type BlockState = Parameters<Parameters<typeof md.block.ruler.before>[2]>[0];

const DOLLAR = 0x24;
const BACKSLASH = 0x5c;
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

/**
 * Finds a math span starting at `pos` in `src`. Pandoc-style dollar rules keep prices like
 * "$5 and $10" as text: the opening `$` must be followed by non-space, the closing one preceded
 * by non-space and not followed by a digit. Escaped `\$` never delimits.
 */
export function matchInlineMath(src: string, pos: number): { tex: string; display: boolean; end: number } | null {
  const pair = (open: string, close: string, display: boolean) => {
    if (!src.startsWith(open, pos)) return null;
    const start = pos + open.length;
    let i = start;
    while ((i = src.indexOf(close, i)) !== -1) {
      if (src[i - 1] === '\\' && close[0] === '$') { i++; continue; }
      const tex = src.slice(start, i);
      if (!tex.trim()) return null;
      return { tex, display, end: i + close.length };
    }
    return null;
  };
  if (src.startsWith('\\(', pos)) return pair('\\(', '\\)', false);
  if (src.startsWith('\\[', pos)) return pair('\\[', '\\]', true);
  if (src[pos] !== '$') return null;
  if (src[pos + 1] === '$') return pair('$$', '$$', true);
  if (isSpace(src[pos + 1])) return null;
  let i = pos + 1;
  while ((i = src.indexOf('$', i)) !== -1) {
    if (src[i - 1] === '\\') { i++; continue; }
    if (!isSpace(src[i - 1]) && !/[0-9]/.test(src[i + 1] ?? '')) {
      return { tex: src.slice(pos + 1, i), display: false, end: i + 1 };
    }
    i++;
  }
  return null;
}

function mathInlineRule(state: InlineState, silent: boolean): boolean {
  const c = state.src.charCodeAt(state.pos);
  if (c !== DOLLAR && c !== BACKSLASH) return false;
  const m = matchInlineMath(state.src.slice(0, state.posMax), state.pos);
  if (!m) return false;
  if (!silent) {
    const t = state.push('math_inline', 'math', 0);
    t.content = m.tex;
    t.meta = { display: m.display };
  }
  state.pos = m.end;
  return true;
}

/** `$$` or `\[` opening a line, closed by `$$` / `\]` ending a (possibly the same) line. */
function mathBlockRule(state: BlockState, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  const lineText = (n: number) => state.src.slice(state.bMarks[n]! + state.tShift[n]!, state.eMarks[n]).trimEnd();
  const first = lineText(startLine);
  const open = first.startsWith('$$') ? '$$' : first.startsWith('\\[') ? '\\[' : null;
  if (!open) return false;
  const close = open === '$$' ? '$$' : '\\]';
  let rest = first.slice(2);
  let tex: string;
  let line = startLine;
  if (rest.trimEnd().endsWith(close) && rest.trim().length >= close.length) {
    const inner = rest.slice(0, rest.lastIndexOf(close));
    if (inner.includes(close)) return false; // "$$a$$ text $$b$$" → leave to inline
    tex = inner;
  } else {
    if (rest.includes(close)) return false; // closes mid-line → inline math in a paragraph
    const parts = [rest];
    let found = false;
    for (line = startLine + 1; line < endLine; line++) {
      if (state.sCount[line]! < state.blkIndent) break;
      const text = lineText(line);
      const at = text.indexOf(close);
      if (at !== -1) {
        if (text.slice(at + close.length).trim()) return false;
        parts.push(text.slice(0, at));
        found = true;
        break;
      }
      parts.push(text);
    }
    if (!found) return false;
    tex = parts.join('\n');
  }
  if (!tex.trim()) return false;
  if (silent) return true;
  state.line = line + 1;
  const t = state.push('math_block', 'math', 0);
  t.block = true;
  t.content = tex.trim();
  t.map = [startLine, state.line];
  return true;
}

const mdMath = new MarkdownIt('commonmark', { html: false, linkify: false, typographer: false });
mdMath.inline.ruler.before('escape', 'math_inline', mathInlineRule);
mdMath.block.ruler.before('fence', 'math_block', mathBlockRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

/** Splits a single-line string (e.g. a title) into text and inline-math runs; no other markdown. */
export function splitInlineMath(text: string): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  for (let i = 0; i < text.length; ) {
    if (text[i] === '\\' && text[i + 1] === '$') { buf += '$'; i += 2; continue; }
    const m = text[i] === '$' || text[i] === '\\' ? matchInlineMath(text, i) : null;
    if (m) {
      if (buf) out.push({ type: 'text', text: buf });
      buf = '';
      out.push({ type: 'math', tex: m.tex, display: false });
      i = m.end;
    } else {
      buf += text[i];
      i++;
    }
  }
  if (buf) out.push({ type: 'text', text: buf });
  return out;
}

/** GitHub-style anchor: lowercase, accents stripped, punctuation dropped, spaces → dashes. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function pushText(out: Inline[], text: string): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === 'text') last.text += text;
  else out.push({ type: 'text', text });
}

function inlineOf(token: Token | undefined): Inline[] {
  const kids = token?.children ?? [];
  let p = 0;
  const walk = (closeType: string | null): Inline[] => {
    const out: Inline[] = [];
    while (p < kids.length) {
      const t = kids[p]!;
      if (closeType && t.type === closeType) {
        p++;
        return out;
      }
      p++;
      switch (t.type) {
        case 'text':
          pushText(out, t.content);
          break;
        case 'softbreak':
          pushText(out, ' ');
          break;
        case 'hardbreak':
          out.push({ type: 'br' });
          break;
        case 'code_inline':
          out.push({ type: 'code', text: t.content });
          break;
        case 'strong_open':
          out.push({ type: 'strong', children: walk('strong_close') });
          break;
        case 'em_open':
          out.push({ type: 'em', children: walk('em_close') });
          break;
        case 'link_open':
          out.push({ type: 'link', href: String(t.attrGet('href') ?? ''), children: walk('link_close') });
          break;
        case 'math_inline':
          out.push({ type: 'math', tex: t.content, display: Boolean((t.meta as { display?: boolean } | null)?.display) });
          break;
        case 'image':
          pushText(out, t.content); // alt text
          break;
        default:
          if (t.nesting === 0 && t.content) pushText(out, t.content);
      }
    }
    return out;
  };
  return walk(null);
}

export function plainText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
        case 'code':
          return n.text;
        case 'br':
          return ' ';
        case 'math':
          return n.tex;
        default:
          return plainText(n.children);
      }
    })
    .join('');
}

export type ParseOptions = { math?: boolean };

export function parseMarkdown(source: string, options: ParseOptions = {}): ParsedMarkdown {
  const tokens = (options.math ? mdMath : md).parse(source, {});
  const headings: HeadingBlock[] = [];
  const used = new Map<string, number>();
  const uniqueId = (base: string): string => {
    const b = base || 'section';
    const n = used.get(b) ?? 0;
    used.set(b, n + 1);
    return n === 0 ? b : `${b}-${n}`;
  };

  let pos = 0;
  const parseUntil = (closeType: string | null): Block[] => {
    const out: Block[] = [];
    while (pos < tokens.length) {
      const t = tokens[pos]!;
      if (closeType && t.type === closeType) {
        pos++;
        return out;
      }
      pos++;
      switch (t.type) {
        case 'heading_open': {
          const inline = tokens[pos]?.type === 'inline' ? tokens[pos++] : undefined;
          if (tokens[pos]?.type === 'heading_close') pos++;
          const children = inlineOf(inline);
          const text = plainText(children).trim();
          const heading: HeadingBlock = { type: 'heading', level: Number(t.tag.slice(1)) || 1, id: uniqueId(slugify(text)), text, children };
          headings.push(heading);
          out.push(heading);
          break;
        }
        case 'paragraph_open': {
          const inline = tokens[pos]?.type === 'inline' ? tokens[pos++] : undefined;
          if (tokens[pos]?.type === 'paragraph_close') pos++;
          out.push({ type: 'paragraph', children: inlineOf(inline) });
          break;
        }
        case 'bullet_list_open':
        case 'ordered_list_open': {
          const ordered = t.type === 'ordered_list_open';
          const close = ordered ? 'ordered_list_close' : 'bullet_list_close';
          const items: Block[][] = [];
          while (pos < tokens.length && tokens[pos]!.type !== close) {
            if (tokens[pos]!.type === 'list_item_open') {
              pos++;
              items.push(parseUntil('list_item_close'));
            } else {
              pos++;
            }
          }
          pos++; // list close
          out.push({ type: 'list', ordered, start: ordered ? Number(t.attrGet('start') ?? 1) || 1 : 1, items });
          break;
        }
        case 'blockquote_open':
          out.push({ type: 'blockquote', children: parseUntil('blockquote_close') });
          break;
        case 'math_block':
          out.push({ type: 'math', tex: t.content });
          break;
        case 'hr':
          out.push({ type: 'hr' });
          break;
        case 'fence':
        case 'code_block':
          out.push({ type: 'code', text: t.content.replace(/\n$/, '') });
          break;
        default:
          break; // html_block and anything unknown is dropped
      }
    }
    return out;
  };

  const blocks = parseUntil(null);
  const minLevel = headings.reduce((m, h) => Math.min(m, h.level), Infinity);
  const toc: TocEntry[] = headings
    .filter((h) => h.level <= minLevel + 1)
    .map((h) => ({ id: h.id, text: h.text, level: h.level, depth: h.level - minLevel }));
  return { blocks, toc };
}
