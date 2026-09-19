import { test, expect } from '@playwright/test';

test('papagaio reage e rolagem acompanha as etapas do checkout', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cumprimentar o papagaio' }).click();
  await expect(page.locator('.pirat-host-speech')).toContainText('Bora colocar sua marca no mapa');
  await expect(page.locator('.pirat-host img')).toHaveAttribute('src', /happy/);
  for (const index of [1, 2, 0]) {
    await page.locator(`[data-scene="${index}"]`).evaluate(element => element.scrollIntoView({ block: 'center' }));
    await expect(page.locator('.pirat-journey-tabs button').nth(index)).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('button', { name: 'Pausar efeitos' }).click();
  await expect(page.locator('.pirat-host img')).toHaveCSS('animation-name', 'none');
  await page.locator('.pirat-journey-tabs button').nth(2).click();
  await expect(page.locator('#journey-preview')).toContainText('Pagamento confirmado');
});

test('mobile e movimento reduzido permitem escolher cada cena sem rolar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const index of [1, 2, 0]) {
    const button = page.locator('.pirat-journey-tabs button').nth(index);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`[data-scene="${index}"]`)).toBeVisible();
  }
  await expect(page.locator('.pirat-host img')).toHaveCSS('animation-name', 'none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('fotografias ilustrativas e poses carregam sem imagens quebradas', async ({ page }) => {
  await page.goto('/#lojistas');
  for (const image of await page.locator('.pirat-people img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0), { timeout: 20000 }).toBe(true);
  }
  await expect(page.locator('.pirat-photo-credit')).toContainText('Fotografias:');
  await page.locator('.pirat-people').screenshot({ path: '.visual-check/site-people.png' });
});
