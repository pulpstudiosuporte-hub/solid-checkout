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
for (const theme of ['light', 'dark']) {
  test(`cria prévia, ajusta e salva somente rascunho no tema ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await open(page);
    const requests = [];
    await page.route('**/checkouts/ai/preview', route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { config: { ...design, testimonials: requests.at(-1).testimonials.map((item, index) => ({ ...item, id: `real-${index}`, imageUrl: '' })), showTrust: requests.at(-1).testimonials.length > 0 } } }); });
    await page.getByLabel('Tipo de checkout').selectOption('DIRECT_LINK');
    await page.getByRole('combobox', { name: 'Produto', exact: true }).selectOption('qa-product-1');
    await page.getByLabel('Como você imagina o checkout?').fill('Uma loja de acessórios clara, com detalhes vermelhos.');
    await page.getByLabel('Referência visual opcional').setInputFiles(image);
    await expect(page.getByAltText('Referência temporária do visual')).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar depoimento' }).click();
    await page.getByLabel('Nome do cliente 1').fill('Cliente de teste');
    await page.getByLabel('Avaliação real').fill('Avaliação fictícia usada somente no teste.');
    await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Seu checkout tomou forma.' })).toBeVisible();
    expect(requests[0].reference).toContain('data:image/png');
    expect(requests[0].productId).toBe('qa-product-1');
    await page.getByLabel('O que quer ajustar?').fill('Deixe o título mais direto.');
    await page.getByRole('button', { name: 'Ajustar com IA' }).click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].current.logoText).toBe('Aurora');
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
    await page.getByRole('button', { name: 'Salvar rascunho e abrir editor' }).click();
    await expect.poll(() => Boolean(saved)).toBe(true);
    expect(saved.draftConfig.logoText).toBe('Aurora');
    expect(JSON.stringify(saved)).not.toContain('data:image');
    expect(saved).not.toHaveProperty('publishedConfig');
    await expect(page.getByRole('button', { name: /Salvar rascunho/ })).toBeVisible();
  });
}
test('erro preserva ideia e referência; sair descarta a imagem; cancelar não aplica resultado atrasado', async ({ page }) => {
  await open(page);
  await page.getByLabel('Como você imagina o checkout?').fill('Minha ideia de checkout');
  await page.getByLabel('Referência visual opcional').setInputFiles(image);
  await page.route('**/checkouts/ai/preview', route => route.fulfill({ status: 503, json: { error: { message: 'IA temporariamente indisponível' } } }));
  await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('indisponível');
  await expect(page.getByLabel('Como você imagina o checkout?')).toHaveValue('Minha ideia de checkout');
  await expect(page.getByAltText('Referência temporária do visual')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar aos checkouts' }).click();
  await page.getByRole('button', { name: 'Criar com IA', exact: true }).click();
  await expect(page.getByAltText('Referência temporária do visual')).toHaveCount(0);
  await expect(page.getByLabel('Como você imagina o checkout?')).toHaveValue('');
  let release;
  await page.route('**/checkouts/ai/preview', async route => { await new Promise(resolve => { release = resolve; }); await route.fulfill({ json: { config: design } }).catch(() => {}); });
  await page.getByLabel('Como você imagina o checkout?').fill('Novo teste');
  await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.getByRole('button', { name: 'Cancelar geração' }).click(); release();
  await expect(page.getByRole('heading', { name: 'Um bom checkout começa aqui.' })).toBeVisible();
});
