import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mockAdmin } from './fixtures.mjs';
const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));

async function openPage(page, name) {
  await page.getByRole('button', { name: 'Abrir busca avançada' }).click();
  await page.getByRole('combobox', { name: 'Buscar páginas, recursos ou ações' }).fill(name);
  await page.getByRole('option').filter({ has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) }).click();
  await expect(page.locator('.topbar-context strong')).toHaveText(name);
}
async function ready(page) {
  await expect(page.locator('.home-greeting h1')).toContainText('Marina');
  await expect(page.locator('.admin-revenue-card')).toHaveAttribute('aria-busy', 'false');
  await page.evaluate(() => document.fonts.ready);
}
async function fits(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const shell = page.locator('.main-shell');
  if (await shell.count() && page.viewportSize().width <= 900) await expect.poll(async () => (await shell.boundingBox()).width).toBe(page.viewportSize().width);
}

test('visão geral mostra dados de teste da API e gráfico explorável', async ({ page }) => {
  const mock = await mockAdmin(page);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await ready(page);
  await expect(page.locator('.admin-chart-summary')).toContainText('4.401,00');
  await page.locator('.chart-hit-point').first().focus();
  await expect(page.locator('.dashboard-chart-tooltip')).toContainText('298,00');
  await page.getByLabel('Período da receita').selectOption('month');
  await expect(page.locator('.admin-revenue-card')).toHaveAttribute('aria-busy', 'false');
  await page.mouse.move(0, 0);
  await page.screenshot({ path: output('admin-dashboard-desktop.png'), fullPage: true });
  await fits(page); expect(errors).toEqual([]); expect(mock.unexpected).toEqual([]); expect(mock.mutations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await fits(page);
  await page.screenshot({ path: output('admin-dashboard-mobile.png'), fullPage: true });
});

for (const [name, selector, file] of [['Produtos', '.products-table', 'produtos'], ['Pedidos', '.orders-page', 'pedidos'], ['Checkouts', '.checkout-card', 'checkouts'], ['Configurações', '.settings-hub-panel', 'configuracoes'], ['Análises', '.analytics-page', 'analises'], ['Gateways', '.gateway-catalog-card', 'gateways'], ['Logística', '.logistics-page', 'logistica'], ['Order bumps', '.order-bumps-page', 'ofertas'], ['Cupons', '.coupons-page', 'cupons']]) {
  test(`página ${name}: layout desktop e mobile`, async ({ page }) => {
    const mock = await mockAdmin(page);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/'); await ready(page); await openPage(page, name);
    await expect(page.locator(selector).first()).toBeVisible();
    await page.screenshot({ path: output(`admin-${file}-desktop.png`), fullPage: true });
    await fits(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await fits(page);
    await page.screenshot({ path: output(`admin-${file}-mobile.png`), fullPage: true });
    await fits(page); expect(errors).toEqual([]); expect(mock.unexpected).toEqual([]); expect(mock.mutations).toEqual([]);
  });
}

test('menu compacto, busca, formulário e navegação móvel continuam utilizáveis', async ({ page }) => {
  const mock = await mockAdmin(page);
  await page.goto('/'); await ready(page);
  await page.getByRole('button', { name: 'Recolher menu' }).click();
  await expect(page.locator('.app')).toHaveClass(/sidebar-collapsed/);
  await page.getByRole('button', { name: 'Expandir menu' }).click();
  await openPage(page, 'Produtos');
  await page.getByRole('button', { name: 'Criar produto', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').screenshot({ path: output('admin-produto-modal.png') });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.screenshot({ path: output('admin-mobile-menu.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir menu', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.getByRole('tab', { name: 'Checkout', exact: true }).click();
  await page.locator('.resource-list').getByRole('button', { name: 'Checkouts', exact: true }).click();
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await expect(page.locator('.topbar-context strong')).toHaveText('Checkouts');
  expect(mock.mutations).toEqual([]);
});

test('login, cadastro e recuperação com viewport real', async ({ page }) => {
  const mock = await mockAdmin(page, { anonymous: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  await page.screenshot({ path: output('admin-login-desktop.png'), fullPage: true });
  await page.getByLabel('Senha', { exact: true }).fill('senha-ficticia');
  await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await expect(page.getByRole('heading', { name: 'Recupere seu acesso' })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar para o login' }).click();
  for (const width of [320, 390, 768]) { await page.setViewportSize({ width, height: 844 }); await fits(page); }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('admin-login-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Crie sua conta' })).toBeVisible();
  await fits(page); expect(mock.mutations).toEqual([]);
});

test('painel se adapta de 320 a 1440 pixels e receita apresenta erro recuperável', async ({ page }) => {
  await mockAdmin(page, { revenueError: true });
  await page.goto('/');
  await expect(page.locator('.admin-revenue-card')).toContainText('Não foi possível atualizar o gráfico');
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('.admin-revenue-card')).toHaveAttribute('aria-busy', 'false');
  for (const width of [320, 390, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); await fits(page); }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('admin-dashboard-error-mobile.png'), fullPage: true });
});

test('estado sem vendas e sem produtos mantém ações claras', async ({ page }) => {
  const mock = await mockAdmin(page, { empty: true });
  await page.goto('/'); await ready(page);
  await expect(page.locator('.admin-chart-summary')).toContainText('0,00');
  await openPage(page, 'Produtos');
  await expect(page.locator('.products-state')).toContainText('Nenhum produto encontrado');
  await expect(page.locator('.products-state').getByRole('button', { name: 'Criar produto' })).toBeVisible();
  expect(mock.mutations).toEqual([]);
});

test('gráfico anual permite navegar os 365 dias sem estourar a largura', async ({ page }) => {
  await mockAdmin(page, { fullYear: true });
  await page.goto('/'); await ready(page);
  await page.getByLabel('Período da receita').selectOption('year');
  await expect(page.locator('.chart-hit-point')).toHaveCount(365);
  await expect(page.locator('.admin-revenue-card .x-labels span')).toHaveCount(7);
  await page.locator('.chart-hit-point').first().focus();
  await page.keyboard.press('End');
  await expect(page.locator('.dashboard-chart-tooltip')).toContainText('31/12');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.dashboard-chart-tooltip')).toContainText('30/12');
  await page.keyboard.press('Home');
  await expect(page.locator('.dashboard-chart-tooltip')).toContainText('01/01');
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 900 }); await fits(page); }
});
