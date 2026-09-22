import MarkdownIt from 'markdown-it';

/**
 * Markdown → a small block/inline tree that the app renders with its own Text/View primitives
 * (no HTML, no WebView). Parsing is done by markdown-it (CommonMark, raw HTML disabled); this
 * module only reshapes its flat token stream and derives heading ids + a table of contents.
 *
 * Supported: headings, paragraphs, bullet/ordered (nested) lists, blockquotes, fenced code,
 * horizontal rules, **bold**, _italic_, `code`, [links](…). Anything else degrades to plain text.
 */
export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'br' };

export type HeadingBlock = { type: 'heading'; level: number; id: string; text: string; children: Inline[] };
export type Block =
  | HeadingBlock
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'code'; text: string }
  | { type: 'hr' };

/** `depth` is relative to the shallowest heading in the document (0 = top level, 1 = nested). */
export type TocEntry = { id: string; text: string; level: number; depth: number };
export type ParsedMarkdown = { blocks: Block[]; toc: TocEntry[] };

const md = new MarkdownIt('commonmark', { html: false, linkify: false, typographer: false });
type Token = ReturnType<typeof md.parse>[number];

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
        default:
          return plainText(n.children);
      }
    })
    .join('');
}

export function parseMarkdown(source: string): ParsedMarkdown {
  const tokens = md.parse(source, {});
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
