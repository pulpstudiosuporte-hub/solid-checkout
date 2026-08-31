import { describe, expect, it } from 'vitest';
import { gatewayAssetMap, gatewayAssetOptions, gatewayCatalog } from '../src/gateway-catalog.js';

describe('catálogo de gateways', () => {
  it('mantém apenas integrações reais como configuráveis', () => {
    expect(gatewayCatalog.filter(item => item.supported).map(item => item.id)).toEqual(['ROAS', 'WESTPAY']);
  });

  it('expõe uma chave administrativa única para cada logo', () => {
    expect(new Set(gatewayAssetOptions.map(([key]) => key)).size).toBe(gatewayCatalog.length);
    expect(gatewayAssetOptions.every(([key]) => key.startsWith('gateway-'))).toBe(true);
  });

  it('resolve a imagem cadastrada pelo administrador', () => {
    const assets = gatewayAssetMap([{ integrationKey: 'gateway-roas', imageUrl: 'https://cdn/logo.webp', altText: 'Roas' }]);
    expect(assets.get('gateway-roas')).toMatchObject({ imageUrl: 'https://cdn/logo.webp' });
  });
});
