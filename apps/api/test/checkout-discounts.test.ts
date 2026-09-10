import { describe, expect, it } from 'vitest';
import { checkoutDiscounts, paymentDiscountRule } from '../src/checkout-discounts.js';

const pix = { percentageBps: 1000, minimumAmountCents: 0, maximumAmountCents: null };
describe('desconto Pix', () => {
  it('aplica Pix depois do cupom e mantém o componente separado', () => {
    expect(checkoutDiscounts(10_000, { type: 'PERCENT', value: 2000, maxDiscountCents: null }, pix)).toEqual({ discountCents: 2800, paymentDiscountCents: 800 });
  });
  it('recalcula os limites ao mudar quantidade ou order bump', () => {
    const rule = { ...pix, minimumAmountCents: 5000, maximumAmountCents: 800 };
    expect(checkoutDiscounts(4999, null, rule).discountCents).toBe(0);
    expect(checkoutDiscounts(5000, null, rule).discountCents).toBe(500);
    expect(checkoutDiscounts(20_000, null, rule).discountCents).toBe(800);
    expect(checkoutDiscounts(5000, { type: 'FIXED', value: 1, maxDiscountCents: null }, rule).paymentDiscountCents).toBe(0);
  });
  it('arredonda para centavos e nunca gera total zero ou negativo', () => {
    expect(checkoutDiscounts(999, null, pix).paymentDiscountCents).toBe(99);
    expect(checkoutDiscounts(100, null, { ...pix, percentageBps: 10_000 }).discountCents).toBe(99);
    expect(checkoutDiscounts(100, { type: 'FIXED', value: 200, maxDiscountCents: null }, pix)).toEqual({ discountCents: 99, paymentDiscountCents: 0 });
  });
  it('preserva sessões antigas sem regra Pix', () => {
    expect(checkoutDiscounts(10_000, null, null)).toEqual({ discountCents: 0, paymentDiscountCents: 0 });
  });
  it.each([null, {}, { ...pix, percentageBps: 10001 }, { ...pix, percentageBps: 1.5 }, { ...pix, minimumAmountCents: -1 }, { ...pix, maximumAmountCents: 0 }, { ...pix, maximumAmountCents: 3_000_000_000 }])('rejeita regra inválida %j', value => {
    expect(paymentDiscountRule(value)).toBeNull();
  });
});
