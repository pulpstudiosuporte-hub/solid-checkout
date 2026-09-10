import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const route = process.argv[2] ?? '/';
if (!route.startsWith('/') || route.startsWith('//') || route.includes('\\')) {
  throw new Error('Informe uma rota local, por exemplo / ou /c/loja/checkout.');
}
const candidates = [
  process.env.VISUAL_BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
];
const executable = candidates.find(candidate => candidate && existsSync(candidate));
if (!executable) throw new Error('Chrome/Edge não encontrado. Defina VISUAL_BROWSER_PATH com o caminho do executável.');
const output = path.join(root, '.visual-check');
await mkdir(output, { recursive: true });
const runDirectory = await mkdtemp(path.join(output, 'run-'));
const server = await preview({
  root: path.join(root, 'apps/web'),
  configFile: path.join(root, 'apps/web/vite.config.ts'),
  preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
});
const address = server.httpServer.address();
if (!address || typeof address === 'string') throw new Error('Preview local indisponível.');
const target = new URL(route, `http://127.0.0.1:${address.port}`).href;
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const screenshot = path.join(output, `${name}.png`);
    const profile = path.join(runDirectory, name);
    await new Promise((resolve, reject) => {
      const child = spawn(executable, [
        '--headless', '--no-first-run', '--no-default-browser-check',
        '--disable-background-networking', '--hide-scrollbars',
        '--force-device-scale-factor=1', `--window-size=${width},${height}`,
        '--timeout=15000', '--virtual-time-budget=10000',
        `--user-data-dir=${profile}`, `--screenshot=${screenshot}`, target,
      ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let diagnostic = '';
      child.stderr.on('data', data => { diagnostic = (diagnostic + String(data)).slice(-4000); });
      const timer = setTimeout(() => { child.kill(); reject(new Error(`Tempo esgotado ao capturar ${name}.`)); }, 45000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`Chrome falhou (${code}): ${diagnostic}`));
      });
    });
    const png = await readFile(screenshot);
    if (png.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error(`Captura inválida: ${name}.`);
    console.log(`${name}: ${screenshot} (${png.readUInt32BE(16)}x${png.readUInt32BE(20)})`);
  }
  await writeFile(path.join(output, 'last-run.json'), JSON.stringify({ capturedAt: new Date().toISOString(), browser: executable, screenshots: ['desktop.png', 'mobile.png'] }, null, 2));
  console.log('Capturas prontas para inspeção. Imagens geradas não significam aprovação visual ou teste de pagamento.');
} finally {
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
