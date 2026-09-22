import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/** Unit tests for pure frontend logic (no React Native runtime). */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/__tests__/**/*.test.ts'], environment: 'node' },
});
