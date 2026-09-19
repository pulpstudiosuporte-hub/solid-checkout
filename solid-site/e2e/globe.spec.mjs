import { test, expect } from '@playwright/test';

test('globo carrega sob demanda, gira com teclado e pausa os desenhos', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const globe = page.locator('.analytics-globe-canvas');
  const canvas = globe.locator('canvas');
  await expect(globe).toHaveAttribute('data-ready', 'false');
  await page.locator('#analise-avancada').scrollIntoViewIfNeeded();
  await expect(globe).toHaveAttribute('data-ready', 'true');
  await expect(globe).toHaveAttribute('data-animation', 'running');
  const shot = () => canvas.evaluate(el => el.toDataURL());
  const first = await shot();
  await expect.poll(shot).not.toBe(first);
  await page.getByRole('button', { name: 'Pausar efeitos' }).click();
  await expect(globe).toHaveAttribute('data-animation', 'paused');
  const paused = await shot();
  await page.waitForTimeout(180);
  expect(await shot()).toBe(paused);
  await page.getByRole('button', { name: 'Girar globo para a direita' }).focus();
  await page.keyboard.press('Enter');
  expect(await shot()).not.toBe(paused);
  await page.locator('#analise-avancada').screenshot({ path: '.visual-check/site-globe-desktop.png', style: '.site-header,.site-skip,.motion-toggle,.reading-progress{visibility:hidden!important}' });
  await page.getByRole('button', { name: 'Ativar efeitos' }).click();
  await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
  await expect(globe).toHaveAttribute('data-animation', 'paused');
  expect(errors).toEqual([]);
});

test('globo mobile respeita movimento reduzido, arraste e largura', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#analise-avancada');
  const globe = page.locator('.analytics-globe-canvas');
  await globe.scrollIntoViewIfNeeded();
  await expect(globe).toHaveAttribute('data-ready', 'true');
  await expect(globe).toHaveAttribute('data-animation', 'paused');
  const canvas = globe.locator('canvas');
  const before = await canvas.evaluate(el => el.toDataURL());
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 70, bounds.y + bounds.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(await canvas.evaluate(el => el.toDataURL())).not.toBe(before);
  await page.locator('#analise-avancada').screenshot({ path: '.visual-check/site-globe-mobile.png', style: '.site-header,.site-skip,.motion-toggle,.reading-progress{visibility:hidden!important}' });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('conteúdo continua disponível quando o globo não carrega', async ({ page }) => {
  await page.route('**/assets/analytics-globe-engine-*.js', route => route.abort());
  await page.goto('/#analise-avancada');
  await page.locator('#analise-avancada').scrollIntoViewIfNeeded();
  await expect(page.locator('.globe-fallback')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Veja o todo. Decida no detalhe.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Minha operação no comando' })).toHaveAttribute('href', /cadastro/);
});
