import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { unzipSync } from 'fflate';
import { parseTheme, applyTheme, exportTheme } from '../apps/web/src/theme-kit/contract.mjs';
import { templates } from '../apps/web/src/theme-kit/templates.mjs';

test('downloaded kit runs init, validation and build without dependencies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pirat-theme-test-'));
  const zip = unzipSync(await readFile(new URL('../apps/web/public/downloads/pirat-theme-kit-v1.zip', import.meta.url)));
  for (const [name, bytes] of Object.entries(zip)) {
    const path = join(root, name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
  }
  assert.equal(Buffer.compare(zip['contract.mjs'], await readFile(new URL('../apps/web/src/theme-kit/contract.mjs', import.meta.url))), 0, 'Regenerate kit when contract changes');
  for (const [entry, source] of [['pirat.mjs', 'pirat.mjs'], ['THEME-RULES.md', 'THEME-RULES.md']]) {
    assert.equal(Buffer.compare(zip[entry], await readFile(new URL(`./theme-kit/${source}`, import.meta.url))), 0, 'Regenerate kit when CLI or rules change');
  }
  const run = (...args) => spawnSync(process.execPath, [join(root, 'pirat.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  for (const id of Object.keys(templates)) {
    assert.equal(run('init', id, id).status, 0);
    assert.equal(run('validate', id).status, 0);
    assert.equal(run('build', id).status, 0);
    assert.deepEqual(parseTheme(await readFile(join(root, id, 'dist/theme.pirat.json'), 'utf8')), templates[id]);
    assert.equal(run('init', id, id).status, 1);
  }
  await writeFile(join(root, 'minimal/theme.json'), '{"schemaVersion":1,"name":"bad","config":{"template":"retail","price":0}}');
  assert.equal(run('validate', 'minimal').status, 1);
  assert.equal(run('build', 'minimal').status, 1);
});

test('invalid themes and prototype keys are rejected; applying retains merchant data', () => {
  for (const input of ['no json', '{}', '{"schemaVersion":2,"name":"x","config":{"template":"retail"}}', '{"schemaVersion":1,"name":"x","config":{"template":"retail","__proto__":{}}}', JSON.stringify({ ...templates.retail, config: { template: 'retail', contentWidth: 99999 } }), ' '.repeat(32769)]) {
    assert.throws(() => parseTheme(input));
  }
  const original = { ...templates.minimal.config, logoUrl: 'https://example.com/logo.webp', customElements: [{ id: 'one', type: 'testimonial', text: 'Real' }], title: 'Minha loja', price: 100, successUrl: 'https://example.com/success' };
  const changed = applyTheme(original, templates.retail);
  assert.equal(changed.template, 'retail');
  for (const key of ['logoUrl', 'customElements', 'title', 'price', 'successUrl']) assert.deepEqual(changed[key], original[key]);
  const exported = exportTheme(original);
  assert.equal(exported.config.logoUrl, undefined);
  assert.equal(exported.config.customElements, undefined);
  assert.equal(exported.config.price, undefined);
});
