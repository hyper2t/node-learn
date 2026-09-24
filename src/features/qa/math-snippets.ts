import type { QaTopicSlug } from '@/types/api';

/** Topics where the composer shows the LaTeX toolbar. */
export const STEM_TOPICS: ReadonlySet<QaTopicSlug> = new Set<QaTopicSlug>(['programming', 'math', 'physics', 'science', 'exam-prep']);
export const isStemTopic = (t: QaTopicSlug | null | undefined): boolean => !!t && STEM_TOPICS.has(t);

/**
 * `insert` uses `●` for where the cursor (or the current selection) goes; a second `●`, if any,
 * is simply removed. `wrap: true` snippets are TeX commands: outside math they are wrapped in $…$.
 * `block` snippets are multi-line and fall back to `inline` in single-line fields (the title).
 */
export type MathSnippet = { id: string; label: string; hint: string; insert: string; wrap?: boolean; block?: boolean; inline?: string };
export type SnippetGroup = { id: 'basic' | 'calculus' | 'greek' | 'relations' | 'structures'; snippets: MathSnippet[] };

const cmd = (id: string, label: string, hint: string, insert: string, extra: Partial<MathSnippet> = {}): MathSnippet =>
  ({ id, label, hint, insert, wrap: true, ...extra });

export const SNIPPET_GROUPS: SnippetGroup[] = [
  {
    id: 'basic',
    snippets: [
      { id: 'inline', label: '$…$', hint: 'Inline formula', insert: '$●$' },
      { id: 'display', label: '$$…$$', hint: 'Formula on its own line', insert: '\n$$\n●\n$$\n', block: true, inline: '$●$' },
      cmd('frac', 'a⁄b', 'Fraction', '\\frac{●}{}'),
      cmd('sqrt', '√x', 'Square root', '\\sqrt{●}'),
      cmd('nroot', 'ⁿ√x', 'n-th root', '\\sqrt[●]{}'),
      cmd('sup', 'xⁿ', 'Superscript', '^{●}'),
      cmd('sub', 'xᵢ', 'Subscript', '_{●}'),
      cmd('pm', '±', 'Plus-minus', '\\pm ●'),
      cmd('times', '×', 'Times', '\\times ●'),
      cmd('cdot', '·', 'Dot', '\\cdot ●'),
      cmd('div', '÷', 'Divide', '\\div ●'),
      cmd('paren', '( )', 'Auto-sized parentheses', '\\left( ● \\right)'),
    ],
  },
  {
    id: 'calculus',
    snippets: [
      cmd('sum', 'Σ', 'Sum', '\\sum_{i=1}^{n} ●'),
      cmd('prod', 'Π', 'Product', '\\prod_{i=1}^{n} ●'),
      cmd('int', '∫', 'Integral', '\\int_{a}^{b} ● \\,dx'),
      cmd('iint', '∬', 'Double integral', '\\iint_{D} ● \\,dA'),
      cmd('oint', '∮', 'Contour integral', '\\oint_{C} ●'),
      cmd('lim', 'lim', 'Limit', '\\lim_{x \\to ●}'),
      cmd('deriv', 'd⁄dx', 'Derivative', '\\frac{d●}{dx}'),
      cmd('partial', '∂', 'Partial derivative', '\\frac{\\partial ●}{\\partial x}'),
      cmd('infty', '∞', 'Infinity', '\\infty●'),
      cmd('nabla', '∇', 'Nabla', '\\nabla ●'),
      cmd('log', 'log', 'Logarithm', '\\log_{●}'),
      cmd('sin', 'sin', 'Sine', '\\sin ●'),
    ],
  },
  {
    id: 'greek',
    snippets: ([
      ['alpha', 'α'], ['beta', 'β'], ['gamma', 'γ'], ['delta', 'δ'], ['epsilon', 'ε'], ['theta', 'θ'], ['lambda', 'λ'],
      ['mu', 'μ'], ['pi', 'π'], ['rho', 'ρ'], ['sigma', 'σ'], ['phi', 'φ'], ['omega', 'ω'], ['Delta', 'Δ'], ['Sigma', 'Σ'], ['Omega', 'Ω'],
    ] as const).map(([name, label]) => cmd(name, label, `\\${name}`, `\\${name} ●`)),
  },
  {
    id: 'relations',
    snippets: [
      cmd('le', '≤', 'Less or equal', '\\le ●'),
      cmd('ge', '≥', 'Greater or equal', '\\ge ●'),
      cmd('ne', '≠', 'Not equal', '\\ne ●'),
      cmd('approx', '≈', 'Approximately', '\\approx ●'),
      cmd('equiv', '≡', 'Equivalent', '\\equiv ●'),
      cmd('to', '→', 'Arrow', '\\to ●'),
      cmd('implies', '⇒', 'Implies', '\\Rightarrow ●'),
      cmd('iff', '⇔', 'If and only if', '\\Leftrightarrow ●'),
      cmd('in', '∈', 'Element of', '\\in ●'),
      cmd('subset', '⊆', 'Subset', '\\subseteq ●'),
      cmd('forall', '∀', 'For all', '\\forall ●'),
      cmd('exists', '∃', 'Exists', '\\exists ●'),
    ],
  },
  {
    id: 'structures',
    snippets: [
      cmd('vec', 'v⃗', 'Vector', '\\vec{●}'),
      cmd('hat', 'x̂', 'Hat', '\\hat{●}'),
      cmd('bar', 'x̄', 'Bar / mean', '\\bar{●}'),
      cmd('abs', '|x|', 'Absolute value', '\\left| ● \\right|'),
      cmd('binom', '(n k)', 'Binomial', '\\binom{●}{}'),
      cmd('text', 'txt', 'Text inside a formula', '\\text{●}'),
      { id: 'matrix', label: '[ ]', hint: '2×2 matrix', insert: '\n$$\n\\begin{bmatrix} ● & b \\\\ c & d \\end{bmatrix}\n$$\n', block: true, inline: '$\\begin{bmatrix} ● & b \\\\ c & d \\end{bmatrix}$' },
      { id: 'cases', label: '{', hint: 'Piecewise function', insert: '\n$$\nf(x) = \\begin{cases} ● & x \\ge 0 \\\\ -x & x < 0 \\end{cases}\n$$\n', block: true, inline: '$f(x) = \\begin{cases} ● & x \\ge 0 \\\\ -x & x < 0 \\end{cases}$' },
      { id: 'aligned', label: '≡⃥', hint: 'Aligned equations', insert: '\n$$\n\\begin{aligned} ● &= b \\\\ &= c \\end{aligned}\n$$\n', block: true, inline: '$\\begin{aligned} ● &= b \\\\ &= c \\end{aligned}$' },
      { id: 'code', label: '</>', hint: 'Code block', insert: '\n```\n●\n```\n', block: true, inline: '`●`' },
    ],
  },
];

export type Selection = { start: number; end: number };
const MARK = '●';

/** Whether `pos` sits inside an open `$…$` / `$$…$$` span (unescaped dollars before it are odd). */
export function insideMath(text: string, pos: number): boolean {
  let open = false;
  for (let i = 0; i < pos; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '$') {
      if (text[i + 1] === '$') i++;
      open = !open;
    }
  }
  return open;
}

/** Inserts a snippet at the selection; selected text replaces the cursor mark (so it wraps the selection). */
export function applySnippet(value: string, sel: Selection, snippet: MathSnippet, opts: { singleLine?: boolean } = {}): { value: string; selection: Selection } {
  const start = Math.max(0, Math.min(sel.start, sel.end, value.length));
  const end = Math.min(value.length, Math.max(sel.start, sel.end));
  const selected = value.slice(start, end);
  let tpl = snippet.block && opts.singleLine ? snippet.inline ?? snippet.insert.replace(/\n/g, ' ') : snippet.insert;
  if (snippet.wrap && !insideMath(value, start)) tpl = `$${tpl.trimEnd()}$`;
  // Block snippets: avoid doubling the newlines already around the cursor.
  if (snippet.block && !opts.singleLine) {
    if (start === 0 || value[start - 1] === '\n') tpl = tpl.replace(/^\n/, '');
    if (value[end] === '\n' || end === value.length) tpl = tpl.replace(/\n$/, end === value.length ? '\n' : '');
  }
  const at = tpl.indexOf(MARK);
  const before = at === -1 ? tpl : tpl.slice(0, at);
  const after = (at === -1 ? '' : tpl.slice(at + 1)).replace(MARK, '');
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const cursorStart = start + before.length;
  return { value: next, selection: { start: cursorStart, end: cursorStart + selected.length } };
}
