// Generate marketing images from the actual checkout renderer and local fixtures.
import { test, expect } from '@playwright/test';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
test('capturar modelos reais para a vitrine institucional', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 1050 });
  const variants = { essencial: 'minimal', varejo: 'retail', marketplace: 'marketplace', atelie: 'minimal&pink', botanica: 'minimal&natural' };
  const folder = fileURLToPath(new URL('../public/brand/templates/', import.meta.url));
  const standalone = fileURLToPath(new URL('../../../solid-site/public/brand/templates/', import.meta.url));
  await mkdir(folder, { recursive: true });
  await mkdir(standalone, { recursive: true });
  for (const [name, params] of Object.entries(variants)) {
    await page.goto(`/ui-tests/templates-review.html?gallery&template=${params}`);
    await expect(page.getByRole('textbox', { name: 'Nome completo', exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${folder}${name}.jpg`, type: 'jpeg', quality: 85 });
    await copyFile(`${folder}${name}.jpg`, `${standalone}${name}.jpg`);
  }
});
