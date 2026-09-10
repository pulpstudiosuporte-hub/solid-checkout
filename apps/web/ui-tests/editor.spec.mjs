import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mockAdmin } from './fixtures.mjs';
const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));
async function openEditor(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir busca avançada' }).click();
  await page.getByRole('combobox', { name: 'Buscar páginas, recursos ou ações' }).fill('Checkouts');
  await page.getByRole('option').filter({ has: page.locator('b', { hasText: /^Checkouts$/ }) }).click();
  await page.getByRole('button', { name: 'Personalizar', exact: true }).first().click();
  await expect(page.locator('.checkout-editor')).toBeVisible();
}

async function section(page, name) {
  const back = page.getByRole('button', { name: 'Todas as configurações' });
  if (await back.isVisible()) await back.click();
  await page.getByRole('navigation', { name: 'Seções de personalização' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

async function editTitle(page, title) {
  await section(page, 'Conteúdo das etapas');
  await page.getByLabel('Título', { exact: true }).fill(title);
}

async function mockWrites(page, { saveStatus = 200, publishStatus = 200, delay = 0 } = {}) {
  const calls = [];
  await page.route('**/checkouts/qa-checkout/draft', async route => {
    const { config } = route.request().postDataJSON();
    calls.push({ action: 'save', config });
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    await route.fulfill({ status: saveStatus, json: saveStatus === 200 ? { checkout: { publicId: 'qa-checkout', name: 'Checkout principal', draftConfig: config, status: 'PUBLISHED' } } : { error: { message: 'Falha simulada ao salvar' } } });
  });
  await page.route('**/checkouts/qa-checkout/publish', async route => {
    calls.push({ action: 'publish' });
    await route.fulfill({ status: publishStatus, json: publishStatus === 200 ? { checkout: { publicId: 'qa-checkout', status: 'PUBLISHED' } } : { error: { message: 'Falha simulada ao publicar' } } });
  });
  return calls;
}
test('editor: revisão de desktop e celular', async ({ page }) => {
  await mockAdmin(page);
  await openEditor(page);
  await page.screenshot({ path: output('editor-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('editor-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Prévia', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Prévia', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Personalizar', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Prévia', exact: true })).toHaveCSS('background-color', 'rgb(242, 234, 250)');
  await expect(page.getByRole('main', { name: 'Prévia do checkout' })).toBeVisible();
  await page.screenshot({ path: output('editor-mobile-preview.png'), fullPage: true });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.locator('.solid-editor').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeInViewport();
  }
  await section(page, 'Cores');
  await page.screenshot({ path: output('editor-colors.png'), fullPage: true });
});

test('editor: search, all settings and atomic template undo/redo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await mockAdmin(page); await openEditor(page);
  const search = page.getByRole('textbox', { name: 'Buscar configurações' });
  await search.fill('logo');
  await expect(page.getByRole('navigation', { name: 'Seções de personalização' }).getByRole('button')).toHaveCount(1);
  await search.fill('xyzzy');
  await expect(page.getByText('Nenhuma configuração encontrada.', { exact: false })).toBeVisible();
  await search.fill('');
  for (const name of ['Modelos', 'Aparência', 'Cores', 'Cabeçalho', 'Conteúdo das etapas', 'Elementos', 'Escassez', 'Efeitos dos botões', 'Rodapé', 'Políticas', 'Moeda e idioma', 'SEO', 'Rastreamento de saída']) {
    await section(page, name);
    await expect(page.locator('.panel-settings')).not.toBeEmpty();
    await expect(page.locator('.panel-empty')).toHaveCount(0);
  }
  await section(page, 'Modelos');
  await page.getByRole('button', { name: 'Conversão', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Conversão', exact: true })).toHaveClass('selected');
  await page.getByRole('button', { name: 'Desfazer alteração' }).click();
  await expect(page.locator('.editor-save-state')).toHaveText('Rascunho salvo');
  await page.getByRole('button', { name: 'Refazer alteração' }).click();
  await expect(page.getByRole('button', { name: 'Conversão', exact: true })).toHaveClass('selected');
  expect(errors).toEqual([]);
});

test('editor: preview preserves unsaved text, saves once and publishes in order', async ({ page }) => {
  await mockAdmin(page); const calls = await mockWrites(page, { delay: 500 }); await openEditor(page);
  await editTitle(page, 'Uma compra do seu jeito');
  await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
  await expect(page.locator('.ep-card h2')).toHaveText('Uma compra do seu jeito');
  await page.getByRole('button', { name: 'Voltar à edição' }).click();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Uma compra do seu jeito');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled();
  await expect(page.locator('.editor-toast')).toContainText('Rascunho salvo');
  expect(calls).toHaveLength(1);
  await page.getByLabel('Título', { exact: true }).fill('Pronto para publicar');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('.editor-toast')).toContainText('Checkout publicado');
  expect(calls.map(call => call.action)).toEqual(['save', 'save', 'publish']);
  expect(calls[1].config.title).toBe('Pronto para publicar');
});

test('editor: failed save preserves changes and prevents publishing', async ({ page }) => {
  await mockAdmin(page); const calls = await mockWrites(page, { saveStatus: 500 }); await openEditor(page);
  await editTitle(page, 'Não perder este texto');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Falha simulada ao salvar');
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Não perder este texto');
  await expect(page.locator('.editor-save-state')).toHaveText('Alterações não salvas');
  expect(calls.map(call => call.action)).toEqual(['save']);
});

test('editor: failed publication never displays success', async ({ page }) => {
  await mockAdmin(page); await mockWrites(page, { publishStatus: 500 }); await openEditor(page);
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Falha simulada ao publicar');
  await expect(page.locator('.editor-toast')).not.toContainText('Checkout publicado');
});

test('editor: exit guard, keyboard save and switching desktop preview to mobile', async ({ page }) => {
  await mockAdmin(page); const calls = await mockWrites(page); await openEditor(page);
  await editTitle(page, 'Rascunho protegido');
  await page.getByRole('button', { name: 'Voltar para checkouts' }).click();
  await expect(page.getByRole('dialog', { name: 'Guardar suas alterações?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Rascunho protegido');
  await page.keyboard.press('Control+s');
  await expect(page.locator('.editor-save-state')).toHaveText('Rascunho salvo');
  expect(calls).toHaveLength(1);
  await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Personalizar', exact: true }).click();
  await expect(page.getByLabel('Título', { exact: true })).toBeVisible();
  await page.getByLabel('Título', { exact: true }).fill('Salvar antes de sair');
  await page.getByRole('button', { name: 'Voltar para checkouts' }).click();
  await page.getByRole('button', { name: 'Salvar e sair', exact: true }).click();
  await expect(page.locator('.solid-editor')).toHaveCount(0);
  expect(calls[1].config.title).toBe('Salvar antes de sair');
});

test('editor: invalid hex and cancelled new element leave configuration intact', async ({ page }) => {
  await mockAdmin(page); await openEditor(page); await section(page, 'Cores');
  const hex = page.locator('.color-field input:not([type=color])').first();
  const original = await hex.inputValue();
  await hex.fill('#12'); await hex.press('Tab');
  await expect(hex).toHaveValue(original);
  await expect(page.getByRole('alert')).toContainText('A cor anterior foi mantida');
  await expect(page.locator('.editor-save-state')).toHaveText('Rascunho salvo');
  await section(page, 'Elementos');
  await page.locator('.element-row-copy').filter({ hasText: /^Texto/ }).click();
  await expect(page.locator('.element-config-sheet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Voltar aos elementos' })).toBeInViewport();
  await page.screenshot({ path: output('editor-element.png'), fullPage: true });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('.element-config-sheet')).toHaveCount(0);
  await expect(page.locator('.editor-save-state')).toHaveText('Rascunho salvo');
});

test('editor: code loads on demand and unsupported image stays local', async ({ page }) => {
  const chunks = [];
  page.on('request', request => { if (/\/assets\/CheckoutEditor-.*\.js/.test(request.url())) chunks.push(request.url()); });
  const { mutations } = await mockAdmin(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Abrir busca avançada' })).toBeVisible();
  expect(chunks).toHaveLength(0);
  await openEditor(page);
  expect(chunks).toHaveLength(1);
  await section(page, 'Cabeçalho');
  await page.getByLabel('Envie a logo da loja', { exact: true }).setInputFiles({ name: 'arquivo.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid image') });
  await expect(page.getByRole('alert')).toContainText('Use JPG, PNG ou WebP');
  expect(mutations).toEqual([]);
});
