import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: fileURLToPath(new URL('../apps/web/e2e', import.meta.url)),
  outputDir: fileURLToPath(new URL('../.visual-check/test-results', import.meta.url)),
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    channel: process.env.VISUAL_BROWSER_CHANNEL || 'chrome',
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview apps/web --host 127.0.0.1 --port 4174 --strictPort',
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    url: 'http://127.0.0.1:4174/site.html',
    reuseExistingServer: false,
  },
});
