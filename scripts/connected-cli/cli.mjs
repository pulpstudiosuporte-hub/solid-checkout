#!/usr/bin/env node
import { readFile, writeFile, mkdir, mkdtemp, rm, copyFile, cp, realpath } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';

const run = promisify(execFile);
const root = dirname(fileURLToPath(import.meta.url));
const defaults = JSON.parse(await readFile(join(root, 'defaults.json'), 'utf8'));
const credentialsPath = join(process.env.PIRAT_CONFIG_HOME || join(homedir(), '.pirat'), 'credentials.json');
const sha = value => createHash('sha256').update(value).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const value = args[i + 1]; if (!value || value.startsWith('--')) throw new Error(`Falta o valor de ${name}.`); args.splice(i, 2); return value; };
const apiInput = flag('--api', 'https://api.apirat.io');
const portInput = flag('--port', '4317');
const templateInput = flag('--template', 'current');
const yesIndex = args.indexOf('--yes'); const yes = yesIndex >= 0; if (yes) args.splice(yesIndex, 1);
const [command, subcommand, ...rest] = args;
const canonicalApi = value => {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !(url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Use uma origem HTTPS; HTTP é permitido apenas no localhost.');
  return url.origin;
};
async function request(api, path, method = 'GET', body, accessToken) {
  const response = await fetch(`${canonicalApi(api)}/cli${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${result?.error?.code || response.status}: ${result?.error?.message || 'Falha na API.'}${result?.fields ? ` Campos: ${result.fields.join(', ')}` : ''}`);
  return result;
}
async function credentials() {
  let data;
  try { data = JSON.parse(await readFile(credentialsPath, 'utf8')); } catch { throw new Error('Execute pirat login para conectar sua loja.'); }
  canonicalApi(data.api);
  if (new Date(data.expiresAt) <= new Date()) throw new Error('A conexão expirou. Execute login novamente.');
  return data;
}
const remote = (auth, path, method, body) => request(auth.api, path, method, body, auth.accessToken);
async function writeJson(path, value) { await writeFile(path, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 }); }
async function compile(directory) {
  const temp = await mkdtemp(join(tmpdir(), 'pirat-build-'));
  try {
    // Each build is a fresh process so imported modules are reloaded too.
    await run(process.execPath, [join(root, 'evaluate.mjs'), join(directory, 'src/theme.mjs'), join(temp, 'config.json')], { timeout: 10_000, maxBuffer: 256_000, cwd: directory, windowsHide: true, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, NODE_ENV: 'development' } });
    return { ...defaults, ...JSON.parse(await readFile(join(temp, 'config.json'), 'utf8')) };
  } catch (error) { throw new Error(`Falha ao compilar o tema: ${error.stderr || error.message}`); }
  finally { await rm(temp, { recursive: true, force: true }); }
}
async function project(directory, auth) {
  const metadata = JSON.parse(await readFile(join(directory, '.pirat/project.json'), 'utf8'));
  if (metadata.api !== auth.api || metadata.store !== auth.store.publicId) throw new Error('Este projeto pertence a outra API ou loja. Faça login na conta correta.');
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(metadata.checkout)) throw new Error('Identificador do checkout inválido.');
  return metadata;
}
async function pull(auth, id, folder) {
  if (!id || !folder || !/^[A-Za-z0-9_-]{1,32}$/.test(id)) throw new Error('Use checkout pull <id> <pasta-nova>.');
  const templates = JSON.parse(await readFile(join(root, 'templates.json'), 'utf8'));
  if (templateInput !== 'current' && !Object.hasOwn(templates, templateInput)) throw new Error('Modelo inválido. Use current, minimal, retail ou marketplace.');
  const result = await remote(auth, `/checkouts/${encodeURIComponent(id)}`);
  const directory = resolve(folder);
  await mkdir(directory); // Never overwrite an existing project, including local changes.
  await mkdir(join(directory, 'src')); await mkdir(join(directory, '.pirat'));
  await writeJson(join(directory, '.pirat/project.json'), { api: auth.api, store: auth.store.publicId, checkout: id, revision: result.checkout.revision });
  const config = { ...defaults, ...result.checkout.config, ...(templateInput === 'current' ? {} : templates[templateInput].config) };
  const elements = config.customElements || []; delete config.customElements;
  await writeFile(join(directory, 'src/theme.mjs'), `import elements from './elements.mjs';\n\n// Altere a identidade, textos, etapas e disposição dos componentes.\nexport default {\n  ...${JSON.stringify(config, null, 2)},\n  customElements: elements,\n};\n`);
  await writeFile(join(directory, 'src/elements.mjs'), `// Blocos reais do checkout: banners, depoimentos, listas, FAQ e outros.\nexport default ${JSON.stringify(elements, null, 2)};\n`);
  await copyFile(join(root, 'PROJECT.md'), join(directory, 'AGENTS.md'));
  await copyFile(join(root, 'README.md'), join(directory, 'README.md'));
  await writeJson(join(directory, 'package.json'), { name: 'meu-checkout-pirat', private: true, type: 'module', scripts: { dev: 'node .pirat/tool/cli.mjs dev', build: 'node .pirat/tool/cli.mjs build', validate: 'node .pirat/tool/cli.mjs validate', push: 'node .pirat/tool/cli.mjs checkout push', publish: 'node .pirat/tool/cli.mjs checkout publish --yes' } });
  await mkdir(join(directory, '.pirat/tool'));
  for (const file of ['cli.mjs', 'evaluate.mjs', 'defaults.json', 'templates.json', 'README.md', 'PROJECT.md']) await copyFile(join(root, file), join(directory, '.pirat/tool', file));
  await cp(join(root, 'preview'), join(directory, '.pirat/tool/preview'), { recursive: true });
  await writeFile(join(directory, '.gitignore'), 'node_modules/\ndist/\n.pirat/project.json\n.env*\n');
  console.log(`Projeto criado em ${directory}\nAbra a pasta na sua IDE e execute npm run dev. Credenciais não são copiadas para o projeto.`);
}
async function serve(directory) {
  const port = Number(portInput);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Porta inválida.');
  let config = await compile(directory); let last = JSON.stringify(config); let message = ''; let compiling = false;
  const refresh = setInterval(async () => {
    if (compiling) return; compiling = true;
    try { const candidate = await compile(directory); last = JSON.stringify(candidate); config = candidate; message = ''; } catch (error) { message = error.message; } finally { compiling = false; }
  }, 1500);
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}` || req.method !== 'GET' || req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) { res.writeHead(403).end(); return; }
    const path = req.url?.split('?')[0];
    if (path === '/config.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ config, revision: sha(last), error: message })); return; }
    const file = path === '/' ? 'index.html' : path?.replace(/^\//, '');
    if (!file || !/^(index\.html|assets\/[A-Za-z0-9_.-]+)$/.test(file)) { res.writeHead(404).end(); return; }
    try {
      const resolved = await realpath(join(root, 'preview', file));
      if (!resolved.startsWith((await realpath(join(root, 'preview'))) + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('Invalid path');
      const content = await readFile(resolved); res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(content);
    } catch { res.writeHead(404).end(); }
  });
  server.on('error', error => { clearInterval(refresh); console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Prévia local: http://127.0.0.1:${port}\nAtualização automática ao salvar. Não cria pedidos nem processa pagamentos.`));
  const stop = () => { clearInterval(refresh); server.close(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}

try {
  if (command === 'login') {
    const api = canonicalApi(apiInput); const verifier = randomBytes(32).toString('base64url');
    const device = await request(api, '/device', 'POST', { challenge: sha(verifier), label: 'Pirat CLI' });
    const verification = new URL(device.verificationUrl);
    if (!(verification.protocol === 'https:' || verification.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(verification.hostname))) throw new Error('URL de autorização inválida.');
    console.log(`Abra ${verification.href}\nConfira o código ${device.userCode} e escolha as permissões no painel.`);
    const deadline = Date.now() + Math.min(device.expiresIn, 600) * 1000;
    let granted = false;
    while (Date.now() < deadline) {
      await delay(5000);
      const result = await request(api, '/device/token', 'POST', { deviceToken: device.deviceToken, verifier });
      if (result.pending) continue;
      if (typeof result.accessToken !== 'string' || !/^pirat_[A-Za-z0-9_-]{43}$/.test(result.accessToken)) throw new Error('Resposta de autenticação inválida.');
      await mkdir(dirname(credentialsPath), { recursive: true, mode: 0o700 });
      await writeJson(credentialsPath, { ...result, api });
      console.log(`Conectado à loja ${result.store.name}. ${result.canPublish ? 'Publicação permitida.' : 'Acesso somente a rascunhos.'}`); granted = true; break;
    }
    if (!granted) throw new Error('A autorização expirou. Execute login novamente.');
  } else if (command === 'logout') {
    const auth = await credentials(); await remote(auth, '/logout', 'POST'); await rm(credentialsPath); console.log('Acesso revogado e credencial local removida.');
  } else if (command === 'whoami') {
    const auth = await credentials(); console.log(JSON.stringify(await remote(auth, '/me'), null, 2));
  } else if (command === 'dev') await serve(resolve(subcommand || '.'));
  else if (command === 'build' || command === 'validate') {
    const directory = resolve(subcommand || '.'); let config = await compile(directory);
    if (command === 'validate') { const auth = await credentials(); await project(directory, auth); config = (await remote(auth, '/validate', 'POST', { config })).config; }
    await mkdir(join(directory, 'dist'), { recursive: true }); await writeJson(join(directory, 'dist/checkout.json'), config);
    console.log(command === 'validate' ? 'Configuração validada pela API. Nenhuma alteração salva na loja.' : 'Build local gerado em dist/checkout.json. Execute validate antes de enviar.');
  } else if (command === 'checkout') {
    const auth = await credentials();
    if (subcommand === 'list') console.log(JSON.stringify(await remote(auth, '/checkouts'), null, 2));
    else if (subcommand === 'pull') await pull(auth, rest[0], rest[1]);
    else if (['push', 'publish', 'versions', 'restore'].includes(subcommand)) {
      const directory = resolve(rest[0] || '.'); const metadata = await project(directory, auth); const endpoint = `/checkouts/${encodeURIComponent(metadata.checkout)}`;
      if (subcommand === 'versions') console.log(JSON.stringify(await remote(auth, `${endpoint}/versions`), null, 2));
      else {
        if (subcommand === 'publish' && !yes) throw new Error('Publicação altera o checkout público. Revise o rascunho e execute publish --yes para confirmar.');
        if (subcommand === 'restore' && !rest[1]) throw new Error('Use checkout restore <pasta> <versão>. A restauração altera somente o rascunho.');
        const body = { revision: metadata.revision, ...(subcommand === 'push' ? { config: await compile(directory) } : {}), ...(subcommand === 'restore' ? { version: rest[1] } : {}) };
        const result = await remote(auth, `${endpoint}/${subcommand}`, 'POST', body);
        if (subcommand === 'restore') {
          // Existing source stays intact; force a fresh pull before another mutation.
          await writeJson(join(directory, '.pirat/project.json'), { ...metadata, revision: null });
          console.log('Versão restaurada no rascunho. Use pull em uma pasta nova para continuar; seus arquivos locais foram preservados.');
        } else {
          await writeJson(join(directory, '.pirat/project.json'), { ...metadata, revision: result.checkout.revision });
          console.log(subcommand === 'push' ? 'Rascunho atualizado. O checkout publicado não mudou.' : 'Checkout publicado.');
        }
      }
    } else throw new Error('Comando de checkout desconhecido. Use --help.');
  } else if (!command || command === '--help') console.log('Pirat CLI\nlogin [--api https://api.apirat.io]\nlogout | whoami\ncheckout list\ncheckout pull <id> <pasta-nova>\ndev [pasta] [--port 4317]\nbuild [pasta] | validate [pasta]\ncheckout push [pasta]\ncheckout publish [pasta] --yes\ncheckout versions [pasta]\ncheckout restore <pasta> <versão>');
  else throw new Error('Comando desconhecido. Use --help.');
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'A pasta já existe. Escolha uma pasta nova para preservar os arquivos.' : error.message);
  process.exitCode = 1;
}
