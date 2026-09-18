import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mockAdmin } from './fixtures.mjs';

for (const theme of ['light', 'dark']) {
  test(`tablet ocupa a largura disponível e mantém o menu acessível: ${theme}`, async ({ page }) => {
    const mock = await mockAdmin(page);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');
    // Exercise a desktop preference carried over into the tablet drawer.
    await page.getByRole('button', { name: 'Recolher menu', exact: true }).click();
    for (const width of [768, 900, 901, 962, 1024, 1050]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.locator('.main-shell')).toHaveCSS('margin-left', '0px');
      const shell = await page.locator('.main-shell').boundingBox();
      expect(shell.x).toBe(0);
      expect(shell.width).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      await expect(page.getByRole('complementary', { name: 'Navegação da loja' })).toBeHidden();
      await expect(page.getByRole('button', { name: theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro' })).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Notificações', exact: true })).toBeInViewport();
      await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
      const drawer = page.getByRole('complementary', { name: 'Navegação da loja' });
      await expect(drawer).toBeInViewport();
      await expect(drawer.locator('.brand-symbol')).toBeVisible();
      await expect(drawer.locator('.resource-head')).toHaveCSS('display', 'grid');
      await expect(drawer.locator('.profile > span')).toHaveCSS('display', 'flex');
      await expect(drawer.getByRole('button', { name: 'Pedidos', exact: true })).toBeVisible();
      await expect(drawer.getByRole('button', { name: 'Pedidos', exact: true }).locator('span')).toBeVisible();
      await expect(page.locator('.backdrop')).toBeVisible();
      if (width === 962) await page.screenshot({ path: fileURLToPath(new URL(`../../../.visual-check/tablet-menu-${theme}.png`, import.meta.url)), animations: 'disabled' });
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      if (width === 962) await page.screenshot({ path: fileURLToPath(new URL(`../../../.visual-check/tablet-panel-${theme}.png`, import.meta.url)), animations: 'disabled' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 1050 });
    await expect(page.getByRole('button', { name: 'Expandir menu', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Expandir menu', exact: true }).click();
    await expect(page.locator('.main-shell')).toHaveCSS('margin-left', '264px');
    expect(mock.mutations).toEqual([]);
  });
}
