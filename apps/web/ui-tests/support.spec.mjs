import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const output = name => fileURLToPath(new URL(`../../../.visual-check/${name}`, import.meta.url));
const url = '/ui-tests/support-review.html#/admin/users';
for (const mode of ['Consulta', 'Manutenção']) test(`${mode}: enter customer context, enforce controls and return to admin`, async ({ page }) => {
  await page.goto(url);
  await page.getByRole('button', { name: 'Acessar suporte' }).click();
  await page.getByRole('radio', { name: new RegExp(mode) }).check();
  await page.getByLabel('Motivo do acesso').fill('Chamado 123 — revisar configuração da loja');
  await page.getByLabel('Sua senha de administrador').fill('fixture-password');
  if (mode === 'Consulta') {
    await page.screenshot({ path: output('support-dialog-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: output('support-dialog-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.getByRole('button', { name: 'Entrar na dashboard' }).click();
  await expect(page.getByLabel('Acesso de suporte ativo')).toContainText('Marina Oliveira');
  await expect(page.getByRole('button', { name: 'Equipe e permissões', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Produtos', exact: true }).click();
  const create = page.getByRole('button', { name: 'Criar produto', exact: true }).first();
  if (mode === 'Consulta') await expect(create).toBeDisabled();
  else { await expect(create).toBeEnabled(); await create.click(); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await dialog.getByLabel('Nome do produto').fill('Produto de suporte'); await dialog.getByLabel('Preço de venda').fill('49,90'); await dialog.getByRole('button', { name: 'Criar produto', exact: true }).click(); await expect(page.getByText('Produto de suporte', { exact: true })).toBeVisible(); }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output(`support-${mode === 'Consulta' ? 'read' : 'write'}-mobile.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Encerrar suporte' }).click();
  await expect(page.getByRole('heading', { name: 'Usuários da plataforma' })).toBeVisible();
  await expect(page.getByLabel('Acesso de suporte ativo')).toHaveCount(0);
});
test('create, edit and delete profiles with permission dependencies and responsive layout', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('button', { name: 'Equipe e permissões', exact: true }).click();
  await page.getByRole('button', { name: 'Novo perfil' }).click();
  await page.getByLabel('Nome do perfil').fill('Suporte avançado');
  await page.getByLabel('Descrição', { exact: true }).fill('Consulta e manutenção da dashboard.');
  await page.getByLabel('Entrar em suporte de manutenção').check();
  await expect(page.getByLabel('Entrar em suporte de consulta')).toBeChecked();
  await expect(page.getByLabel('Consultar usuários', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Suporte avançado', exact: true }) });
  await expect(card).toBeVisible();
  await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur(); });
  await expect.poll(() => page.locator('.main-shell').evaluate(e => e.getBoundingClientRect().x)).toBe(264);
  await page.screenshot({ path: output('desktop.png'), fullPage: false, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output('mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await card.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByLabel('Entrar em suporte de consulta').uncheck();
  await expect(page.getByLabel('Entrar em suporte de manutenção')).not.toBeChecked();
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  page.once('dialog', dialog => dialog.accept());
  await card.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(card).toHaveCount(0);
});
test('compliance sees consultation and audit but cannot choose maintenance or manage roles', async ({ page }) => {
  await page.goto('/ui-tests/support-review.html?staff=1#/admin/users');
  await expect(page.getByRole('button', { name: 'Equipe e permissões', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Histórico de acessos', exact: true }).click();
  await expect(page.getByText('Suporte iniciado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Usuários', exact: true }).click();
  await page.getByRole('button', { name: 'Acessar suporte' }).click();
  await expect(page.getByRole('radio', { name: /Manutenção/ })).toHaveCount(0);
});

test('assigns an existing user to a profile and removes their platform access', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('button', { name: 'Equipe e permissões', exact: true }).click();
  await page.getByLabel('Buscar conta por nome ou e-mail').fill('marina@example.com');
  await page.getByRole('button', { name: 'Buscar conta', exact: true }).click();
  await page.getByLabel('Atribuir perfil a Marina Oliveira').selectOption('technical');
  await expect(page.getByLabel('Perfil de Marina Oliveira', { exact: true })).toHaveValue('technical');
  await page.getByLabel('Perfil de Marina Oliveira', { exact: true }).selectOption('');
  await expect(page.getByLabel('Perfil de Marina Oliveira', { exact: true })).toHaveCount(0);
});
