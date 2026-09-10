import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@solid/database';
import { PrismaCatalogRepository } from '../src/catalog-repository.js';

const rule = { percentageBps: 1000, minimumAmountCents: 0, maximumAmountCents: null };
describe('descontos nas sessões de checkout', () => {
  it.each([rule, null])('salva a regra ativa no início da sessão: %j', async paymentRule => {
    const create = vi.fn().mockResolvedValue({ publicId: 'session-a' });
    const transaction = {
      checkout: { findFirst: vi.fn().mockResolvedValue({ id: 'checkout-a', storeId: 'store-a', productId: 'product-a', publishedConfig: {}, product: { priceCents: 10_000, maxPerOrder: 10, trackInventory: false } }) },
      paymentDiscount: { findFirst: vi.fn().mockResolvedValue(paymentRule) },
      checkoutSession: { create }
    };
    const database = { $transaction: (fn: (tx: typeof transaction) => unknown) => fn(transaction) } as unknown as PrismaClient;
    await new PrismaCatalogRepository(database).createPublicCheckoutSession({ storeSlug: 'store-a', checkoutSlug: 'checkout-a', quantity: 2, tokenHash: 'hash', source: 'DIRECT', expiresAt: new Date(Date.now() + 60_000) });
    const [input] = create.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(input.data).toMatchObject({ totalCents: 20_000, discountCents: paymentRule ? 2000 : 0, paymentDiscountCents: paymentRule ? 2000 : 0 });
    if (paymentRule) expect(input.data.paymentDiscountRule).toEqual(rule);
    else expect(input.data).not.toHaveProperty('paymentDiscountRule');
  });
  it('recalcula quantidade com a regra da sessão e o cupom', async () => {
    const update = vi.fn().mockResolvedValue({});
    const transaction = { checkoutSession: { findFirst: vi.fn().mockResolvedValue({ id: 'session-a', source: 'DIRECT', unitPriceCents: 10_000, shippingPriceCents: 1200, paymentDiscountRule: rule, coupon: { type: 'PERCENT', value: 2000, maxDiscountCents: null }, variant: null, checkout: { product: { maxPerOrder: 10, trackInventory: false } }, items: [], paymentAttempts: [] }), update } };
    const database = { $transaction: (fn: (tx: typeof transaction) => unknown) => fn(transaction) } as unknown as PrismaClient;
    const result = await new PrismaCatalogRepository(database).updatePublicCheckoutQuantity('public-session', 'hash', 2, new Date());
    expect(result).toMatchObject({ totalCents: 20_000, discountCents: 5600, paymentDiscountCents: 1600, grandTotalCents: 15_600 });
    const [input] = update.mock.calls[0] as [{ data: object }];
    expect(input.data).toMatchObject({ discountCents: 5600, paymentDiscountCents: 1600 });
  });
});
