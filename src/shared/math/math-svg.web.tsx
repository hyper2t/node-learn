import { memo, useMemo } from 'react';
import { renderTex } from './tex';
import type { MathSvgProps } from './math-svg';

/**
 * Web: inline the (sanitised, link-free) MathJax SVG. `ex` units scale with the surrounding
 * font and `currentColor` follows the text colour, so no measuring is needed.
 */
export const MathSvg = memo(function MathSvg({ tex, display = false, fontSize }: MathSvgProps) {
  const r = useMemo(() => renderTex(tex, display), [tex, display]);
  if (!r.ok) {
    return (
      <span title={r.error} style={{ fontFamily: 'monospace', color: 'var(--color-danger, #c0362c)' }}>
        {display ? `$$${tex}$$` : `$${tex}$`}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={tex}
      style={display
        ? { display: 'block', textAlign: 'center', overflowX: 'auto', overflowY: 'hidden', padding: '4px 0', fontSize }
        : { display: 'inline-block', fontSize }}
      dangerouslySetInnerHTML={{ __html: r.svg }}
    />
  );
});
