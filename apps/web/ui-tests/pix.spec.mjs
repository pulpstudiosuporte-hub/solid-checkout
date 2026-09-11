import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));
async function generate(page) {
  await page.goto('/ui-tests/pix-review.html');
  await page.getByRole('textbox', { name: 'Nome completo', exact: true }).fill('Cliente Teste');
  await page.getByRole('combobox', { name: 'E-mail', exact: true }).fill('teste@example.com');
  await page.getByRole('textbox', { name: 'Celular / WhatsApp', exact: true }).fill('11999999999');
  await page.locator('button[type="submit"]').click();
  await page.getByRole('textbox', { name: 'CPF do pagador', exact: true }).fill('49257810810');
  await page.getByRole('button', { name: 'Gerar Pix', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quase lá...' })).toBeVisible();
}
async function receiptForm(page) {
  await page.locator('.pix-receipt summary').click();
  await expect(page.getByLabel('Comprovante em JPG, PNG, WebP ou PDF · até 3 MB')).toBeVisible();
}
const file = { name: 'comprovante-teste.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') };

test('desktop: falha de cópia oferece código manual e envio confirma somente após sucesso', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await generate(page);
  await page.getByLabel('Falhar cópia', { exact: true }).check();
  await page.getByRole('button', { name: 'Copiar código', exact: true }).click();
  await expect(page.getByLabel('Código Pix para copiar manualmente')).toBeFocused();
  await expect(page.getByLabel('Código Pix para copiar manualmente')).toHaveValue(/TESTE-SEM-VALOR/);
  await receiptForm(page);
  await page.getByLabel('Falhar envio', { exact: true }).check();
  await page.locator('#pix-receipt-file').setInputFiles(file);
  await expect(page.getByText('Comprovante recebido pela loja.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Enviar comprovante', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Falha simulada no envio' })).toBeVisible();
  await page.getByLabel('Falhar envio', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Enviar comprovante', exact: true }).click();
  await expect(page.getByText('Comprovante recebido pela loja.', { exact: true })).toBeVisible();
  await expect(page.getByText('Aguardando pagamento', { exact: true })).toBeVisible();
  await page.screenshot({ path: output('pix-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Alternar visão da loja' }).click();
  await expect(page.getByRole('button', { name: 'Baixar comprovante' })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar comprovante' }).click();
  expect((await downloadEvent).suggestedFilename()).toBe('comprovante-payment-review.pdf');
  expect(errors).toEqual([]);
});

test('mobile: contador expirado remove código, mantém confirmação tardia e informa falha de consulta', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await generate(page);
  await page.getByRole('button', { name: 'Expirar contador' }).click();
  await expect(page.getByRole('heading', { name: 'Este Pix expirou' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Copiar código Pix', exact: true })).toHaveCount(0);
  await expect(page.getByText('Aguardando pagamento', { exact: true })).toHaveCount(0);
  await page.getByLabel('Falhar consulta', { exact: true }).check();
  await page.getByRole('button', { name: 'Verificar pagamento' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Falha simulada ao consultar pagamento' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: output('pix-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.getByLabel('Falhar consulta', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Provedor: pago' }).click();
  await page.getByRole('button', { name: 'Verificar pagamento' }).click();
  await expect(page.locator('.thank-you-page')).toBeVisible();
});

test('valida arquivo antes de enviar e permite copiar quando a permissão é restaurada', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await generate(page);
  await page.getByLabel('Falhar cópia', { exact: true }).check();
  await page.getByRole('button', { name: 'Copiar código Pix', exact: true }).click();
  await expect(page.getByLabel('Código Pix para copiar manualmente')).toBeVisible();
  await page.getByLabel('Falhar cópia', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Copiar código Pix', exact: true }).click();
  await expect(page.getByText('Código Pix copiado.', { exact: true })).toBeVisible();
  await receiptForm(page);
  await page.locator('#pix-receipt-file').setInputFiles({ name: 'arquivo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert').filter({ hasText: 'Escolha uma imagem' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar comprovante', exact: true })).toBeDisabled();
  await page.locator('#pix-receipt-file').setInputFiles({ ...file, buffer: Buffer.alloc(3 * 1024 * 1024 + 1) });
  await expect(page.getByRole('button', { name: 'Enviar comprovante', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Tentativas de envio')).toHaveText('Envios: 0');
});
