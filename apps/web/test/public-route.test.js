import { describe, expect, it } from 'vitest';
import { resolvePublicRoute } from '../src/public-route';

describe('entrada pública independente do painel', () => {
  it.each(['/c/loja/oferta', '/c/loja/oferta/'])('reconhece link direto %s', pathname => {
    expect(resolvePublicRoute({ pathname, hash: '' })).toEqual({ kind: 'checkout', storeSlug: 'loja', checkoutSlug: 'oferta' });
  });
  it('preserva links antigos e sessão Shopify com token', () => {
    expect(resolvePublicRoute({ pathname: '/', hash: '#/c/loja/oferta' })?.kind).toBe('checkout');
    expect(resolvePublicRoute({ pathname: '/', hash: '#/session/session_123?token=abc' })).toEqual({ kind: 'session', sessionId: 'session_123', token: 'abc' });
  });
  it.each(['#/login', '#/redefinir-senha', '#/integrations', '#/session/short', '#/session/session_123/invalid'])('mantém %s fora do checkout público', hash => {
    expect(resolvePublicRoute({ pathname: '/', hash })).toBeNull();
  });
});
