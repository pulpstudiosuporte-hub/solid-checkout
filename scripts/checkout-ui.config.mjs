import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: fileURLToPath(new URL('../apps/web/ui-tests', import.meta.url)),
  testMatch: 'pix.spec.mjs',
  outputDir: fileURLToPath(new URL('../.visual-check/checkout-test-results', import.meta.url)),
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: { channel: 'chrome', baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', screenshot: 'only-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js apps/web --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173/ui-tests/pix-review.html', reuseExistingServer: !process.env.CI, cwd: fileURLToPath(new URL('../', import.meta.url)) },
});
