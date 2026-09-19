import { test, expect } from '@playwright/test';

test('vitrine navega entre artes dos modelos com botões e teclado', async ({ page }) => {
  await page.goto('/#templates');
  const description = page.locator('.template-description');
  await expect(description.getByRole('heading')).toHaveText('Varejo');
  await page.locator('.template-stage').scrollIntoViewIfNeeded();
  for (const image of await page.locator('.template-slide img').all()) {
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  for (const name of ['Marketplace', 'Ateliê', 'Botânica', 'Essencial', 'Varejo']) {
    await page.getByRole('button', { name: 'Próximo modelo' }).click();
    await expect(description.getByRole('heading')).toHaveText(name);
  }
  const varejo = page.getByRole('button', { name: 'Ver modelo Varejo', exact: true });
  await varejo.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(description.getByRole('heading')).toHaveText('Essencial');
  await page.getByRole('button', { name: 'Modelo anterior' }).click();
  await expect(description.getByRole('heading')).toHaveText('Botânica');
  for (const image of await page.locator('.template-slide img').all()) {
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  await page.getByRole('button', { name: 'Pausar efeitos' }).click();
  await page.locator('#templates').screenshot({ path: '.visual-check/site-templates-desktop.png', style: '.site-header,.site-skip,.motion-toggle,.reading-progress{visibility:hidden!important}' });
  await expect(page.getByRole('link', { name: 'Criar meu checkout' })).toHaveAttribute('href', /cadastro/);
  await page.locator('#depoimentos').scrollIntoViewIfNeeded();
  await expect(page.locator('.testimonial-card')).toHaveCount(6);
  await expect(page.locator('.testimonial-disclaimer')).toContainText('Pessoas e falas fictícias');
  await page.locator('#depoimentos').screenshot({ path: '.visual-check/site-testimonials-desktop.png', style: '.site-header,.site-skip,.motion-toggle,.reading-progress{visibility:hidden!important}' });
});

test('carrossel pausa na interação e respeita o controle global', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#templates');
  await page.getByRole('button', { name: 'Reproduzir carrossel' }).click();
  const heading = page.locator('.template-description h3');
  await page.clock.runFor(5200);
  await expect(heading).toHaveText('Varejo'); // Focus remains inside the carousel.
  await page.getByRole('link', { name: 'Criar meu checkout' }).focus();
  await page.mouse.move(0, 0);
  await page.clock.runFor(5200);
  await expect(heading).toHaveText('Marketplace');
  await page.getByRole('button', { name: 'Pausar efeitos' }).click();
  await page.clock.runFor(6000);
  await expect(heading).toHaveText('Marketplace');
});

test('mobile aceita gesto horizontal e mantém depoimentos legíveis sem movimento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#templates');
  const stage = page.locator('.template-stage');
  await stage.evaluate(element => {
    const start = new Touch({ identifier: 1, target: element, clientX: 300, clientY: 350 });
    const end = new Touch({ identifier: 1, target: element, clientX: 110, clientY: 355 });
    element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }));
    element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }));
  });
  await expect(page.locator('.template-description h3')).toHaveText('Marketplace');
  await expect(page.getByRole('button', { name: 'Reproduzir carrossel' })).toBeDisabled();
  await expect(page.locator('.template-slide.is-selected')).toHaveCSS('transition-duration', '0s');
  await expect.poll(() => page.locator('.template-slide.is-selected img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.locator('#templates').screenshot({ path: '.visual-check/site-templates-mobile.png', style: '.site-header,.site-skip,.motion-toggle,.reading-progress{visibility:hidden!important}' });
  await page.locator('#depoimentos').screenshot({ path: '.visual-check/site-testimonials-mobile.png', style: '.site-header,.site-skip,.motion-toggle,.reading-progress{visibility:hidden!important}' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const card of await page.locator('.testimonial-card').all()) {
    expect((await card.boundingBox()).width).toBeGreaterThan(300);
  }
});
