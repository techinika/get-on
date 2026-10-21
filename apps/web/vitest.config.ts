import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'jsdom',
    // Playwright specs live next to the unit tests. Only *.test.ts files run
    // under Vitest, the *.spec.ts files are run by Playwright.
    include: ['tests/**/*.test.ts'],
  },
});
