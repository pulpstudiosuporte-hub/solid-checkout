import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mockAdmin } from './fixtures.mjs';
const file = path => fileURLToPath(new URL(path, import.meta.url));

test('theme import rejects invalid files, cancels, applies, undoes and saves as draft', async ({ page }) => {
  await mockAdmin(page);
  const saves = [];
  await page.route('**/checkouts/qa-checkout/draft', async route => {
    const { config } = route.request().postDataJSON(); saves.push(config);
    await route.fulfill({ json: { checkout: { publicId: 'qa-checkout', name: 'Checkout principal', draftConfig: config, status: 'PUBLISHED' } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir busca avançada' }).click();
  await page.getByRole('combobox', { name: 'Buscar páginas, recursos ou ações' }).fill('Checkouts');
  await page.getByRole('option').filter({ has: page.locator('b', { hasText: /^Checkouts$/ }) }).click();
  await page.getByRole('button', { name: 'Personalizar', exact: true }).first().click();
  await page.getByRole('navigation', { name: 'Seções de personalização' }).getByRole('button', { name: /^Modelos/ }).click();
  const input = page.getByLabel('Arquivo do tema');
  await input.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":2}') });
  await expect(page.getByRole('status').filter({ hasText: 'schemaVersion precisa ser 1' })).toBeVisible();
  const theme = file('../public/downloads/retail.pirat.json');
  await input.setInputFiles(theme);
  await page.getByRole('button', { name: 'Cancelar importação' }).click();
  await expect(page.getByRole('button', { name: 'Aplicar na prévia' })).toHaveCount(0);
  await input.setInputFiles(theme);
  await page.getByRole('button', { name: 'Aplicar na prévia' }).click();
  await expect(page.locator('.editor-device.template-retail')).toBeVisible();
  await page.getByRole('button', { name: /^Desfazer/ }).click();
  await expect(page.locator('.editor-device.template-retail')).toHaveCount(0);
  await input.setInputFiles(theme);
  await page.getByRole('button', { name: 'Aplicar na prévia' }).click();
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect.poll(() => saves.at(-1)?.template).toBe('retail');
  await expect(page.locator('.template-grid>button.selected')).toContainText('Varejo');
  expect(saves.at(-1).logoText).toBeTruthy();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar visual atual' }).click();
  expect((await download).suggestedFilename()).toBe('meu-tema.pirat.json');
  await page.screenshot({ path: file('../../../.visual-check/theme-editor-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('.solid-editor').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: file('../../../.visual-check/theme-editor-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await expect(page.getByRole('button', { name: 'Importar tema', exact: true })).toBeVisible();
  await page.screenshot({ path: file('../../../.visual-check/theme-editor-mobile-dark.png'), fullPage: true });
});

test('developer docs show code and downloadable kit without login', async ({ page }) => {
  await page.goto('/#/docs/temas-cli');
  await expect(page.getByRole('heading', { name: 'Temas e CLI: do código ao checkout', exact: true })).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'node pirat.mjs init' })).toBeVisible();
  const response = await page.request.get('/downloads/pirat-theme-kit-v1.zip');
  expect(response.status()).toBe(200);
  expect((await response.body()).subarray(0, 2).toString()).toBe('PK');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: file(`../../../.visual-check/theme-docs-${width}.png`), fullPage: true });
  }
});
