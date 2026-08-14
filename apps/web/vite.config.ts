import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const csp = [
  "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
  "img-src 'self' data: blob:", "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Vite React Refresh injects a small inline preamble in development.
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' http://127.0.0.1:3333 ws://127.0.0.1:5173 ws://localhost:5173"
].join('; ');

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, headers: { 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { sourcemap: false, target: 'es2022' }
});
