/**
 * mathjax-full's components/version.js reads its own package.json via `eval('require')` unless a
 * global PACKAGE_VERSION exists. Inside Metro bundles (web static render, Hermes) that lookup
 * throws, so define it before any mathjax module is evaluated. Must be imported first in tex.ts.
 */
const g = globalThis as { PACKAGE_VERSION?: string };
g.PACKAGE_VERSION ??= '3.2.1';
export {};
