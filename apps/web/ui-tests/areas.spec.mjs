import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));

test('webhooks respect read-only permissions and show the selected store', async ({ page }) => {
  await page.goto('/ui-tests/areas-review.html');
  await expect(page.getByRole('heading', { name: 'ERP Loja A' })).toBeVisible();
  await page.getByLabel('Somente leitura').check();
  await expect(page.getByRole('button', { name: 'Novo webhook' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar teste', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Ações de/ })).toHaveCount(0);
  await page.getByLabel('Somente leitura').uncheck();
  await page.getByRole('button', { name: 'Novo webhook' }).click();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Trocar loja' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ERP Loja B' })).toBeVisible();
});

test('webhook creation offers manual secret copying and queued delivery refreshes', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/ui-tests/areas-review.html');
  await page.getByRole('button', { name: 'Enviar teste', exact: true }).click();
  await expect(page.getByText('Envio agendado', { exact: true })).toBeVisible();
  await expect(page.getByText('Último envio entregue', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Novo webhook' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill('CRM de exemplo');
  await dialog.getByLabel('URL do webhook').fill('https://example.com/hook');
  await dialog.getByText('Pedido pago', { exact: true }).click();
  await expect(dialog.getByLabel(/Pedido pago/)).toBeChecked();
  await dialog.getByRole('button', { name: 'Salvar webhook' }).click();
  await dialog.getByRole('button', { name: 'Copiar chave' }).click();
  await expect(dialog.getByRole('status')).toContainText('copie manualmente');
  await expect(dialog.getByLabel('Chave secreta do webhook')).toHaveValue('chave-ficticia-para-teste-local-1234567890');
  await dialog.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByRole('heading', { name: 'CRM de exemplo' })).toBeVisible();
  await page.screenshot({ path: output('webhooks-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('webhooks-mobile.png'), fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('ChromaSense keeps filters and data consistent and clears data on a failed refresh', async ({ page }) => {
  await page.goto('/ui-tests/areas-review.html');
  await page.getByRole('button', { name: 'ChromaSense', exact: true }).click();
  await expect(page.getByLabel('Checkout analisado')).toHaveValue('checkout-a');
  await expect(page.locator('.checkout-analytics-render')).toHaveJSProperty('inert', true);
  await page.getByRole('button', { name: '90 dias', exact: true }).click();
  await page.getByRole('button', { name: '7 dias', exact: true }).click();
  await page.getByRole('button', { name: 'Trocar loja' }).click();
  await expect(page.getByLabel('Checkout analisado')).toHaveValue('checkout-b');
  await page.getByRole('tab', { name: 'Sessões', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Checkout B');
  await expect(page.getByRole('table')).not.toContainText('Checkout A');
  await page.screenshot({ path: output('chromasense-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('chromasense-mobile.png'), fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Simular falha').check();
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Falha de conexão simulada');
  await expect(page.getByRole('table')).toHaveCount(0);
});
