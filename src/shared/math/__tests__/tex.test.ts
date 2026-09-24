import { describe, expect, it } from 'vitest';
import { renderTex } from '../tex';

describe('renderTex', () => {
  it('renders TeX to a sized SVG', () => {
    const r = renderTex('\\frac{a}{b} + \\sqrt{x^2}', false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.svg.startsWith('<svg')).toBe(true);
    expect(r.widthEx).toBeGreaterThan(0);
    expect(r.heightEx).toBeGreaterThan(0);
    expect(r.verticalAlignEx).toBeLessThan(0);
    expect(r.svg).not.toMatch(/href=|<use/);
  });

  it('supports ams environments in display mode', () => {
    expect(renderTex('\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}', true).ok).toBe(true);
  });

  it('reports errors instead of throwing', () => {
    expect(renderTex('\\frac{a}{', false).ok).toBe(false);
    expect(renderTex('', false).ok).toBe(false);
    expect(renderTex('x'.repeat(3000), false).ok).toBe(false);
  });

  it('does not allow links or macro definitions', () => {
    const r = renderTex('\\href{javascript:alert(1)}{x}', false);
    if (r.ok) expect(r.svg).not.toContain('javascript');
  });
});
