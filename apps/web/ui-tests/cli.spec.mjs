import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { mockAdmin } from './fixtures.mjs';

test('CLI aparece em Checkouts com modelos e comando NPX do checkout selecionado', async ({ page }) => {
  await mockAdmin(page);
  await page.route('**/cli/connections', route => route.fulfill({ json: { items: [] } }));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Checkout', exact: true }).click();
  await page.getByRole('button', { name: 'Checkouts', exact: true }).click();
  const entry = page.getByRole('region', { name: 'Seu checkout. Na sua IDE.' });
  await expect(entry).toBeVisible();
  await entry.getByRole('radio', { name: /Varejo/ }).check();
  await expect(entry.locator('code').filter({ hasText: 'checkout pull' })).toContainText('qa-checkout minha-loja --template retail');
  await entry.screenshot({ path: '.visual-check/cli-entry-desktop.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await entry.screenshot({ path: '.visual-check/cli-entry-mobile.png', animations: 'disabled' });
  await entry.getByRole('button', { name: 'Configurar CLI' }).click();
  await expect(page.getByRole('heading', { name: 'Sua IDE conectada à Pirat' })).toBeVisible();
});

test('autoriza a loja exibida, mantém publicação opcional e permite revogar', async ({ page }) => {
  await mockAdmin(page);
  let items = []; const approvals = [];
  await page.route('**/cli/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/cli/connections') return route.fulfill({ json: { items } });
    if (path === '/cli/device/approve') {
      const body = route.request().postDataJSON();
      if (body.inspect) return route.fulfill({ json: { label: 'Minha IDE', store: { name: 'Aurora Store', publicId: 'qa-store' } } });
      approvals.push(body); items = [{ id: 'connection-a', label: 'Minha IDE', canPublish: body.canPublish, expiresAt: '2026-10-19T00:00:00Z' }];
      return route.fulfill({ json: { approved: true } });
    }
    if (route.request().method() === 'DELETE') { items = []; return route.fulfill({ status: 204 }); }
    return route.fulfill({ status: 404 });
  });
  await page.goto('/#/cli');
  await expect(page.getByRole('heading', { name: 'Sua IDE conectada à Pirat' })).toBeVisible();
  await page.getByLabel('Código mostrado no seu terminal').fill('ABC1234567');
  await page.getByRole('button', { name: 'Conferir conexão' }).click();
  await expect(page.getByRole('heading', { name: 'Conectar Minha IDE' })).toBeVisible();
  await expect(page.getByLabel('Permitir também publicar checkouts')).not.toBeChecked();
  await expect.poll(() => page.locator('.main-shell').evaluate(el => Math.round(el.getBoundingClientRect().left))).toBe(264);
  await page.screenshot({ path: '.visual-check/desktop.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.visual-check/mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Autorizar nesta loja' }).click();
  expect(approvals).toEqual([{ userCode: 'ABC1234567', canPublish: false, storePublicId: 'qa-store' }]);
  await page.getByRole('button', { name: 'Atualizar lista' }).click();
  await expect(page.getByText(/Somente rascunhos/)).toBeVisible();
  await page.getByRole('button', { name: 'Revogar acesso' }).click();
  await expect(page.getByText('Nenhuma conexão ativa.')).toBeVisible();
});

test('guia novo e kit são públicos e distinguem o escopo implementado', async ({ page }) => {
  await page.goto('/#/docs/cli-conectada');
  await expect(page.getByRole('heading', { name: 'CLI conectada: trabalhe na sua IDE', exact: true })).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'node cli.mjs login' })).toBeVisible();
  expect((await (await page.request.get('/downloads/pirat-cli.zip')).body()).subarray(0, 2).toString()).toBe('PK');
});

test('prévia do ZIP acompanha módulos salvos e preserva visual quando há erro', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4318/');
  await expect(page.getByRole('heading', { name: 'Você está a um passo.' })).toBeVisible();
  await page.screenshot({ path: '.visual-check/cli-preview-desktop.png', fullPage: true });
  const file = '.visual-check/cli-ui-project/src/theme.mjs';
  const original = await readFile(file, 'utf8');
  try {
    await writeFile(file, original.replace('Você está a um passo.', 'Sua marca na IDE'));
    await expect(page.getByRole('heading', { name: 'Sua marca na IDE' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Celular', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '.visual-check/cli-preview-mobile.png', fullPage: true });
    await writeFile(file, 'export default { sintaxe quebrada');
    await expect(page.getByRole('alert')).toContainText('Falha ao compilar', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Sua marca na IDE' })).toBeVisible();
    expect(errors).toEqual([]);
    expect((await page.request.get('http://127.0.0.1:4318/config.json', { headers: { Host: 'untrusted.example' } })).status()).toBe(403);
    expect((await page.request.get('http://127.0.0.1:4318/.pirat/project.json')).status()).toBe(404);
  } finally { await writeFile(file, original); }
});
