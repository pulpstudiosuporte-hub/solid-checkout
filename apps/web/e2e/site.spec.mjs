import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));

test('demonstração funciona sem carregar painel ou criar uma cobrança', async ({ page }) => {
  const requests = [];
  const failures = [];
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/site.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('checkout à altura');
  await expect(page.locator('.demo-total')).toContainText('149,00');
  await page.getByRole('checkbox', { name: 'Adicionar ecobag por 29 reais' }).check();
  await expect(page.locator('.demo-total')).toContainText('178,00');
  await page.getByRole('button', { name: 'Azul', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Azul', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Experimentar pagamento' }).click();
  await expect(page.getByRole('status')).toContainText('178,00');
  await page.getByRole('button', { name: 'Experimentar de novo' }).click();
  await expect(page.getByRole('checkbox')).toBeChecked();
  expect(requests.some(request => /AdminApp|PublicApp/.test(request.url))).toBe(false);
  expect(requests.some(request => request.method === 'POST' && /payment|pix|checkout-session/.test(request.url))).toBe(false);
  expect(failures).toEqual([]);
});

test('abas, perguntas e navegação funcionam com teclado', async ({ page }) => {
  await page.goto('/site.html');
  const tab = page.getByRole('button', { name: 'Sua marca', exact: true });
  await tab.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#feature-detail')).toContainText('A identidade também');
  await page.getByRole('button', { name: 'Ofertas', exact: true }).click();
  await expect(page.locator('#feature-detail')).toContainText('order bumps');
  await page.getByRole('button', { name: 'Gestão', exact: true }).click();
  await expect(page.locator('#feature-detail')).toContainText('Menos abas');
  await page.getByText('Preciso usar Shopify?', { exact: true }).click();
  await expect(page.locator('details').filter({ hasText: 'Preciso usar Shopify?' })).toHaveAttribute('open', '');
  await page.getByRole('link', { name: 'Criar minha conta' }).click();
  await expect(page).toHaveURL(/#\/cadastro$/);
  await expect(page.locator('.login-card')).toBeVisible();
});

test('captura desktop e seções completas', async ({ page }) => {
  await page.goto('/site.html');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output('site-desktop.png'), fullPage: true });
  await page.locator('#recursos').screenshot({ path: output('site-recursos.png') });
  await page.locator('#integracoes').screenshot({ path: output('site-integracoes.png') });
  await page.locator('#duvidas').screenshot({ path: output('site-duvidas.png') });
});

test('mobile real não transborda e permite usar o menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/site.html');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: output('site-mobile.png'), fullPage: true });
  await page.screenshot({ path: output('site-mobile-topo.png') });
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Recursos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(/#recursos$/);
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
});

test('layout estreito e movimento reduzido continuam utilizáveis', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/site.html');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
