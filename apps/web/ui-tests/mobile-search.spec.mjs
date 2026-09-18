import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mockAdmin } from './fixtures.mjs';

for (const theme of ['light', 'dark']) {
  test(`busca móvel tem espaço para leitura, toque e resultados: ${theme}`, async ({ page }) => {
    const mock = await mockAdmin(page);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');
    for (const width of [320, 390, 600, 700]) {
      await page.setViewportSize({ width, height: 844 });
      const trigger = page.getByRole('button', { name: 'Abrir busca avançada' });
      await expect(trigger.locator('span')).toBeVisible();
      const rect = await trigger.boundingBox();
      expect(rect.width).toBeGreaterThanOrEqual(width - 50);
      expect(rect.height).toBeGreaterThanOrEqual(48);
      await expect(page.getByRole('button', { name: 'Notificações', exact: true })).toBeInViewport();
      if (width === 390) await page.screenshot({ path: fileURLToPath(new URL(`../../../.visual-check/search-header-${theme}.png`, import.meta.url)), animations: 'disabled' });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Busca avançada do painel' });
      const field = page.getByRole('combobox', { name: 'Buscar páginas, recursos ou ações' });
      await expect(field).toBeFocused();
      await expect(field).toHaveCSS('font-size', '16px');
      const bounds = await dialog.boundingBox();
      expect(bounds.x).toBe(0);
      expect(bounds.width).toBe(width);
      expect((await field.boundingBox()).width).toBeGreaterThanOrEqual(width - 125);
      const close = page.getByRole('button', { name: 'Fechar busca', exact: true });
      expect((await close.boundingBox()).width).toBeGreaterThanOrEqual(44);
      if (width === 390) await page.screenshot({ path: fileURLToPath(new URL(`../../../.visual-check/search-dialog-${theme}.png`, import.meta.url)), animations: 'disabled' });
      await field.fill('configuracoes');
      await expect(dialog.getByRole('option')).toHaveCount(1);
      await page.getByRole('button', { name: 'Limpar busca' }).click();
      await expect(field).toHaveValue('');
      await expect(field).toBeFocused();
      await close.click();
      await expect(dialog).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    // A shorter viewport models the space left above an on-screen keyboard.
    await page.setViewportSize({ width: 390, height: 400 });
    await page.getByRole('button', { name: 'Abrir busca avançada' }).click();
    await page.getByRole('option').filter({ has: page.locator('b', { hasText: /^Configurações$/ }) }).click();
    await expect(page.getByRole('dialog', { name: 'Busca avançada do painel' })).toBeHidden();
    await expect(page.locator('.topbar-context strong')).toHaveText('Configurações');
    expect(mock.mutations).toEqual([]);
  });
}
