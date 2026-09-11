import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: fileURLToPath(new URL('../apps/web/ui-tests', import.meta.url)),
  testIgnore: ['pix.spec.mjs', 'areas.spec.mjs', 'google.spec.mjs', 'analytics.spec.mjs', 'roadmap.spec.mjs'],
  outputDir: fileURLToPath(new URL('../.visual-check/admin-test-results', import.meta.url)),
  workers: 1,
  expect: { timeout: 15000 },
  timeout: 45000,
  reporter: 'list',
  use: {
    channel: process.env.VISUAL_BROWSER_CHANNEL || 'chrome',
    baseURL: 'http://127.0.0.1:4176',
    viewport: { width: 1440, height: 1050 },
    serviceWorkers: 'block',
    // Production CSP excludes localhost:3333; all API calls here are intercepted fixtures.
    bypassCSP: true,
    screenshot: 'only-on-failure',
  },
  webServer: process.env.VISUAL_SERVER_EXTERNAL === '1' ? undefined : {
    command: 'node node_modules/vite/bin/vite.js preview apps/web --host 127.0.0.1 --port 4176 --strictPort',
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: false,
  },
});
