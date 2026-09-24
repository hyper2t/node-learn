import './mathjax-env';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/base/BaseConfiguration.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import 'mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import 'mathjax-full/js/input/tex/cancel/CancelConfiguration.js';
import 'mathjax-full/js/input/tex/color/ColorConfiguration.js';
import 'mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js';

/**
 * TeX → self-contained SVG (MathJax 3, lite DOM adaptor: no browser, no WebView), so the same
 * output renders through react-native-svg on iOS/Android and inline on web.
 * Deliberately small package set: no \require/autoload (no network), no \href/\style/\class,
 * no \newcommand (macro bombs). Unknown macros render in red instead of failing.
 */
export type TexRender =
  | { ok: true; svg: string; widthEx: number; heightEx: number; verticalAlignEx: number }
  | { ok: false; error: string };

/** Max source length rendered; longer input is shown as raw text. */
export const MAX_TEX_LENGTH = 2000;

type Doc = ReturnType<typeof mathjax.document>;
let adaptor: ReturnType<typeof liteAdaptor> | null = null;
let doc: Doc | null = null;

function engine(): { adaptor: ReturnType<typeof liteAdaptor>; doc: Doc } {
  if (!adaptor || !doc) {
    adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    doc = mathjax.document('', {
      InputJax: new TeX({
        packages: ['base', 'ams', 'boldsymbol', 'cancel', 'color', 'noundefined'],
        formatError: (_jax: unknown, err: Error) => { throw err; },
      }),
      // fontCache 'none' → every glyph is an inline <path>, no shared <defs>/<use href>.
      OutputJax: new SVG({ fontCache: 'none' }),
    });
  }
  return { adaptor, doc };
}

/** Defence in depth: generated SVG should never carry links or handlers, strip them anyway. */
function sanitize(svg: string): string {
  return svg
    .replace(/\s(?:xlink:)?href="[^"]*"/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\sdata-mml-node="[^"]*"/g, ''); // pure bloat for our use
}

const num = (re: RegExp, s: string) => {
  const m = re.exec(s);
  return m ? Number(m[1]) : 0;
};

const cache = new Map<string, TexRender>();
const CACHE_MAX = 300;

export function renderTex(tex: string, display: boolean): TexRender {
  const source = tex.trim();
  const key = `${display ? 'D' : 'I'}:${source}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let out: TexRender;
  if (!source) out = { ok: false, error: 'Empty formula' };
  else if (source.length > MAX_TEX_LENGTH) out = { ok: false, error: 'Formula is too long' };
  else {
    try {
      const { adaptor: a, doc: d } = engine();
      const node = d.convert(source, { display, em: 16, ex: 8, containerWidth: 1280 });
      const svg = sanitize(a.innerHTML(node));
      out = {
        ok: true,
        svg,
        widthEx: num(/width="([\d.]+)ex"/, svg),
        heightEx: num(/height="([\d.]+)ex"/, svg),
        verticalAlignEx: num(/vertical-align:\s*(-?[\d.]+)ex/, svg),
      };
    } catch (err) {
      out = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, out);
  return out;
}
