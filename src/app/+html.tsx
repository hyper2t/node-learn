import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Web-only root HTML for every statically rendered page. Runs in Node.js at
 * build time: no DOM, no browser APIs, and no global CSS imports (those belong
 * in the root layout).
 *
 * The inline favicon mirrors the portal site mark (site/src/components/Logo.astro)
 * so the browser tab matches node-learn.com. The <title> here is only a fallback
 * for the pre-hydration paint; per-screen titles come from Stack.Screen options
 * and expo-router/head.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>Node Learn</title>
        <meta name="description" content="Node Learn is a learning relationship platform - learn with someone who notices how you think." />

        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <meta name="theme-color" content="#0B0F14" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
