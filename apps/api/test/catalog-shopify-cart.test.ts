import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@solid/database';
import { PrismaCatalogRepository } from '../src/catalog-repository.js';

describe('sessão de carrinho Shopify', () => {
  it('aceita variante disponível com estoque zero e consolida linhas repetidas', async () => {
    const create = vi.fn().mockResolvedValue({
      publicId: 'session-shopify',
      totalCents: 16_800,
      currency: 'BRL',
      expiresAt: new Date('2026-09-02T00:30:00.000Z'),
      checkout: { slug: 'checkout-principal-shopify' },
      items: []
    });
    const transaction = {
      shopifyConnection: { findFirst: vi.fn().mockResolvedValue({ storeId: 'store-id', store: { slug: 'loja' } }) },
      checkout: { findFirst: vi.fn().mockResolvedValue({ id: 'checkout-id', publishedConfig: {} }) },
      productVariant: { findMany: vi.fn().mockResolvedValue([{
        id: 'variant-id', sourceExternalId: 'gid://shopify/ProductVariant/123456789',
        title: 'Padrão', priceCents: 5_600, inventoryQuantity: 0, imageUrl: null,
        product: { id: 'product-id', checkoutTitle: 'Produto', imageUrl: null, maxPerOrder: 10 }
      }]) },
      checkoutSession: { create }
    };
    const database = { $transaction: (callback: (tx: typeof transaction) => unknown) => callback(transaction) } as unknown as PrismaClient;
    const repository = new PrismaCatalogRepository(database);

    const result = await repository.createShopifyCartSession({
      shopDomain: 'loja.myshopify.com',
      lines: [{ variantId: '123456789', quantity: 1 }, { variantId: '123456789', quantity: 2 }],
      tokenHash: 'token-hash',
      expiresAt: new Date('2026-09-02T00:30:00.000Z')
    });

    expect(result).toMatchObject({ publicId: 'session-shopify', storeSlug: 'loja' });
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      quantity: 3,
      totalCents: 16_800,
      items: { create: [{ variantId: 'variant-id', quantity: 3, totalCents: 16_800 }] }
    });
  });
});
