import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
const exec = promisify(execFile);
const defaults = JSON.parse(await readFile('apps/api/test/fixtures/cli-config.json', 'utf8'));

test('CLI distribuída: login, projeto, módulos, validação, conflito, publicação e logout', { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pirat-cli-test-'));
  let revision = '2026-09-19T06:00:00.000Z'; let draft = structuredClone(defaults); let published = structuredClone(defaults); let loggedOut = false; let publishCalls = 0;
  const token = `pirat_${'a'.repeat(43)}`;
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk; const body = raw ? JSON.parse(raw) : {};
    res.setHeader('Content-Type', 'application/json');
    const send = (status, value) => { res.writeHead(status); res.end(JSON.stringify(value)); };
    if (req.url === '/cli/device') return send(200, { deviceToken: 'd'.repeat(43), userCode: 'ABC1234567', verificationUrl: 'http://127.0.0.1:5173/#/cli', expiresIn: 600 });
    if (req.url === '/cli/device/token') return send(200, { accessToken: token, expiresAt: new Date(Date.now() + 60_000), store: { publicId: 'store-a', name: 'Loja teste' }, canPublish: true });
    if (req.headers.authorization !== `Bearer ${token}` || loggedOut) return send(401, { error: { code: 'UNAUTHORIZED', message: 'Conexão inválida.' } });
    if (req.url === '/cli/me') return send(200, { store: { publicId: 'store-a', name: 'Loja teste' } });
    if (req.url === '/cli/logout') { loggedOut = true; return send(200, { revoked: true }); }
    if (req.url === '/cli/checkouts') return send(200, { items: [{ publicId: 'checkout-a', name: 'Tema' }] });
    if (req.url === '/cli/checkouts/checkout-a') return send(200, { checkout: { id: 'checkout-a', name: 'Tema', config: draft, revision }, store: { publicId: 'store-a' } });
    if (req.url === '/cli/validate') return send(200, { valid: true, config: body.config });
    if (req.url === '/cli/checkouts/checkout-a/versions') return send(200, { items: [{ id: 'version-a', action: 'before_publish' }] });
    if (body.revision !== revision) return send(409, { error: { code: 'CONFLICT', message: 'O checkout mudou.' } });
    if (req.url.endsWith('/push')) draft = body.config;
    if (req.url.endsWith('/publish')) { publishCalls++; published = draft; }
    if (req.url.endsWith('/restore')) draft = defaults;
    revision = new Date(Date.parse(revision) + 1000).toISOString();
    send(200, { checkout: { id: 'checkout-a', revision } });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const api = `http://127.0.0.1:${server.address().port}`;
  try {
    const kit = join(directory, 'kit'); await mkdir(kit);
    const files = unzipSync(await readFile('apps/web/public/downloads/pirat-cli.zip'));
    for (const [path, bytes] of Object.entries(files)) { assert(!path.includes('..')); const target = join(kit, path); await mkdir(resolve(target, '..'), { recursive: true }); await writeFile(target, bytes); }
    assert(files['preview/assets/preview.css']); assert(files['preview/assets/preview.js']);
    const authHome = join(directory, 'auth');
    const run = (args, cwd = directory) => exec(process.execPath, [join(kit, 'cli.mjs'), ...args], { cwd, env: { ...process.env, PIRAT_CONFIG_HOME: authHome }, timeout: 20_000, windowsHide: true });
    const login = await run(['login', '--api', api]); assert.match(login.stdout, /Conectado à loja/); assert(!login.stdout.includes(token));
    assert.match((await run(['whoami'])).stdout, /Loja teste/);
    assert.match((await run(['checkout', 'list'])).stdout, /checkout-a/);
    await run(['checkout', 'pull', 'checkout-a', 'varejo', '--template', 'retail']);
    await run(['build'], join(directory, 'varejo'));
    assert.equal(JSON.parse(await readFile(join(directory, 'varejo/dist/checkout.json'), 'utf8')).template, 'retail');
    assert.equal(draft.template, defaults.template);
    await assert.rejects(run(['checkout', 'pull', 'checkout-a', 'invalido', '--template', 'inventado']), /Modelo inválido/);
    await run(['checkout', 'pull', 'checkout-a', 'projeto']);
    await assert.rejects(run(['checkout', 'pull', 'checkout-a', 'projeto']), /pasta já existe/);
    const project = join(directory, 'projeto');
    const source = await readFile(join(project, 'src/theme.mjs'), 'utf8');
    assert(!source.includes(token));
    await writeFile(join(project, 'src/theme.mjs'), source.replace('customElements: elements,', 'title: "Marca alterada", customElements: elements,'));
    await run(['build'], project); const compiled = JSON.parse(await readFile(join(project, 'dist/checkout.json'), 'utf8')); assert.equal(compiled.title, 'Marca alterada');
    await run(['validate'], project); await run(['checkout', 'push'], project);
    assert.equal(draft.title, 'Marca alterada'); assert.equal(published.title, defaults.title);
    await assert.rejects(run(['checkout', 'publish'], project), /--yes/); assert.equal(publishCalls, 0);
    await run(['checkout', 'publish', '--yes'], project); assert.equal(published.title, 'Marca alterada');
    revision = new Date(Date.parse(revision) + 1000).toISOString();
    await assert.rejects(run(['checkout', 'push'], project), /CONFLICT/);
    const metadataPath = join(project, '.pirat/project.json'); const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    await writeFile(metadataPath, JSON.stringify({ ...metadata, store: 'other-store' }));
    await assert.rejects(run(['checkout', 'push'], project), /outra API ou loja/);
    await writeFile(metadataPath, JSON.stringify({ ...metadata, revision }));
    await run(['checkout', 'restore', '.', 'version-a'], project);
    assert.equal(JSON.parse(await readFile(metadataPath, 'utf8')).revision, null);
    assert.equal(await readFile(join(project, 'src/theme.mjs'), 'utf8'), source.replace('customElements: elements,', 'title: "Marca alterada", customElements: elements,'));
    await run(['logout']); assert(loggedOut); await assert.rejects(readFile(join(authHome, 'credentials.json')));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
});
