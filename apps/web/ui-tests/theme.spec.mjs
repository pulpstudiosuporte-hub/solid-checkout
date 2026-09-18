import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mockAdmin } from './fixtures.mjs';

async function contrast(page, include) {
  let scan = new AxeBuilder({ page }).withRules(['color-contrast']);
  if (include) scan = scan.include(include);
  const result = await scan.analyze();
  expect(result.violations.flatMap(v => v.nodes.map(n => ({ target: n.target, issue: n.failureSummary })))).toEqual([]);
}
const output = name => fileURLToPath(new URL(`../../../.visual-check/theme-${name}.png`, import.meta.url));
async function navigate(page, name) {
  await page.getByRole('button', { name: 'Abrir busca avançada' }).click();
  await page.getByRole('combobox', { name: 'Buscar páginas, recursos ou ações' }).fill(name);
  await page.getByRole('option').filter({ has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) }).click();
}
const colors = locator => locator.evaluate(el => {
  const style = getComputedStyle(el);
  return { color: style.color, background: style.backgroundColor, border: style.borderColor };
});
const previewColors = page => page.locator('.editor-preview-stage :is(input, button, h2, label)').evaluateAll(elements => elements.map(el => {
  const style = getComputedStyle(el);
  return [style.color, style.backgroundColor, style.borderColor, getComputedStyle(el, '::placeholder').color];
}));

test('tema do login segue o sistema, mantém escolha após recarregar e funciona no celular', async ({ page }) => {
  await mockAdmin(page, { anonymous: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Ativar modo claro' })).toBeVisible();
  await expect(page.locator('.login-form-panel')).toHaveCSS('background-color', 'rgb(36, 28, 25)');
  await page.screenshot({ path: output('login-desktop'), fullPage: true, animations: 'disabled' });
  await contrast(page);
  await page.getByRole('button', { name: 'Ativar modo claro' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ativar modo escuro' })).toBeVisible();
  await expect(page.locator('.login-form-panel')).toHaveCSS('background-color', 'rgb(255, 252, 248)');
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Ativar modo claro' })).toBeInViewport();
  await expect(page.locator('.login-mobile-brand img')).toHaveAttribute('src', '/brand/pirat-logo-on-dark.png');
  await page.screenshot({ path: output('login-mobile'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await expect(page.getByRole('heading', { name: 'Recupere seu acesso' })).toBeVisible();
  await expect(page.locator('.login-form-panel')).toHaveCSS('background-color', 'rgb(36, 28, 25)');
});

test('painel lembra tema na navegação, formulários, menu móvel e gráficos', async ({ page }) => {
  const mock = await mockAdmin(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await expect(page.locator('.app')).toHaveCSS('background-color', 'rgb(23, 18, 16)');
  await expect(page.locator('.admin-chart-summary')).toContainText('4.401,00');
  await page.screenshot({ path: output('dashboard-desktop'), fullPage: true, animations: 'disabled' });
  for (const name of ['Produtos', 'Pedidos', 'Checkouts', 'Configurações', 'Análises', 'Gateways', 'Logística', 'Cupons']) {
    await navigate(page, name);
    await expect(page.locator('.topbar-context strong')).toHaveText(name);
    await page.locator('.page').first().waitFor();
    await page.screenshot({ path: output(name), fullPage: true, animations: 'disabled' });
    await contrast(page);
  }
  await navigate(page, 'Produtos');
  await page.getByRole('button', { name: 'Criar produto', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').screenshot({ path: output('product-dialog') });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ativar modo claro' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Ativar modo claro' })).toBeInViewport();
  await page.screenshot({ path: output('dashboard-mobile'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.screenshot({ path: output('menu-mobile'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  expect(mock.mutations).toEqual([]);
});

test('editor muda apenas sua interface, preserva cores e valores do checkout e não salva alterações', async ({ page }) => {
  const mock = await mockAdmin(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await navigate(page, 'Checkouts');
  await page.getByRole('button', { name: 'Personalizar', exact: true }).first().click();
  const card = page.locator('.ep-card').first();
  await expect(card).toBeVisible();
  const before = await colors(card);
  const controlsBefore = await previewColors(page);
  await page.locator('.editor-top').getByRole('button', { name: 'Ativar modo escuro' }).click();
  await expect(page.locator('.editor-panel')).toHaveCSS('background-color', 'rgb(36, 28, 25)');
  expect(await colors(card)).toEqual(before);
  expect(await previewColors(page)).toEqual(controlsBefore);
  await expect(page.locator('.editor-save-state')).toHaveText('Rascunho salvo');
  await page.screenshot({ path: output('editor-desktop'), fullPage: true, animations: 'disabled' });
  await contrast(page, '.editor-panel');
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeInViewport();
    await expect(page.locator('.editor-top').getByRole('button', { name: 'Ativar modo claro' })).toBeInViewport();
    expect(await page.locator('.solid-editor').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('editor-mobile'), fullPage: true, animations: 'disabled' });
  expect(mock.mutations).toEqual([]);
});

test('preferência sincroniza entre abas sem alterar a sessão', async ({ page, context }) => {
  await mockAdmin(page, { anonymous: true });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const second = await context.newPage();
  await mockAdmin(second, { anonymous: true });
  await second.goto('/');
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await expect(second.getByRole('button', { name: 'Ativar modo claro' })).toBeVisible();
  await second.close();
});

test('tema continua alternando quando o navegador bloqueia a gravação da preferência', async ({ page }) => {
  await mockAdmin(page, { anonymous: true });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'pirat-appearance-v1') throw new DOMException('Storage blocked', 'SecurityError');
      return originalGet.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'pirat-appearance-v1') throw new DOMException('Storage blocked', 'SecurityError');
      return originalSet.call(this, key, value);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await expect(page.locator('.login-form-panel')).toHaveCSS('background-color', 'rgb(36, 28, 25)');
  await page.getByRole('button', { name: 'Ativar modo claro' }).click();
  await expect(page.locator('.login-form-panel')).toHaveCSS('background-color', 'rgb(255, 252, 248)');
});
