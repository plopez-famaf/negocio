import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/integration-setup.ts'],
    include: ['**/test/integration/**/*.test.{ts,tsx}'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  },
  resolve: {
    alias: {
      '@threatguard/core': resolve(__dirname, './packages/core/src'),
      '@threatguard/ui-components': resolve(__dirname, './packages/ui-components/src'),
      '@threatguard/test-utils': resolve(__dirname, './packages/test-utils/src')
    }
  }
});