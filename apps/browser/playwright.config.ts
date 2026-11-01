import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/chrome/browser/sedo/dark-patterns',
  testMatch: '**/proof/**/*.spec.ts',
  globalSetup: './playwright.global-setup.mjs',
  forbidOnly: true,
  reporter: 'list',
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
  },
});
