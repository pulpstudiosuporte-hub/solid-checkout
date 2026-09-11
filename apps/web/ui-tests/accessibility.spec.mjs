import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAdmin } from './fixtures.mjs';

test('main management pages have no WCAG A/AA violations', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/');
  await expect(page.locator('.home-greeting h1')).toContainText('Marina');
  const findings = [];
  for (const name of ['Início', 'Pedidos', 'Produtos', 'Análises', 'Checkouts']) {
    if (name !== 'Início') {
      await page.getByRole('button', { name: 'Abrir busca avançada' }).click();
      await page.getByRole('combobox', { name: 'Buscar páginas, recursos ou ações' }).fill(name);
      await page.getByRole('option').filter({ has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) }).click();
      await expect(page.locator('.topbar-context strong')).toHaveText(name);
    }
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    findings.push(...result.violations.map(v => ({ page: name, id: v.id, targets: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })));
  }
  expect(findings).toEqual([]);
});

test('login and mobile navigation expose accessible names and contrast', async ({ page }) => {
  await mockAdmin(page, { anonymous: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('checkout settings and media library support keyboard and accessible controls', async ({ page }) => {
  await mockAdmin(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/media/images', route => route.fulfill({ json: { items: [], usedBytes: 0, quotaBytes: 104857600, nextCursor: null } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir busca avançada' }).click();
  await page.getByRole('combobox', { name: 'Buscar páginas, recursos ou ações' }).fill('Checkouts');
  await page.getByRole('option').filter({ has: page.locator('b', { hasText: /^Checkouts$/ }) }).click();
  await page.getByRole('button', { name: 'Personalizar', exact: true }).first().click();
  await page.getByRole('navigation', { name: 'Seções de personalização' }).getByRole('button', { name: /^Cabeçalho/ }).click();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  const open = page.getByRole('button', { name: 'Biblioteca de imagens' }).first();
  await open.click();
  await expect(page.getByText('Suas imagens enviadas aparecerão aqui.')).toBeVisible();
  expect((await new AxeBuilder({ page }).include('.media-library').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(open).toBeFocused();
});
