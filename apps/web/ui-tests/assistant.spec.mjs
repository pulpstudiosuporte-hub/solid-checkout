import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mockAdmin } from './fixtures.mjs';

const launcher = page => page.getByRole('button', { name: 'Conversar com o papagaio da Pirat' });
const question = page => page.getByRole('textbox', { name: 'Sua pergunta' });
const output = name => fileURLToPath(new URL(`../../../.visual-check/assistant-${name}.png`, import.meta.url));
async function setup(page, { available = true, anonymous = false } = {}) {
  await mockAdmin(page, { anonymous });
  await page.route('**/assistant/status', route => route.fulfill({ json: { available } }));
  await page.goto('/');
}
for (const theme of ['light', 'dark']) {
  test(`conversa, poses, teclado e responsividade no tema ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await setup(page);
    const requests = [];
    let release;
    await page.route('**/assistant/messages', async route => {
      requests.push(route.request().postDataJSON());
      await new Promise(resolve => { release = resolve; });
      await route.fulfill({ json: { text: 'Bora, marujo! Abra Checkouts, revise a prévia e publique quando estiver pronto.', mood: 'happy' } });
    });
    await launcher(page).click();
    const dialog = page.getByRole('dialog', { name: 'Papagaio da Pirat' });
    await expect(dialog).toBeVisible();
    await expect(question(page)).toBeEnabled();
    await expect(page.locator('.pirat-help-character img')).toHaveAttribute('src', /greeting/);
    await page.getByRole('button', { name: 'Como publico meu checkout?' }).click();
    await expect(question(page)).toBeFocused();
    await question(page).press('Enter');
    await expect(page.locator('.pirat-help-character img')).toHaveAttribute('src', /thinking/);
    await expect(page.getByRole('button', { name: 'Enviar pergunta' })).toBeDisabled();
    await expect.poll(() => requests.length).toBe(1); release();
    await expect(page.getByRole('log')).toContainText('Bora, marujo!');
    await expect(page.locator('.pirat-help-character img')).toHaveAttribute('src', /happy/);
    expect(requests[0]).toEqual({ messages: [{ role: 'user', text: 'Como publico meu checkout?' }] });
    await page.screenshot({ path: output(`desktop-${theme}`), animations: 'disabled' });
    const scan = await new AxeBuilder({ page }).include('.pirat-help-dialog').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(scan.violations.map(item => ({ id: item.id, nodes: item.nodes.map(n => n.failureSummary) }))).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(launcher(page)).toBeFocused();
    await launcher(page).click();
    await expect(page.getByRole('log')).toContainText('Bora, marujo!');
    for (const size of [{ width: 375, height: 812 }, { width: 320, height: 640 }, { width: 812, height: 375 }]) {
      await page.setViewportSize(size);
      await expect(question(page)).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Fechar conversa' })).toBeInViewport();
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: output(`mobile-${theme}`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Nova conversa' }).click();
    await expect(page.getByRole('log')).toBeEmpty();
  });
}
test('falha preserva pergunta para repetir e fechamento cancela a resposta', async ({ page }) => {
  await setup(page);
  await page.route('**/assistant/messages', route => route.fulfill({ status: 503, json: { error: { code: 'ASSISTANT_UNAVAILABLE' } } }));
  await launcher(page).click();
  await question(page).fill('Como uso os cupons?');
  await question(page).press('Enter');
  await expect(page.getByRole('alert')).toContainText('Sua pergunta continua aqui');
  await expect(question(page)).toHaveValue('Como uso os cupons?');
  await expect(page.getByRole('log')).toBeEmpty();
  await page.unroute('**/assistant/messages');
  let release;
  await page.route('**/assistant/messages', async route => { await new Promise(resolve => { release = resolve; }); await route.fulfill({ json: { text: 'resposta atrasada', mood: 'replying' } }).catch(() => {}); });
  await question(page).press('Enter');
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.getByRole('button', { name: 'Fechar conversa' }).click(); release();
  await launcher(page).click();
  await expect(question(page)).toBeEnabled();
  await expect(question(page)).toHaveValue('Como uso os cupons?');
  await expect(page.getByRole('log')).toBeEmpty();
});
test('explica limite, demora e indisponibilidade sem perder a pergunta', async ({ page }) => {
  await setup(page);
  await launcher(page).click();
  for (const [code, text] of [['ASSISTANT_BUSY', 'atingiu o limite de uso'], ['ASSISTANT_TIMEOUT', 'demorou para responder'], ['ASSISTANT_UNAVAILABLE', 'temporariamente indisponível']]) {
    await page.route('**/assistant/messages', route => route.fulfill({ status: 503, json: { error: { code } } }));
    await question(page).fill('Coloquei o embed da Shopify. O que falta agora?');
    await question(page).press('Enter');
    await expect(page.getByRole('alert')).toContainText(text);
    await expect(question(page)).toHaveValue('Coloquei o embed da Shopify. O que falta agora?');
    await expect(page.getByRole('log')).toBeEmpty();
    await page.unroute('**/assistant/messages');
  }
});

test('não simula IA sem configuração nem aparece no login', async ({ page }) => {
  await setup(page, { available: false });
  await launcher(page).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ainda estou preparando' })).toBeVisible();
  await expect(question(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Enviar pergunta' })).toBeDisabled();
  await page.unrouteAll();
  await setup(page, { anonymous: true });
  await expect(launcher(page)).toHaveCount(0);
});
test('renderiza resposta como texto, limita histórico e limpa ao trocar conta', async ({ page }) => {
  await setup(page);
  const requests = [];
  await page.route('**/assistant/messages', route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { text: '<img src=x onerror=alert(1)> exemplo em texto', mood: 'replying' } }); });
  await launcher(page).click();
  for (let index = 0; index < 6; index++) {
    await question(page).fill(`Pergunta ${index}`);
    await question(page).press('Enter');
    await expect(question(page)).toHaveValue('');
    await expect(page.locator('.pirat-help-message.assistant')).toHaveCount(index + 1);
  }
  expect(requests.at(-1).messages).toHaveLength(9);
  await expect(page.getByRole('log').locator('img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar conversa' }).click();
  await page.route('**/auth/session', route => route.fulfill({ json: { user: { publicId: 'another', name: 'Outra conta' }, csrfToken: 'another' } }));
  await page.reload();
  await launcher(page).click();
  await expect(page.getByRole('log')).toBeEmpty();
});
