import { describe, expect, it } from 'vitest';
import { canTransitionPayment, mapProviderPaymentStatus, providerAmountMatches } from '../src/payment-rules.js';

describe('regras críticas de pagamento', () => {
  it('normaliza apenas estados conhecidos do provedor', () => {
    expect(mapProviderPaymentStatus('approved')).toBe('PAID');
    expect(mapProviderPaymentStatus('partially_refunded')).toBe('REFUNDED');
    expect(mapProviderPaymentStatus('pending')).toBeNull();
    expect(mapProviderPaymentStatus('qualquer-coisa')).toBeNull();
  });

  it('recusa valor divergente e aceita representações exatas em reais ou centavos', () => {
    expect(providerAmountMatches(500, 500)).toBe(true);
    expect(providerAmountMatches(5, 500)).toBe(true);
    expect(providerAmountMatches(4.99, 500)).toBe(false);
    expect(providerAmountMatches(Number.NaN, 500)).toBe(false);
  });

  it('impede regressão, duplicação e alteração de uma transação estornada', () => {
    expect(canTransitionPayment('PENDING', 'PAID')).toBe(true);
    expect(canTransitionPayment('PAID', 'PAID')).toBe(false);
    expect(canTransitionPayment('PAID', 'FAILED')).toBe(false);
    expect(canTransitionPayment('PAID', 'REFUNDED')).toBe(true);
    expect(canTransitionPayment('REFUNDED', 'PAID')).toBe(false);
  });
});
