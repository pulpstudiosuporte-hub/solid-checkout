import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));
for (const template of ['retail', 'marketplace']) {
  for (const width of (template === 'retail' ? [1440, 1100, 768, 390, 320] : [1440, 390])) test(`${template} ${width}: identificação, entrega e Pix`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    await page.goto(`/ui-tests/templates-review.html?template=${template}&pink${width === 1440 ? '&narrow' : ''}`);
    await expect(page.getByRole('textbox', { name: 'Nome completo', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: output(`template-${template}-${width}.png`), fullPage: true });
    if (template === 'retail' && width > 1000) {
      const left = await page.locator('.retail-products-column').boundingBox();
      const center = await page.locator('.customer-step').boundingBox();
      const right = await page.locator('.session-summary-column').boundingBox();
      expect(left.x + left.width).toBeLessThanOrEqual(center.x);
      expect(center.x + center.width).toBeLessThanOrEqual(right.x + 1);
    }
    await page.getByRole('textbox', { name: 'Nome completo', exact: true }).fill('Cliente Teste');
    await page.getByRole('combobox', { name: 'E-mail', exact: true }).fill('teste@example.com');
    await page.getByRole('textbox', { name: 'Celular / WhatsApp', exact: true }).fill('11999999999');
    await page.locator('.customer-step button[type=submit]').click();
    await page.getByLabel('CEP', { exact: true }).fill('01001000');
    await page.getByLabel('Rua ou avenida', { exact: true }).fill('Rua de teste');
    await page.getByLabel('Número', { exact: true }).fill('10');
    await page.getByLabel('Bairro', { exact: true }).fill('Centro');
    await page.getByLabel('Cidade', { exact: true }).fill('São Paulo');
    await page.getByLabel('Estado', { exact: true }).fill('SP');
    await page.screenshot({ path: output(`template-${template}-${width}-delivery.png`), fullPage: true });
    if (template === 'retail') {
      expect(await page.locator('.delivery-form-actions > button').evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth && button.scrollHeight <= button.clientHeight))).toBe(true);
      const number = await page.getByLabel('Número', { exact: true }).boundingBox();
      expect(number.width).toBeGreaterThan(200);
    }
    await page.getByRole('button', { name: 'Calcular entrega' }).click();
    await page.getByRole('button', { name: /Entrega de teste/ }).click();
    await page.getByLabel('CPF do pagador').fill('49257810810');
    if (template === 'retail') {
      const copy = await page.locator('.pix-method-card > div').boundingBox();
      const benefits = await page.locator('.pix-method-benefits').boundingBox();
      expect(copy.width).toBeGreaterThan(80);
      expect(benefits.y >= copy.y + copy.height || benefits.x >= copy.x + copy.width).toBe(true);
      expect(await page.locator('.payment-final-actions > button').evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth && button.scrollHeight <= button.clientHeight))).toBe(true);
    }
    await page.screenshot({ path: output(`template-${template}-${width}-payment.png`), fullPage: true });
    await page.locator(template === 'marketplace' && width > 1000 ? '.marketplace-summary-pay' : '.payment-final-actions .customer-continue').click();
    await expect(page.getByRole('heading', { name: 'Quase lá...' })).toBeVisible();
    if (template === 'retail') await expect(page.locator('.retail-products-column')).toHaveCount(0);
    await page.screenshot({ path: output(`template-${template}-${width}-generated.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
