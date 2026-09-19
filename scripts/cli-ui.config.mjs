import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
import base from './admin-ui.config.mjs';
export default defineConfig({ ...base, testMatch: 'cli.spec.mjs', outputDir: fileURLToPath(new URL('../.visual-check/cli-test-results', import.meta.url)), use: { ...base.use, baseURL: 'http://127.0.0.1:4210' }, webServer: [
  { cwd, command: 'node node_modules/vite/bin/vite.js preview apps/web --host 127.0.0.1 --port 4210 --strictPort', url: 'http://127.0.0.1:4210', reuseExistingServer: false },
  { cwd, command: 'node scripts/prepare-cli-preview.mjs', url: 'http://127.0.0.1:4318', reuseExistingServer: false },
] });
