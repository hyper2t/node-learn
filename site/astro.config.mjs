// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Static output -> dist/, which is what Appwrite Sites serves for framework "astro".
// See docs/runbooks/deploy-site.md for the console/CLI settings.
export default defineConfig({
  site: 'https://node-learn.example',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // Dev-only: allow the sandboxed preview host. Harmless for production builds.
    server: { allowedHosts: true },
  },
  build: { inlineStylesheets: 'auto' },
});

