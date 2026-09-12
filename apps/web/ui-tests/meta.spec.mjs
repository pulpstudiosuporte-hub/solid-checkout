import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));

test('a read permission failure can be resolved with an explicit test code', async ({ page }) => {
  await page.goto('/ui-tests/meta-review.html');
  await page.getByLabel('ID do Pixel').fill('123456789012345');
  await page.getByLabel('Token da API de Conversões').fill('local-test-token-not-a-real-secret');
  await page.getByRole('button', { name: 'Conectar Meta' }).click();
  await expect(page.getByRole('status')).toContainText('Eventos de teste');
  await expect(page.getByLabel('ID do Pixel')).toHaveValue('123456789012345');
  await expect(page.getByLabel('Token da API de Conversões')).toHaveAttribute('type', 'password');
  await page.screenshot({ path: output('desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel('Código de Eventos de teste (opcional)').fill('TEST12345');
  await page.getByRole('button', { name: 'Conectar Meta' }).click();
  await expect(page.getByRole('status')).toContainText('conectados com sucesso');
  await expect(page.getByRole('button', { name: 'Desconectar' })).toBeVisible();
});
