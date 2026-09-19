import { describe, expect, it } from 'vitest';
import { docsHref, resolveDocsRoute } from '../src/docs-route';
import { docsArticles, docsGroups, searchDocs } from '../src/docs-content';
import { integrations } from '../src/integration-catalog';
import { docsAliases } from '../src/docs-aliases';
import { verifyWebhookExample } from '../src/developer-docs-content';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';

describe('documentação pública', () => {
  it('abre a documentação na raiz do host próprio sem expor o painel', () => {
    expect(resolveDocsRoute({ hostname: 'docs.apirat.io', pathname: '/', hash: '' })).toEqual({ slug: '', section: '' });
    expect(resolveDocsRoute({ hostname: 'app.apirat.io', pathname: '/', hash: '' })).toBeNull();
    expect(resolveDocsRoute({ hostname: 'apirat.io', pathname: '/', hash: '' })).toBeNull();
    for (const hash of ['#/login', '#/session/session_123', '#/c/loja/oferta']) {
      expect(resolveDocsRoute({ hostname: 'docs.apirat.io', hash })?.slug).toBe('pagina-nao-encontrada');
    }
    expect(resolveDocsRoute({ hostname: 'docs.apirat.io', hash: '#/docs/shopify' })?.slug).toBe('shopify');
  });
  it('reconhece início, artigos e seções sem capturar login ou checkout', () => {
    expect(resolveDocsRoute({ hash: '#/docs' })).toEqual({ slug: '', section: '' });
    expect(resolveDocsRoute({ hash: '#/docs/shopify/' })).toEqual({ slug: 'shopify', section: '' });
    expect(resolveDocsRoute({ hash: '#/docs/webhooks?section=assinatura' })).toEqual({ slug: 'webhooks', section: 'assinatura' });
    for (const hash of ['#/login', '#/c/loja/oferta', '#/session/session_123', '#/docs-falso', '']) expect(resolveDocsRoute({ hash })).toBeNull();
    expect(docsHref('shopify', 'tema')).toBe('/#/docs/shopify?section=tema');
  });
  it('preserva links compartilháveis e referências de todos os artigos', () => {
    const slugs = docsArticles.map(article => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const article of docsArticles) {
      expect(article.slug).toMatch(/^[a-z0-9-]+$/);
      expect(docsGroups.some(group => group.id === article.group)).toBe(true);
      expect(article.related.every(slug => slugs.includes(slug))).toBe(true);
      expect(new Set(article.sections.map(section => section.id)).size).toBe(article.sections.length);
      for (const section of article.sections) expect(section.items.length).toBeGreaterThan(0);
    }
  });
  it('exige guia público para cada integração disponível', () => {
    for (const integration of integrations.filter(item => item.available)) {
      expect(docsArticles.filter(article => article.integration === integration.id)).toHaveLength(1);
    }
  });
  it('busca título e conteúdo sem distinguir acentos, com filtro por assunto', () => {
    expect(searchDocs('DOMINIO').map(article => article.slug)).toContain('dominio');
    expect(searchDocs('theme.liquid').map(article => article.slug)).toContain('shopify');
    expect(searchDocs('assinatura', 'eventos').map(article => article.slug)).toContain('webhook-assinatura');
    expect(searchDocs('assinatura', 'eventos').every(article => article.group === 'eventos')).toBe(true);
    expect(searchDocs('inexistente-xyz')).toEqual([]);
    expect(searchDocs('   ')).toHaveLength(docsArticles.length);
  });
  it('mantém foco técnico e encaminha os links anteriores a contratos existentes', () => {
    for (const [oldSlug, slug] of Object.entries(docsAliases)) {
      expect(docsArticles.some(article => article.slug === slug), oldSlug).toBe(true);
      expect(resolveDocsRoute({ hash: `#/docs/${oldSlug}` })).toEqual({ slug, section: '' });
    }
    expect(docsArticles.some(article => ['criar-com-ia', 'oferta-de-saida', 'assistente', 'publicar', 'editor'].includes(article.slug))).toBe(false);
  });
  it('o exemplo publicado verifica bytes brutos, idade e correspondência do evento', async () => {
    const { verifyPiratWebhook } = await import(`data:text/javascript;base64,${Buffer.from(verifyWebhookExample).toString('base64')}`);
    const now = 1800000000000;
    const secret = 'segredo-apenas-para-teste';
    const payload = { id: 'evt_teste', event: 'order.paid', test: false, data: { order: { status: 'PAID' } } };
    const raw = Buffer.from(JSON.stringify(payload));
    const timestamp = String(now / 1000);
    const headers = { 'x-solid-timestamp': timestamp, 'x-solid-event': 'order.paid', 'x-solid-signature': `sha256=${createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex')}` };
    expect(verifyPiratWebhook(raw, headers, secret, now)).toEqual(payload);
    expect(() => verifyPiratWebhook(Buffer.from(raw.toString().replace('PAID', 'PENDING')), headers, secret, now)).toThrow();
    expect(() => verifyPiratWebhook(raw, headers, secret, now + 301000)).toThrow();
    expect(() => verifyPiratWebhook(raw, { ...headers, 'x-solid-signature': 'sha256=00' }, secret, now)).toThrow();
    expect(() => verifyPiratWebhook(raw, { ...headers, 'x-solid-event': 'order.created' }, secret, now)).toThrow();
  });
  it('não inclui documentos internos ou artigos de operação privilegiada', () => {
    const content = JSON.stringify(docsArticles);
    expect(content).not.toMatch(/APP_ENCRYPTION_KEY|DATABASE_URL|__Host-solid|platformAdmin|impersonation|\/etc\/dokploy/);
    expect(docsArticles.some(article => /admin|operacoes|segredos/.test(article.slug))).toBe(false);
  });
});
