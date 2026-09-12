import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './.visual-check/test-results',
  workers: 1,
  reporter: 'list',
  use: {
    channel: process.env.VISUAL_BROWSER_CHANNEL || 'chrome',
    baseURL: 'http://127.0.0.1:4175',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
  },
});
