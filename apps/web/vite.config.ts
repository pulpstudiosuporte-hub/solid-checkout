import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const csp = [
  "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:", "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Vite React Refresh injects a small inline preamble in development.
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.googleadservices.com https://www.google.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net",
  "frame-src https://challenges.cloudflare.com https://www.googletagmanager.com",
  "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://ad.doubleclick.net https://www.google.com https://google.com https://www.google.com.br https://stats.g.doubleclick.net http://127.0.0.1:3333 ws://127.0.0.1:5173 ws://localhost:5173"
].join('; ');

export default defineConfig({
  plugins: [react()],
  define: {
    __SOLID_BUILD_VERSION__: JSON.stringify(Date.now().toString(36)),
  },
  server: { host: '127.0.0.1', port: 5173, headers: { 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        site: fileURLToPath(new URL('./site.html', import.meta.url)),
      },
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          if (id.includes('node_modules/qrcode.react')) return 'vendor-qrcode';
          return undefined;
        }
      }
    }
  }
});
