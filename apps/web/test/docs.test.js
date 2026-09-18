import { describe, expect, it } from 'vitest';
import { docsHref, resolveDocsRoute } from '../src/docs-route';
import { docsArticles, docsGroups, searchDocs } from '../src/docs-content';
import { integrations } from '../src/integration-catalog';

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
    expect(searchDocs('cupom', 'checkout').map(article => article.slug)).toContain('oferta-de-saida');
    expect(searchDocs('cupom', 'checkout').every(article => article.group === 'checkout')).toBe(true);
    expect(searchDocs('inexistente-xyz')).toEqual([]);
    expect(searchDocs('   ')).toHaveLength(docsArticles.length);
  });
  it('não inclui documentos internos ou artigos de operação privilegiada', () => {
    const content = JSON.stringify(docsArticles);
    expect(content).not.toMatch(/APP_ENCRYPTION_KEY|DATABASE_URL|__Host-solid|platformAdmin|impersonation|\/etc\/dokploy/);
    expect(docsArticles.some(article => /admin|operacoes|segredos/.test(article.slug))).toBe(false);
  });
});
