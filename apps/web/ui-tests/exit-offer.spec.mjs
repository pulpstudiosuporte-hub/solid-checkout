import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));
const path = '/ui-tests/exit-offer-review.html';

test('missing coupon explains the error before saving or publishing and preserves edits', async ({ page }) => {
  await page.goto(path);
  await page.getByRole('button', { name: /Oferta de saída Cupom/ }).click();
  await page.getByLabel('Título', { exact: true }).fill('Meu desconto especial');
  await page.getByRole('combobox', { name: 'Cupom da oferta', exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Selecione um cupom em Oferta de saída');
  await expect(page.getByRole('combobox', { name: 'Cupom da oferta', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.screenshot({ path: output('coupon-validation-desktop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('coupon-validation-mobile.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByText('Rascunho salvo no teste', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Selecione um cupom');
  await expect(page.getByText('Publicado no teste', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Meu desconto especial');
  await page.getByRole('combobox', { name: 'Cupom da oferta', exact: true }).selectOption('FICA10');
  await expect(page.getByRole('combobox', { name: 'Cupom da oferta', exact: true })).toHaveAttribute('aria-invalid', 'false');
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.getByText('Rascunho salvo no teste', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText('Publicado no teste', { exact: true })).toBeVisible();
});

test('disabled exit offer can be saved without a coupon', async ({ page }) => {
  await page.goto(path);
  await page.getByRole('button', { name: /Oferta de saída Cupom/ }).click();
  await page.getByRole('combobox', { name: 'Cupom da oferta', exact: true }).selectOption('');
  await page.getByLabel('Ativar oferta de saída', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.getByText('Rascunho salvo no teste', { exact: true })).toBeVisible();
});
test('merchant customizes, previews and saves exit offer', async ({ page }) => {
  await page.goto(path);
  await page.getByRole('button', { name: /Oferta de saída Cupom/ }).click();
  await page.getByLabel('Título', { exact: true }).fill('Espere, temos um presente!');
  await page.getByLabel('Mostrar também por tempo').check();
  await page.getByLabel('Abrir automaticamente após (segundos)').fill('45');
  await page.getByRole('button', { name: 'Visualizar popup', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Espere, temos um presente!');
  await expect(page.getByRole('dialog')).toContainText('10% OFF');
  await page.screenshot({ path: output('desktop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('mobile.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Fechar oferta' }).click();
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.getByText('Rascunho salvo no teste: oferta após 45s')).toBeVisible();
});

test('timer opens without interaction and shares the once-per-session guard with exit', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-09-12T12:00:01Z')); await page.goto(`${path}?buyer&timed`);
  await expect(page.getByRole('textbox', { name: 'Nome completo' })).toBeVisible();
  await page.clock.fastForward(7000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.fastForward(2000);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar oferta' }).click();
  await page.locator('html').dispatchEvent('mouseleave', { clientY: 0 });
  await page.clock.fastForward(60000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Nome completo' })).toBeVisible();
  await page.clock.fastForward(10000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('timer can be disabled and approaching the top works without a click', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-09-12T12:00:01Z')); await page.goto(`${path}?buyer`);
  await expect(page.getByRole('textbox', { name: 'Nome completo' })).toBeVisible();
  await page.mouse.move(300, 300);
  await page.mouse.move(300, 12);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.fastForward(60000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.mouse.move(300, 300);
  await page.mouse.move(300, 12);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('timer waits for another dialog to close', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-09-12T12:00:01Z')); await page.goto(`${path}?buyer&timed`);
  await expect(page.getByRole('textbox', { name: 'Nome completo' })).toBeVisible();
  await page.evaluate(() => { const dialog = document.createElement('dialog'); dialog.id = 'other-dialog'; document.body.append(dialog); dialog.showModal(); });
  await page.clock.fastForward(10000);
  await expect(page.locator('.exit-offer-dialog')).toHaveCount(0);
  await page.evaluate(() => document.getElementById('other-dialog').remove());
  await page.clock.fastForward(2000);
  await expect(page.locator('.exit-offer-dialog')).toBeVisible();
});

test('timer also opens on mobile without scrolling', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-09-12T12:00:01Z')); await page.goto(`http://127.0.0.1:5173${path}?buyer&timed`);
  await expect(page.getByRole('textbox', { name: 'Nome completo' })).toBeVisible();
  await page.clock.fastForward(10000);
  await expect(page.getByRole('dialog')).toBeVisible();
  await context.close();
});
async function trigger(page) {
  await page.getByRole('textbox', { name: 'Nome completo' }).click();
  await page.getByRole('textbox', { name: 'Nome completo' }).fill('Maria da Silva');
  await page.clock.fastForward(6000);
  await page.locator('html').dispatchEvent('mouseleave', { clientY: 0 });
}
test('buyer accepts actual coupon and popup does not repeat after reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-09-12T12:00:01Z')); await page.goto(`${path}?buyer`);
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
  await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-09-12T12:00:01Z')); await page.goto(`${path}?buyer&fail`); await trigger(page);
  await page.getByRole('button', { name: 'Sim, quero aproveitar!' }).click();
  await expect(page.getByRole('dialog')).toContainText('Cupom indisponível');
  await page.getByRole('button', { name: 'Não, obrigado', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Nome completo' }).fill('Maria Oliveira');
});
test('mobile scroll back to top triggers a single offer without changing history', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-09-12T12:00:01Z')); await page.goto(`http://127.0.0.1:5173${path}?buyer`);
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
  await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-09-12T12:00:01Z')); await page.goto(`${path}?buyer&unavailable`); await trigger(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`${path}?buyer&short`); await trigger(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.fastForward(20000);
  await expect(page.getByRole('button', { name: 'Oferta encerrada' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Nome completo' })).toBeFocused();
});
