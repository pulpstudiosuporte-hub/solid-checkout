import { describe, expect, it } from 'vitest';
import { anonymizeSocialProofLocation, anonymizeSocialProofName, sanitizeSocialProofProduct } from '../src/social-proof-privacy.js';

describe('privacidade da prova social', () => {
  it('não expõe o nome completo nem a cidade do comprador', () => {
    expect(anonymizeSocialProofName('Maria da Silva')).toBe('M***');
    expect(anonymizeSocialProofLocation(
      { city: 'São Paulo', state: 'SP' },
      { geo_city: 'São Paulo', geo_region: 'SP', geo_country: 'BR' },
    )).toBe('SP');
  });

  it('remove controles e limita o texto público do produto', () => {
    expect(sanitizeSocialProofProduct(`Produto\n${'x'.repeat(200)}`)).toHaveLength(120);
    expect(sanitizeSocialProofProduct(null)).toBe('este item');
  });
});
