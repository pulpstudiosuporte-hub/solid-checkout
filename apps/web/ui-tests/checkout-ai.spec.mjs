import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
import { mockAdmin } from './fixtures.mjs';

const design = { primary: '#b51b22', pageBg: '#fffaf1', cardBg: '#ffffff', headerBg: '#ffffff', textColor: '#241416', pageTextColor: '#241416', headerTextColor: '#241416', buttonTextColor: '#ffffff', borderColor: '#ddd4ce', inputBg: '#ffffff', logoText: 'Aurora', title: 'Finalize seu pedido', subtitle: 'Confira seus dados para continuar.', buttonText: 'Gerar Pix', eyebrow: 'SEU PEDIDO', summaryTitle: 'Resumo', template: 'minimal', layout: 'split', font: 'Inter', radius: 12, progressActiveColor: '#b51b22', progressActiveTextColor: '#ffffff', progressActiveLabelColor: '#241416', showBump: false, showTrust: false, testimonials: [], timer: false, socialProofEnabled: false, customElements: [] };
const image = { name: 'reference.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1cAAAAASUVORK5CYII=', 'base64') };

async function open(page) {
  await mockAdmin(page); await page.goto('/');
  await page.getByRole('button', { name: 'Abrir busca avançada' }).click();
  await page.getByRole('combobox', { name: 'Buscar páginas, recursos ou ações' }).fill('Checkouts');
  await page.getByRole('option').filter({ has: page.locator('b', { hasText: /^Checkouts$/ }) }).click();
  await page.getByRole('button', { name: 'Criar com IA', exact: true }).click();
}
test.setTimeout(120000);
const send = page => page.getByRole('button', { name: 'Enviar resposta', exact: true }).click();
async function brief(page, { reference = false, direct = false, review = false, assets = false, retail = false } = {}) {
  await page.getByRole('textbox', { name: 'Nome da marca', exact: true }).fill('Aurora'); await send(page);
  await page.getByRole('textbox', { name: 'Sua ideia', exact: true }).fill('Uma loja de acessórios clara, com detalhes vermelhos.'); await send(page);
  await page.getByRole('textbox', { name: 'Cores da marca', exact: true }).fill('Vermelho e marfim'); await send(page);
  if (direct) await page.getByRole('button', { name: /Produto específico Um link/ }).click();
  await send(page);
  if (direct) { await page.getByRole('combobox', { name: 'Produto', exact: true }).selectOption('qa-product-1'); await send(page); }
  if (retail) await page.getByRole('button', { name: /Varejo · três colunas/ }).click();
  await send(page);
  if (reference) { await page.getByLabel('Referência visual opcional').setInputFiles(image); await expect(page.getByAltText('Referência temporária do visual')).toBeVisible(); }
  await send(page);
  if (assets) { await page.getByRole('button', { name: 'Enviar minha logo', exact: true }).click(); await page.locator('input[type=file]').setInputFiles(image); await expect(page.getByAltText('Logo da marca', { exact: true })).toBeVisible(); }
  await send(page);
  if (assets) { await page.getByRole('button', { name: 'Quero enviar um banner', exact: true }).click(); await page.getByLabel('Banner principal', { exact: true }).setInputFiles(image); await expect(page.getByAltText('Banner principal', { exact: true })).toBeVisible(); }
  await send(page); // banner
  await send(page); // summary image
  if (!retail) await send(page); // layout
  await send(page); // progress
  await send(page); // coupon
  await send(page); // summary
  if (review) await page.getByRole('button', { name: 'Sim, ativar avisos' }).click();
  await send(page);
  if (review) {
    await page.getByRole('button', { name: 'Adicionar depoimento' }).click();
    await page.getByLabel('Nome do cliente 1').fill('Cliente de teste');
    await page.getByLabel('Avaliação real 1').fill('Avaliação fictícia usada somente no teste.');
  }
  await send(page);
  await page.getByRole('textbox', { name: 'Nome do checkout', exact: true }).fill('Checkout Aurora'); await send(page);
  await expect(page.getByRole('button', { name: 'Gerar prévia', exact: true })).toBeVisible();
}
for (const theme of ['light', 'dark']) {
  test(`conversa acessível, revisável e responsiva no tema ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' }); await open(page);
    await expect(page.getByRole('textbox', { name: 'Nome da marca', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Cores da marca', exact: true })).toHaveCount(0);
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: fileURLToPath(new URL(`../../../.visual-check/ai-conversation-${theme}-${width}.png`, import.meta.url)), fullPage: true });
    }
    const scan = await new AxeBuilder({ page }).include('.checkout-ai').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(scan.violations.map(item => item.id)).toEqual([]);
    await send(page); await expect(page.getByRole('alert')).toContainText('nome da marca');
    await page.getByRole('textbox', { name: 'Nome da marca', exact: true }).fill('Aurora'); await page.getByRole('textbox', { name: 'Nome da marca', exact: true }).press('Enter');
    await expect(page.getByRole('textbox', { name: 'Sua ideia', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Sua ideia', exact: true }).fill('Loja minimalista'); await page.getByRole('textbox', { name: 'Sua ideia', exact: true }).press('Enter');
    await expect(page.getByRole('textbox', { name: 'Cores da marca', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Alterar resposta: Aurora', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Nome da marca', exact: true })).toHaveValue('Aurora');
    await page.getByRole('textbox', { name: 'Nome da marca', exact: true }).fill('Aurora Nova'); await send(page);
    await expect(page.getByRole('textbox', { name: 'Cores da marca', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Conversa de criação' })).toContainText('Loja minimalista');
  });
  test(`cria prévia, ajusta e salva somente rascunho no tema ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' }); await open(page);
    const requests = [];
    await page.route('**/checkouts/ai/preview', route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { config: { ...design, testimonials: requests.at(-1).testimonials.map((item, index) => ({ ...item, id: `real-${index}`, imageUrl: '' })), showTrust: requests.at(-1).testimonials.length > 0 } } }); });
    await brief(page, { reference: true, direct: true, review: true });
    await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Seu checkout tomou forma.' })).toBeVisible();
    expect(requests[0].reference).toContain('data:image/png'); expect(requests[0].productId).toBe('qa-product-1');
    expect(requests[0].brief.brand).toBe('Aurora'); expect(requests[0].brief.socialProofEnabled).toBe(true); expect(requests[0].prompt).toContain('Vermelho e marfim');
    await page.getByLabel('O que quer ajustar?').fill('Deixe o título mais direto.');
    await expect(page.getByRole('button', { name: 'Salvar rascunho e abrir editor' })).toBeDisabled();
    await page.getByRole('button', { name: 'Enviar ajuste' }).click();
    await expect.poll(() => requests.length).toBe(2); expect(requests[1].current.logoText).toBe('Aurora'); expect(requests[1].prompt).toContain('Deixe o título mais direto.');
    await expect(page.getByRole('button', { name: 'Salvar rascunho e abrir editor' })).toBeEnabled();
    await expect(page.getByRole('region', { name: 'Conversa de criação' })).toContainText('Deixe o título mais direto.');
    await page.getByRole('button', { name: 'Alterar resposta: Aurora', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome da marca', exact: true }).fill('Aurora Nova'); await send(page);
    await expect(page.getByRole('button', { name: 'Salvar rascunho e abrir editor' })).toBeDisabled();
    await page.getByRole('button', { name: 'Enviar ajuste' }).click(); await expect.poll(() => requests.length).toBe(3);
    expect(requests[2].brief.brand).toBe('Aurora Nova');
    await expect(page.getByRole('button', { name: 'Salvar rascunho e abrir editor' })).toBeEnabled();
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: fileURLToPath(new URL(`../../../.visual-check/checkout-ai-desktop-${theme}.png`, import.meta.url)), fullPage: true });
    const scan = await new AxeBuilder({ page }).include('.checkout-ai').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(scan.violations.map(item => ({ id: item.id, nodes: item.nodes.map(n => n.failureSummary) }))).toEqual([]);
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.locator('.checkout-ai-preview').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.locator('.checkout-ai').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: fileURLToPath(new URL(`../../../.visual-check/checkout-ai-mobile-${theme}.png`, import.meta.url)), fullPage: true });
    let saved;
    await page.route('**/checkouts', route => { saved = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { checkout: { ...saved, publicId: 'new-ai', status: 'DRAFT' } } }); });
    await page.getByRole('button', { name: 'Salvar rascunho e abrir editor' }).click(); await expect.poll(() => Boolean(saved)).toBe(true);
    expect(saved.draftConfig.logoText).toBe('Aurora'); expect(JSON.stringify(saved)).not.toContain('data:image'); expect(saved).not.toHaveProperty('publishedConfig');
  });
}
test('erro preserva conversa e referência; sair descarta imagem; cancelar ignora resultado atrasado', async ({ page }) => {
  await open(page); await brief(page, { reference: true });
  await page.route('**/checkouts/ai/preview', route => route.fulfill({ status: 503, json: { error: { message: 'IA temporariamente indisponível' } } }));
  await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('indisponível');
  await page.getByRole('button', { name: /Alterar resposta: reference.png/ }).click();
  await expect(page.getByAltText('Referência temporária do visual')).toBeVisible(); await send(page);
  await page.getByRole('button', { name: 'Voltar aos checkouts' }).click(); await page.getByRole('button', { name: 'Criar com IA', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Nome da marca', exact: true })).toHaveValue('');
  let release;
  await page.route('**/checkouts/ai/preview', async route => { await new Promise(resolve => { release = resolve; }); await route.fulfill({ json: { config: design } }).catch(() => {}); });
  await brief(page); await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click(); await expect.poll(() => Boolean(release)).toBe(true);
  await page.getByRole('button', { name: 'Cancelar geração' }).click(); release();
  await expect(page.getByRole('heading', { name: 'Um bom checkout começa aqui.' })).toBeVisible();
});
test('preserva uploads permanentes, modelo estrutural e perguntas condicionais', async ({ page }) => {
  await open(page);
  let request;
  await page.route('**/media/images', route => route.fulfill({ json: { imageUrl: '/brand/assistant/idle.webp' } }));
  await page.route('**/checkouts/ai/preview', route => { request = route.request().postDataJSON(); return route.fulfill({ json: { config: design } }); });
  await brief(page, { assets: true, retail: true });
  await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click(); await expect.poll(() => Boolean(request)).toBe(true);
  expect(request.brief.logoUrl).toBe('/brand/assistant/idle.webp'); expect(request.brief.heroImageUrl).toBe('/brand/assistant/idle.webp'); expect(request.brief.template).toBe('retail'); expect(request).not.toHaveProperty('productId');
  await page.getByRole('button', { name: 'Alterar resposta: Carrinho da Shopify', exact: true }).click();
  await page.getByRole('button', { name: /Produto específico Um link/ }).click(); await send(page);
  await expect(page.getByRole('combobox', { name: 'Produto', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Produto', exact: true }).selectOption('qa-product-2'); await send(page);
  await expect(page.getByRole('button', { name: 'Gerar prévia', exact: true })).toBeVisible();
  request = null; await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click(); await expect.poll(() => Boolean(request)).toBe(true);
  expect(request.productId).toBe('qa-product-2'); expect(request.brief.logoUrl).toBe('/brand/assistant/idle.webp');
});
