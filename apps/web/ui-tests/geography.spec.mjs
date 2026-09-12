import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));
test('geography keeps the background and valid city or region markers aligned on desktop and mobile', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/ui-tests/geography-review.html');
  const map = page.locator('.home-geo');
  await page.getByRole('button', { name: 'Ver mapa plano', exact: true }).click();
  await expect(map.locator('.world-map-visual g')).toHaveCount(6);
  await expect(map.locator('.world-map-missing')).toContainText('1 localização sem ponto disponível');
  await expect(map.locator('.geo-location-list')).toBeVisible();
  const saoPaulo = map.locator('.world-map-visual g').filter({ has: page.locator('title', { hasText: 'São Paulo' }) }).locator('circle').first();
  expect(Number(await saoPaulo.getAttribute('cx'))).toBeCloseTo(288.96833, 4);
  expect(Number(await saoPaulo.getAttribute('cy'))).toBeCloseTo(297.45606, 4);
  await expect(map.locator('.world-map-base')).toHaveAttribute('preserveAspectRatio', 'none');
  await page.waitForFunction(() => [...document.images].every(img => img.complete));
  await map.screenshot({ path: output('geography-flat-desktop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await map.screenshot({ path: output('geography-flat-mobile.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(Number(await saoPaulo.getAttribute('cx'))).toBeCloseTo(288.96833, 4);
  await page.getByLabel('Período do alcance').selectOption('7d');
  await expect(map.locator('.world-map-visual g')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('globe renders real coordinates, selects locations, pauses and fits mobile', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/ui-tests/geography-review.html');
  const map = page.locator('.home-geo');
  await map.scrollIntoViewIfNeeded();
  const globe = map.locator('.globe-3d');
  await expect(globe).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
  await expect(globe).toHaveAttribute('data-marker-count', '6');
  await expect(map.locator('.globe-missing')).toContainText('1 localização sem ponto disponível');
  await expect(globe.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Pausar rotação', exact: true }).click();
  await expect(globe).toHaveAttribute('data-rotating', 'false');
  await page.getByLabel('Explorar localização').selectOption('0');
  await expect(globe.locator('.globe-hint')).toContainText('São Paulo · SP · BR · 7 visitantes');
  await map.screenshot({ path: output('desktop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(globe.locator('canvas')).toBeVisible();
  await map.screenshot({ path: output('mobile.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Período do alcance').selectOption('7d');
  await expect(page.getByLabel('Explorar localização')).toHaveValue('');
  await expect(globe).toHaveAttribute('data-marker-count', '6');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(globe).toHaveAttribute('data-rotating', 'false');
  await expect(page.getByRole('button', { name: 'Retomar rotação' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver mapa plano', exact: true }).click();
  await expect(map.locator('.world-map-visual g')).toHaveCount(6);
  await page.getByRole('button', { name: 'Ver globo 3D', exact: true }).click();
  await expect(globe).toHaveAttribute('data-state', 'ready');
  await expect(globe).toHaveAttribute('data-rotating', 'false');
  expect(errors).toEqual([]);
  await page.locator('.globe-3d canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost')));
  await expect(page.getByText('3D indisponível. Exibindo o mapa plano.')).toBeVisible();
});

test('failed Earth textures keep the flat map and location list usable', async ({ page }) => {
  await page.route('**/illustrations/globe/*', route => route.abort());
  await page.goto('/ui-tests/geography-review.html');
  await expect(page.getByText('3D indisponível. Exibindo o mapa plano.')).toBeVisible();
  await expect(page.locator('.world-map-visual g')).toHaveCount(6);
  await expect(page.locator('.geo-location-list')).toContainText('São Paulo');
});

test('without WebGL the visitor map remains available', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl') ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/ui-tests/geography-review.html');
  await expect(page.getByText('3D indisponível. Exibindo o mapa plano.')).toBeVisible();
  await expect(page.locator('.world-map-visual g')).toHaveCount(6);
});

test('an empty store shows the globe without demonstration markers', async ({ page }) => {
  await page.goto('/ui-tests/geography-review.html?empty');
  const globe = page.locator('.globe-3d');
  await expect(globe).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
  await expect(globe).toHaveAttribute('data-marker-count', '0');
  await expect(page.getByLabel('Explorar localização')).toHaveCount(0);
  await expect(page.locator('.geo-empty-note')).toContainText('próximas visitas');
});
