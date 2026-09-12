import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));

test('the Pixel can be saved with just its ID and server events are optional', async ({ page }) => {
  await page.goto('/ui-tests/meta-review.html');
  await page.getByLabel('ID do Pixel').fill('123456789012345');
  await expect(page.getByLabel('Token da API de Conversões')).toHaveCount(0);
  await expect(page.getByText('Código de Eventos de teste')).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvar Pixel' }).click();
  await expect(page.getByRole('status')).toContainText('Pixel salvo');
  await page.screenshot({ path: output('desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('checkbox').check();
  await page.getByLabel('Token da API de Conversões').fill('local-test-token-not-a-real-secret');
  await page.getByRole('button', { name: 'Salvar Pixel' }).click();
  await expect(page.getByRole('status')).toContainText('token também foi salvo');
  await expect(page.getByLabel('Token da API de Conversões')).toHaveValue('');
});

test('checkout loads the SDK under CSP and sends each stage to the configured Pixel', async ({ page }) => {
  const events = [];
  await page.route('https://www.facebook.com/tr**', async route => { events.push(new URL(route.request().url())); await route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') }); });
  await page.route('https://connect.facebook.net/**', async route => {
    await route.fulfill({ contentType: 'application/javascript', body: `const pixelQueue = window.fbq.queue.slice(); window.fbq.callMethod = function (...args) { if (args[0] === 'trackSingle') { const beacon = new Image(); beacon.src = 'https://www.facebook.com/tr?id=' + args[1] + '&ev=' + args[2] + '&eid=' + encodeURIComponent(args[4]?.eventID || '') + '&value=' + (args[3]?.value || 0); } }; pixelQueue.forEach(args => window.fbq.callMethod(...args));` });
  });
  const violations = [];
  page.on('console', message => { if (message.text().includes('Content Security Policy') && message.text().includes('facebook')) violations.push(message.text()); });
  await page.goto('/ui-tests/meta-review.html?checkout');
  await expect.poll(() => events.map(url => url.searchParams.get('ev'))).toEqual(['PageView', 'ViewContent', 'InitiateCheckout']);
  expect(events.every(url => url.searchParams.get('id') === '123456789012345')).toBe(true);
  expect(events.some(url => url.searchParams.get('ev') === 'Purchase')).toBe(false);
  await page.getByLabel('Nome completo').fill('Comprador de teste');
  await page.getByLabel('E-mail', { exact: true }).fill('buyer@example.com');
  await page.getByLabel('Celular / WhatsApp').fill('11987654321');
  await page.getByRole('button', { name: 'Continuar para entrega' }).click();
  await page.getByLabel('CPF do pagador', { exact: true }).fill('52998224725');
  await page.getByRole('button', { name: 'Gerar Pix', exact: true }).click();
  await expect.poll(() => events.filter(url => url.searchParams.get('ev') === 'AddPaymentInfo').length).toBe(1);
  expect(events.some(url => url.searchParams.get('ev') === 'Purchase')).toBe(false);
  await page.getByRole('button', { name: 'Confirmar pagamento simulado' }).click();
  await expect.poll(() => events.filter(url => url.searchParams.get('ev') === 'Purchase').length, { timeout: 15000 }).toBe(1);
  const purchase = events.find(url => url.searchParams.get('ev') === 'Purchase');
  expect(purchase.searchParams.get('eid')).toBe('meta-session:Purchase');
  expect(purchase.searchParams.get('value')).toBe('149');
  await page.reload();
  await expect.poll(() => events.filter(url => url.searchParams.get('ev') === 'PageView').length).toBe(2);
  expect(events.filter(url => url.searchParams.get('ev') === 'InitiateCheckout')).toHaveLength(1);
  expect(violations).toEqual([]);
});

test('all checkout deployment policies permit the official SDK and event endpoint', () => {
  for (const name of ['apps/web/index.html', 'apps/web/vite.config.ts', 'deploy/nginx-web.conf']) {
    const source = readFileSync(new URL('../../../' + name, import.meta.url), 'utf8');
    const script = source.match(/script-src[^;"\n]+/)[0];
    const connect = source.match(/connect-src[^;"\n]+/)[0];
    expect(script).toContain('https://connect.facebook.net');
    expect(connect).toContain('https://www.facebook.com');
    expect(connect).toContain('https://connect.facebook.net');
  }
});
