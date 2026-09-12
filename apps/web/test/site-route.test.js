import { describe, expect, it } from 'vitest';
import { isMarketingRoute, marketingAccountUrl } from '../src/site-route';
import { resolvePublicRoute } from '../src/public-route';

describe('site institucional no domínio principal', () => {
  const location = { hostname: 'solidcheckout.xyz', pathname: '/', hash: '' };
  it.each(['solidcheckout.xyz', 'www.solidcheckout.xyz'])('abre a apresentação em %s', hostname => {
    expect(isMarketingRoute({ ...location, hostname, hash: '#recursos' })).toBe(true);
  });
  it.each(['pay.solidcheckout.xyz', 'app.solidcheckout.xyz', 'loja.example', 'localhost'])('preserva a entrada existente de %s', hostname => {
    expect(isMarketingRoute({ ...location, hostname })).toBe(false);
  });
  it.each(['#/login', '#/cadastro', '#/redefinir-senha?token=example', '#/verificar-email', '#/integrations'])('preserva a rota de conta %s', hash => {
    expect(isMarketingRoute({ ...location, hash })).toBe(false);
  });
  it('preserva links de checkout e sessões com token', () => {
    for (const address of [{ ...location, pathname: '/c/loja/oferta' }, { ...location, hash: '#/session/session_123?token=example' }]) {
      expect(isMarketingRoute(address)).toBe(false);
      expect(resolvePublicRoute(address)).not.toBeNull();
    }
  });
  it('oferece preview local sem mudar a página inicial de desenvolvimento', () => {
    expect(isMarketingRoute({ ...location, hostname: 'localhost', pathname: '/site' })).toBe(true);
  });
  it('leva visitantes do domínio principal ao painel e mantém preview local testável', () => {
    expect(marketingAccountUrl('solidcheckout.xyz', 'cadastro')).toBe('https://app.solidcheckout.xyz/#/cadastro');
    expect(marketingAccountUrl('www.solidcheckout.xyz', 'login')).toBe('https://app.solidcheckout.xyz/#/login');
    expect(marketingAccountUrl('localhost', 'login')).toBe('/#/login');
  });
});
