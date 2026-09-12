import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));
const path = '/ui-tests/exit-offer-review.html';
test('merchant customizes, previews and saves exit offer', async ({ page }) => {
  await page.goto(path);
  await page.getByRole('button', { name: /Oferta de saída Cupom/ }).click();
  await page.getByLabel('Título', { exact: true }).fill('Espere, temos um presente!');
  await page.getByRole('button', { name: 'Visualizar popup', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Espere, temos um presente!');
  await expect(page.getByRole('dialog')).toContainText('10% OFF');
  await page.screenshot({ path: output('desktop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('mobile.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Fechar oferta' }).click();
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.getByText('Rascunho salvo no teste')).toBeVisible();
});
async function trigger(page) {
  await page.getByRole('textbox', { name: 'Nome completo' }).click();
  await page.getByRole('textbox', { name: 'Nome completo' }).fill('Maria da Silva');
  await page.clock.fastForward(6000);
  await page.locator('html').dispatchEvent('mouseleave', { clientY: 0 });
}
test('buyer accepts actual coupon and popup does not repeat after reload', async ({ page }) => {
  await page.clock.install(); await page.goto(`${path}?buyer`);
  await trigger(page);
  await expect(page.getByRole('dialog')).toContainText('10% OFF');
  await page.getByRole('button', { name: 'Sim, quero aproveitar!' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.checkout-inline-coupon').getByText('Cupom FICA10 aplicado.')).toBeVisible();
  await expect(page.getByRole('complementary')).toContainText('R$ 90,00');
  await page.reload(); await trigger(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('refusal and server error leave checkout usable', async ({ page }) => {
  await page.clock.install(); await page.goto(`${path}?buyer&fail`); await trigger(page);
  await page.getByRole('button', { name: 'Sim, quero aproveitar!' }).click();
  await expect(page.getByRole('dialog')).toContainText('Cupom indisponível');
  await page.getByRole('button', { name: 'Não, obrigado', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Nome completo' }).fill('Maria Oliveira');
});
test('mobile scroll back to top triggers a single offer without changing history', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.clock.install(); await page.goto(`http://127.0.0.1:5173${path}?buyer`);
  await page.getByRole('textbox', { name: 'Nome completo' }).fill('Maria');
  await page.clock.fastForward(6000);
  const historyLength = await page.evaluate(() => history.length);
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(250);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.getByRole('button', { name: 'Fechar oferta' }).click();
  await context.close();
});

test('unavailable offer is silent and an expired offer cannot be accepted', async ({ page }) => {
  await page.clock.install(); await page.goto(`${path}?buyer&unavailable`); await trigger(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`${path}?buyer&short`); await trigger(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.fastForward(20000);
  await expect(page.getByRole('button', { name: 'Oferta encerrada' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Nome completo' })).toBeFocused();
});
