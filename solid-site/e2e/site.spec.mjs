import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const output = name => fileURLToPath(new URL(`../.visual-check/${name}`, import.meta.url));

test('demonstração funciona sem carregar painel ou criar uma cobrança', async ({ page }) => {
  const requests = [];
  const failures = [];
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('checkout à altura');
  await expect(page.locator('.demo-total')).toContainText('149,00');
  await page.getByRole('checkbox', { name: 'Adicionar ecobag por 29 reais' }).check();
  await expect(page.locator('.demo-total')).toContainText('178,00');
  await page.getByRole('button', { name: 'Azul', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Azul', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Continuar com este pedido' }).click();
  await page.getByRole('button', { name: 'Continuar para entrega' }).click();
  await page.getByRole('button', { name: 'Revisar pedido' }).click();
  await page.getByRole('button', { name: 'Experimentar pagamento' }).click();
  await expect(page.locator('.demo-pix')).toContainText('178,00');
  await page.getByRole('button', { name: 'Simular pagamento aprovado' }).click();
  await expect(page.locator('.demo-success')).toContainText('178,00');
  await page.getByRole('button', { name: 'Experimentar de novo' }).click();
  await expect(page.getByRole('checkbox', { name: 'Adicionar ecobag por 29 reais' })).toBeChecked();
  expect(requests.some(request => /AdminApp|PublicApp/.test(request.url))).toBe(false);
  expect(requests.some(request => request.method === 'POST' && /payment|pix|checkout-session/.test(request.url))).toBe(false);
  expect(failures).toEqual([]);
});

test('abas, perguntas e navegação funcionam com teclado', async ({ page }) => {
  await page.goto('/');
  const tab = page.getByRole('button', { name: 'Sua marca', exact: true });
  await tab.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#feature-detail')).toContainText('A identidade também');
  await page.getByRole('button', { name: 'Ofertas', exact: true }).click();
  await expect(page.locator('#feature-detail')).toContainText('order bumps');
  await page.getByRole('button', { name: 'Gestão', exact: true }).click();
  await expect(page.locator('#feature-detail')).toContainText('Menos abas');
  await page.getByText('Preciso usar Shopify?', { exact: true }).click();
  await expect(page.locator('details').filter({ hasText: 'Preciso usar Shopify?' })).toHaveAttribute('open', '');
  await expect(page.getByRole('link', { name: 'Criar minha conta' })).toHaveAttribute('href', 'https://app.solidcheckout.xyz/#/cadastro');
  await expect(page.getByRole('link', { name: 'Entrar', exact: true }).first()).toHaveAttribute('href', 'https://app.solidcheckout.xyz/#/login');
});

test('pedido calcula quantidade, cupom, frete e preserva escolhas ao voltar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Diminuir quantidade' })).toBeDisabled();
  await page.getByRole('button', { name: 'Aumentar quantidade' }).click();
  await page.getByRole('checkbox', { name: 'Adicionar ecobag por 29 reais' }).check();
  await page.getByText('Tenho um cupom de desconto', { exact: true }).click();
  await page.getByLabel('Teste o cupom BEMVINDO').fill('INVALIDO');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.locator('.demo-coupon')).toContainText('Cupom não encontrado');
  await page.getByLabel('Teste o cupom BEMVINDO').fill(' bemvindo ');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.locator('.demo-total')).toContainText('294,30');
  await page.getByRole('button', { name: 'Continuar com este pedido' }).click();
  await page.getByLabel('Nome de exemplo', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Continuar para entrega' }).click();
  await expect(page.getByRole('heading', { name: 'Quem recebe o pedido?' })).toBeVisible();
  await page.getByLabel('Nome de exemplo', { exact: true }).fill('Cliente Teste');
  await page.getByLabel('E-mail de exemplo', { exact: true }).fill('email-invalido');
  await page.getByRole('button', { name: 'Continuar para entrega' }).click();
  await expect(page.getByLabel('E-mail de exemplo', { exact: true })).toBeFocused();
  await page.getByLabel('E-mail de exemplo', { exact: true }).fill('cliente@example.com');
  await page.getByRole('button', { name: 'Continuar para entrega' }).click();
  await page.getByRole('radio', { name: /Entrega expressa/ }).check();
  await expect(page.locator('.demo-total')).toContainText('314,20');
  await page.getByRole('button', { name: 'Revisar pedido' }).click();
  await expect(page.locator('.demo-review').first()).toContainText('Cliente Teste');
  await page.getByRole('button', { name: 'Editar dados' }).click();
  await expect(page.getByLabel('Nome de exemplo', { exact: true })).toHaveValue('Cliente Teste');
  await page.getByRole('button', { name: 'Continuar para entrega' }).click();
  await expect(page.getByRole('radio', { name: /Entrega expressa/ })).toBeChecked();
  await page.getByRole('button', { name: 'Revisar pedido' }).click();
  await page.getByRole('button', { name: 'Experimentar pagamento' }).click();
  await page.getByRole('button', { name: 'Cancelar simulação e revisar' }).click();
  await expect(page.locator('.demo-total')).toContainText('314,20');
  await page.getByRole('button', { name: 'Experimentar pagamento' }).click();
  await page.getByRole('button', { name: 'Simular pagamento aprovado' }).click();
  await expect(page.locator('.demo-success')).toContainText('314,20');
  await page.getByRole('button', { name: 'Limpar escolhas e recomeçar' }).click();
  await expect(page.locator('.demo-total')).toContainText('149,00');
  await expect(page.getByRole('checkbox', { name: 'Adicionar ecobag por 29 reais' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Diminuir quantidade' })).toBeDisabled();
});

test('limites de quantidade, remoção de cupom e cópia com permissão negada', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } }));
  await page.goto('/');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Aumentar quantidade' }).click();
  await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled();
  await expect(page.locator('.demo-total')).toContainText('745,00');
  await page.getByText('Tenho um cupom de desconto', { exact: true }).click();
  await page.getByLabel('Teste o cupom BEMVINDO').fill('BEMVINDO');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.locator('.demo-total')).toContainText('670,50');
  await page.getByRole('button', { name: 'Remover cupom' }).click();
  await expect(page.locator('.demo-total')).toContainText('745,00');
  await page.getByRole('button', { name: 'Continuar com este pedido' }).click();
  await page.getByRole('button', { name: 'Continuar para entrega' }).click();
  await page.getByRole('button', { name: 'Revisar pedido' }).click();
  await page.getByRole('button', { name: 'Experimentar pagamento' }).click();
  await page.getByRole('button', { name: 'Copiar texto de exemplo' }).click();
  await expect(page.locator('.demo-pix')).toContainText('Não foi possível copiar');
  await expect(page.locator('.demo-pix code')).toContainText('SEM-VALOR-DE-PAGAMENTO');
});

test('editor, ofertas e período de gestão respondem aos controles', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sua marca', exact: true }).click();
  await page.getByLabel('Nome da sua marca').fill('Minha Loja');
  await page.getByRole('button', { name: 'Editor Verde' }).click();
  await expect(page.locator('.brand-preview')).toContainText('Minha Loja');
  await expect(page.locator('.brand-preview')).toHaveClass(/green/);
  await page.getByRole('button', { name: 'Ofertas', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Incluir ecobag' }).uncheck();
  await expect(page.locator('.sandbox-metrics')).toContainText('149,00');
  await page.getByRole('button', { name: 'Gestão', exact: true }).click();
  await page.getByLabel('Período do exemplo').selectOption('30');
  await expect(page.locator('.sandbox-metrics')).toContainText('48');
  await page.getByRole('button', { name: 'Sua marca', exact: true }).click();
  await expect(page.getByLabel('Nome da sua marca')).toHaveValue('Minha Loja');
  await page.getByRole('button', { name: 'Checkout', exact: true }).click();
  await page.getByRole('group', { name: 'Conhecer as etapas' }).getByRole('button', { name: 'Entrega' }).click();
  await expect(page.locator('.feature-sandbox')).toContainText('Preço e prazo aparecem antes');
});

test('guia mantém checklist entre etapas, conclui e reinicia', async ({ page }) => {
  await page.goto('/');
  const guide = page.locator('.setup-guide');
  for (let step = 0; step < 4; step++) {
    const checks = guide.getByRole('checkbox');
    for (let i = 0; i < 3; i++) await checks.nth(i).check();
    if (step < 3) await guide.getByRole('button', { name: 'Próxima etapa' }).click();
  }
  await expect(guide.getByRole('status')).toContainText('12 de 12');
  await expect(guide.getByRole('link', { name: 'Ir para o cadastro' })).toHaveAttribute('href', 'https://app.solidcheckout.xyz/#/cadastro');
  await guide.getByRole('button', { name: /Prepare sua loja/ }).click();
  await expect(guide.getByRole('checkbox').first()).toBeChecked();
  await guide.getByRole('button', { name: 'Limpar lista' }).click();
  await expect(guide.getByRole('status')).toContainText('0 de 12');
  await expect(guide.getByRole('checkbox').first()).not.toBeChecked();
});

test('integrações mostram orientações e FAQ filtra, expande e limpa resultados', async ({ page }) => {
  await page.goto('/');
  for (const name of ['Shopify', 'UTMify', 'Meta', 'Roas · WestPay', 'Webhooks']) {
    await page.locator('.integration-network').getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.locator('#integration-detail').getByRole('heading')).toHaveText(name);
    await expect(page.locator('#integration-detail li')).toHaveCount(3);
  }
  await page.getByLabel('Busque sua dúvida').fill('dominio');
  await expect(page.locator('.faq-list details')).toHaveCount(1);
  await page.getByRole('button', { name: 'Expandir respostas' }).click();
  await expect(page.locator('.faq-list details')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Recolher respostas' }).click();
  await expect(page.locator('.faq-list details')).not.toHaveAttribute('open');
  await page.getByLabel('Busque sua dúvida').fill('xxxxxxxx');
  await expect(page.getByText('Nenhuma resposta para', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(page.locator('.faq-list details')).toHaveCount(9);
});

test('mobile permite concluir a demonstração e acessar o painel pelo menu', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Acessar painel' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Continuar com este pedido' }).click();
  await page.getByRole('button', { name: 'Continuar para entrega' }).click();
  await page.getByRole('radio', { name: /Entrega expressa/ }).check();
  await page.getByRole('button', { name: 'Revisar pedido' }).click();
  await page.locator('.site-demo').screenshot({ path: output('site-mobile-demo-review.png') });
  await page.getByRole('button', { name: 'Experimentar pagamento' }).click();
  await page.getByRole('button', { name: 'Simular pagamento aprovado' }).click();
  await expect(page.locator('.demo-success')).toContainText('168,90');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('captura desktop e seções completas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Pausar efeitos' }).click();
  await page.screenshot({ path: output('site-desktop.png'), fullPage: true });
  await page.locator('#em-movimento').screenshot({ path: output('site-graficos.png'), style: '.site-header,.site-skip,.motion-toggle,.reading-progress{visibility:hidden!important}' });
  await page.locator('#recursos').screenshot({ path: output('site-recursos.png') });
  await page.locator('#integracoes').screenshot({ path: output('site-integracoes.png') });
  await page.locator('#duvidas').screenshot({ path: output('site-duvidas.png') });
});

test('mobile real não transborda e permite usar o menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Pausar efeitos' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: output('site-mobile.png'), fullPage: true });
  await page.screenshot({ path: output('site-mobile-topo.png') });
  await page.locator('#em-movimento').screenshot({ path: output('site-mobile-graficos.png'), style: '.site-header,.site-skip,.motion-toggle,.reading-progress{visibility:hidden!important}' });
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Recursos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(/#recursos$/);
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
});

test('gráfico se atualiza, pausa durante exploração e respeita pausa global', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('.motion-dashboard');
  await panel.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  const revision = await panel.getAttribute('data-revision');
  await expect.poll(() => panel.getAttribute('data-revision'), { timeout: 7000 }).not.toBe(revision);
  const curve = await page.locator('.chart-line').last().getAttribute('d');
  await page.getByRole('button', { name: 'Pausar efeitos' }).click();
  const pausedRevision = await panel.getAttribute('data-revision');
  await page.waitForTimeout(3300);
  await expect(panel).toHaveAttribute('data-revision', pausedRevision);
  await page.getByRole('button', { name: 'Simular nova venda' }).click();
  await expect(page.locator('.dashboard-footnote')).toContainText('Pedido fictício adicionado');
  await expect(page.locator('.chart-line').last()).not.toHaveAttribute('d', curve);
  await page.getByRole('group', { name: 'Métrica do gráfico' }).getByRole('button', { name: 'Pedidos' }).click();
  await expect(page.locator('.chart-readout')).toContainText('pedidos');
  await page.getByRole('button', { name: '30 dias', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Explorar pontos do gráfico' }).getByRole('button')).toHaveCount(10);
  const firstPoint = page.getByRole('group', { name: 'Explorar pontos do gráfico' }).getByRole('button').first();
  await firstPoint.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.chart-readout')).toContainText('Dias 1–3');
  await page.getByText('Ver os dados do gráfico em tabela', { exact: true }).click();
  await expect(page.locator('.chart-data tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Ativar efeitos' }).click();
  await expect(page.locator('.chart-bottom')).toContainText('Pausado para explorar');
  const tableRevision = await panel.getAttribute('data-revision');
  await page.waitForTimeout(3300);
  await expect(panel).toHaveAttribute('data-revision', tableRevision);
});

test('movimento reduzido desliga animações e mantém os gráficos interativos', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Movimento reduzido' })).toBeDisabled();
  await expect(page.locator('.motion-scene')).toHaveAttribute('data-motion', 'paused');
  await expect(page.locator('.aurora-one')).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Simular nova venda' }).click();
  await expect(page.locator('.dashboard-footnote')).toContainText('Pedido fictício adicionado');
  await page.getByRole('button', { name: '30 dias', exact: true }).click();
  await expect(page.getByRole('button', { name: '30 dias', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('animações e brilho respondem ao cursor sem cobrir controles', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.aurora-one')).toHaveCSS('animation-name', 'aurora-drift');
  const card = page.locator('.foundation-card').first();
  await card.hover();
  await expect.poll(() => card.evaluate(element => element.style.getPropertyValue('--spot-opacity'))).toBe('1');
  await expect.poll(() => card.evaluate(element => getComputedStyle(element).transform)).toContain('matrix3d');
  await card.locator('summary').click();
  await expect(card.locator('details')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Pausar efeitos' }).click();
  await expect(page.locator('.aurora-one')).toHaveCSS('animation-name', 'none');
  await expect(card).toHaveCSS('transform', 'none');
});

test('layout estreito e movimento reduzido continuam utilizáveis', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
