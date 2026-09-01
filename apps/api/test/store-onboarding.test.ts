import { describe, expect, it } from 'vitest';
import { onboardingMissingFields } from '../src/store-onboarding.js';

const completeStore = { name: 'Loja teste', profile: { legalName: 'Loja Teste Ltda', document: '12345678000199', businessModel: 'E-commerce', monthlyRevenue: 'Até R$ 10 mil' } };
const completeOwner = { name: 'Responsável Teste', profile: { document: '12345678901', birthDate: '1990-01-01', zipCode: '01001000', address: 'Praça da Sé', number: '1', district: 'Sé', city: 'São Paulo', state: 'SP' } };

describe('store onboarding', () => {
  it('marks a complete registration as ready', () => {
    expect(onboardingMissingFields(completeStore, completeOwner)).toEqual([]);
  });

  it('reports the exact missing required fields', () => {
    expect(onboardingMissingFields({ ...completeStore, profile: {} }, completeOwner)).toEqual([
      'store.legalName', 'store.document', 'store.businessModel', 'store.monthlyRevenue',
    ]);
  });
});
