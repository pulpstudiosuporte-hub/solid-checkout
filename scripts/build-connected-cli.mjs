import { build as bundle } from 'esbuild';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { templates } from '../apps/web/src/theme-kit/templates.mjs';
import { pathToFileURL } from 'node:url';
import { zipSync } from 'fflate';

const out = resolve('.visual-check/connected-cli');
await mkdir(out, { recursive: true });
await bundle({ stdin: { contents: "import { defaultCheckoutConfig } from './apps/web/src/checkout-config.js'; export default defaultCheckoutConfig;", resolveDir: process.cwd(), sourcefile: 'defaults-entry.js' }, bundle: true, platform: 'node', format: 'esm', outfile: join(out, 'defaults.mjs'), packages: 'external', loader: { '.js': 'jsx' }, logLevel: 'error' });
const defaults = (await import(pathToFileURL(join(out, 'defaults.mjs')).href)).default;
await writeFile(join(out, 'defaults.json'), JSON.stringify(defaults, null, 2));
await writeFile(join(out, 'templates.json'), JSON.stringify(templates, null, 2));
for (const file of ['cli.mjs', 'evaluate.mjs', 'package.json', 'README.md', 'PROJECT.md']) await copyFile(resolve('scripts/connected-cli', file), join(out, file));
await build({ configFile: false, plugins: [react()], root: process.cwd(), base: './', define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.VITE_API_URL': JSON.stringify(''), __SOLID_BUILD_VERSION__: JSON.stringify('cli-preview') }, build: { outDir: join(out, 'preview'), emptyOutDir: true, lib: { entry: resolve('apps/web/src/CliThemePreview.jsx'), name: 'PiratThemePreview', formats: ['es'], fileName: () => 'assets/preview.js', cssFileName: 'preview' }, rollupOptions: { output: { assetFileNames: 'assets/[name][extname]' } } } });
await writeFile(join(out, 'preview/index.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pirat — tema local</title><link rel="stylesheet" href="/assets/preview.css"></head><body><div id="root"></div><script type="module" src="/assets/preview.js"></script></body></html>');
const files = {};
async function collect(directory, prefix = '') { for (const file of await readdir(directory, { withFileTypes: true })) { const key = `${prefix}${file.name}`; if (file.isDirectory()) await collect(join(directory, file.name), `${key}/`); else if (file.name !== 'defaults.mjs') files[key] = [await readFile(join(directory, file.name)), { mtime: new Date('2026-01-01T00:00:00Z') }]; } }
await collect(out);
await mkdir('apps/web/public/downloads', { recursive: true });
await writeFile('apps/web/public/downloads/pirat-cli.zip', zipSync(files));
console.log('CLI, prévia e projeto editável empacotados em pirat-cli.zip.');
const npmCli = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
execFileSync(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--pack-destination', resolve('apps/web/public/downloads')], { cwd: out, stdio: 'pipe', windowsHide: true });
console.log('Pacote pirat-cli-0.1.0.tgz pronto para NPX por URL.');
