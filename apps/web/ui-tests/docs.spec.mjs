import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
import { mockAdmin } from './fixtures.mjs';

const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));

test('contrato técnico: código copiável, mobile e link antigo', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 390, height: 950 });
  await page.goto('/#/docs/webhook-assinatura?section=node');
  const code = page.getByLabel('Verificador em Node.js', { exact: true });
  await expect(code).toContainText('timingSafeEqual');
  await page.getByRole('button', { name: 'Copiar código: Verificador em Node.js' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Código copiado' })).toBeVisible();
  // Windows clipboard normalizes line endings; the code content must stay intact.
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(await code.textContent());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: output('docs-code-mobile.png'), animations: 'disabled' });
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.map(issue => issue.id)).toEqual([]);
  await page.goto('/#/docs/criar-com-ia');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CLI conectada: trabalhe na sua IDE');
});

for (const width of [1440, 768, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`docs públicas ${width} ${theme}: leitura, navegação e contraste`, async ({ page }) => {
      const errors = [];
      const apiCalls = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/api\.(apirat\.io|solidcheckout\.xyz)|\/auth\/session/.test(request.url())) apiCalls.push(request.url()); });
      await page.addInitScript(theme => localStorage.setItem('pirat-appearance-v1', theme), theme);
      await page.setViewportSize({ width, height: 950 });
      await page.goto('/#/docs');
      await expect(page.getByRole('heading', { name: 'Construa com a Pirat. Do código à integração.' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: output(`docs-home-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
      if (width === 1440 || width === 390) {
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(audit.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) }))).toEqual([]);
      }
      if (width <= 850) {
        await page.getByRole('button', { name: 'Explorar guias' }).click();
        await page.locator('#docs-mobile-nav').getByRole('link', { name: 'Conectar sua loja Shopify', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Explorar guias' })).toHaveAttribute('aria-expanded', 'false');
      } else await page.locator('.docs-sidebar').getByRole('link', { name: 'Conectar sua loja Shopify', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Conectar sua loja Shopify', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Conectar sua loja Shopify', exact: true })).toBeFocused();
      const index = page.locator(width > 1190 ? '.docs-toc' : '.docs-inline-toc');
      await index.getByRole('link', { name: 'Código no tema e Incorporações de apps' }).click();
      const section = page.getByRole('heading', { name: 'Código no tema e Incorporações de apps' });
      await expect(section).toBeFocused();
      expect((await section.boundingBox()).y).toBeGreaterThan(75);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: output(`docs-shopify-${width}-${theme}.png`), animations: 'disabled' });
      if (width === 390) {
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(audit.violations.map(issue => issue.id)).toEqual([]);
      }
      await page.getByRole('button', { name: theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro' }).click();
      await expect(page.locator('.pirat-docs')).toHaveAttribute('data-theme', theme === 'light' ? 'dark' : 'light');
      expect(apiCalls).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test('busca, link direto, histórico, guia ausente e teclado sem login', async ({ page }) => {
  await page.goto('/#/docs');
  await page.getByRole('textbox', { name: 'Buscar na documentação' }).fill('theme.liquid');
  await expect(page.getByRole('heading', { name: 'Resultados da busca' })).toBeVisible();
  await page.locator('.docs-result-list').getByRole('link', { name: /Conectar sua loja Shopify/ }).click();
  await expect(page).toHaveURL(/#\/docs\/shopify$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Conectar sua loja Shopify', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'Se algo não funcionar' }).scrollIntoViewIfNeeded();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('textbox', { name: 'Buscar na documentação' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Buscar na documentação' }).fill('termo-inexistente-xyz');
  await expect(page.getByRole('heading', { name: 'Ainda não encontramos esse caminho.' })).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await page.locator('.docs-sidebar').getByRole('link', { name: 'Webhooks e automações' }).click();
  await expect(page.getByRole('heading', { name: 'Webhooks e automações' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Conectar sua loja Shopify', exact: true })).toBeVisible();
  await page.goto('/#/docs/guia-inexistente');
  await expect(page.getByRole('heading', { name: 'Esse guia não foi encontrado.' })).toBeVisible();
  await page.getByRole('link', { name: 'Explorar documentação' }).click();
  await page.getByRole('button', { name: /Integrações Shopify/ }).click();
  await expect(page.getByLabel('Assunto', { exact: true })).toHaveValue('integracoes');
  await expect(page.locator('.docs-result-list .docs-article-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.getByRole('heading', { name: 'Construa com a Pirat. Do código à integração.' })).toBeVisible();
});

test('atalho do painel abre docs em outra aba sem perder o painel', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Documentação', exact: true });
  await expect(link).toHaveAttribute('href', 'https://docs.apirat.io/');
  // Keep the test local while exercising the real cross-origin navigation.
  await page.context().route('https://docs.apirat.io/**', async route => {
    const url = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:4176${url.pathname}${url.search}`);
    await route.fulfill({ response });
  });
  const opened = page.waitForEvent('popup');
  await link.click();
  const docs = await opened;
  await expect(docs.getByRole('heading', { name: 'Construa com a Pirat. Do código à integração.' })).toBeVisible();
  await expect(docs).toHaveURL('https://docs.apirat.io/');
  await docs.getByRole('link', { name: 'Começar a desenvolver' }).click();
  await expect(docs.getByRole('heading', { name: 'Comece a desenvolver', exact: true })).toBeVisible();
  await docs.reload();
  await expect(docs.getByRole('heading', { name: 'Comece a desenvolver', exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/#\/docs/);
  await docs.close();
});
