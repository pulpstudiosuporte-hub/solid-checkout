import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShopifyRepository } from '../src/shopify-repository.js';
import { syncPaidShopifyOrder } from '../src/shopify-order-sync.js';
import { encryptSecret } from '../src/shopify-crypto.js';

vi.mock('../src/shopify-token.js', () => ({ getShopifyAccessToken: vi.fn().mockResolvedValue('test-token') }));
afterEach(() => vi.unstubAllGlobals());
describe('sincronização do desconto Shopify', () => {
  it('não marca um pedido pendente como pago ao repetir a entrega', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const repository = { shopifyOrderId: vi.fn().mockResolvedValue({ storeId: 'store-a', orderId: 'order-a', paid: false }) } as unknown as ShopifyRepository;
    await syncPaidShopifyOrder({ NODE_ENV: 'test', API_HOST: 'localhost', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: [], TRUST_PROXY: false, APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') }, repository, 'session');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('envia a soma de cupom e Pix como desconto fixo sem alterar frete', async () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { orderCreate: { order: { id: 'gid://shopify/Order/1' }, userErrors: [] } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const repository = {
      shopifyOrderId: vi.fn().mockResolvedValue(null),
      claimPaidOrderSync: vi.fn().mockResolvedValue({ checkoutSessionId: 'session', publicId: 'public-session', storeId: 'store-a', paid: false, currency: 'BRL', discountCents: 2800, shippingPriceCents: 1200, shippingMethodName: 'Entrega', customerDataEncrypted: encryptSecret(JSON.stringify({ name: 'Cliente', email: 'test@example.com' }), key), shippingAddressEncrypted: encryptSecret(JSON.stringify({ street: 'Rua Teste', number: '1', city: 'Cidade', state: 'SP', postalCode: '01001000' }), key), items: [{ variantExternalId: 'gid://shopify/ProductVariant/1', quantity: 1, title: 'Produto', unitPriceCents: 10_000 }] }),
      credentials: vi.fn().mockResolvedValue({ shopDomain: 'test.myshopify.com' }),
      markOrderSynced: vi.fn().mockResolvedValue(undefined),
      markOrderSyncFailed: vi.fn().mockResolvedValue(undefined)
    };
    await syncPaidShopifyOrder({ NODE_ENV: 'test', API_HOST: 'localhost', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: [], TRUST_PROXY: false, APP_ENCRYPTION_KEY: key }, repository as unknown as ShopifyRepository, 'session');
    const [, request] = fetch.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(request.body) as { variables: { order: { discountCode: object; shippingLines: object[] } } };
    expect(body.variables.order.discountCode).toEqual({ itemFixedDiscountCode: { code: 'SOLID-DISCOUNT', amountSet: { shopMoney: { amount: '28.00', currencyCode: 'BRL' } } } });
    expect(body.variables.order.shippingLines).toMatchObject([{ priceSet: { shopMoney: { amount: '12.00' } } }]);
    expect(repository.markOrderSynced).toHaveBeenCalled();
  });
});
