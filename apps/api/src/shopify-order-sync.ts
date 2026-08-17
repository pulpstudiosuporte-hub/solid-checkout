import type { AppEnvironment } from '@solid/config';
import { decryptSecret } from './shopify-crypto.js';
import type { ShopifyRepository } from './shopify-repository.js';

type Customer = { name?: string; email?: string; phone?: string };
type Address = { postalCode?: string; street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string; country?: string };
type ShopifyOrderResponse = { orderCreate: { order: { id: string; name?: string | null } | null; userErrors: readonly { message: string }[] } };

const CREATE_ORDER = `mutation SolidOrderCreate($order: OrderCreateOrderInput!) {
  orderCreate(order: $order) {
    order { id name }
    userErrors { message }
  }
}`;

export async function syncPaidShopifyOrder(environment: AppEnvironment, repository: ShopifyRepository, checkoutSessionId: string): Promise<void> {
  if (!environment.APP_ENCRYPTION_KEY) return;
  const context = await repository.claimPaidOrderSync(checkoutSessionId, new Date());
  if (!context) return;
  try {
    const credentials = await repository.credentials(context.storeId);
    if (!credentials) throw new Error('A loja não possui uma conexão Shopify ativa.');
    const customer = JSON.parse(decryptSecret(context.customerDataEncrypted, environment.APP_ENCRYPTION_KEY)) as Customer;
    const address = JSON.parse(decryptSecret(context.shippingAddressEncrypted, environment.APP_ENCRYPTION_KEY)) as Address;
    const [firstName, ...rest] = (customer.name ?? '').trim().split(/\s+/);
    const shippingAddress = { firstName, lastName: rest.join(' ') || undefined, address1: [address.street, address.number].filter(Boolean).join(', '), address2: [address.complement, address.neighborhood].filter(Boolean).join(' - ') || undefined, city: address.city, provinceCode: address.state, countryCode: address.country ?? 'BR', zip: address.postalCode, phone: customer.phone };
    const order = {
      email: customer.email,
      phone: customer.phone,
      currency: context.currency,
      financialStatus: 'PAID',
      lineItems: context.items.map(item => ({ variantId: item.variantExternalId, quantity: item.quantity })),
      shippingAddress,
      billingAddress: shippingAddress,
      ...(context.shippingMethodName ? { shippingLines: [{ title: context.shippingMethodName, priceSet: { shopMoney: { amount: (context.shippingPriceCents / 100).toFixed(2), currencyCode: context.currency } } }] } : {}),
      sourceIdentifier: `solid-${context.publicId}`,
      poNumber: `SOLID-${context.publicId}`,
      tags: ['solid-checkout', 'pix-westpay'],
      note: `Pagamento Pix confirmado pela WestPay. Sessão SOLID: ${context.publicId}`
    };
    const data = await shopifyGraphql<ShopifyOrderResponse>(credentials.shopDomain, decryptSecret(credentials.accessTokenEncrypted, environment.APP_ENCRYPTION_KEY), CREATE_ORDER, { order });
    const errors = data.orderCreate.userErrors.map(error => error.message).filter(Boolean);
    if (!data.orderCreate.order || errors.length) throw new Error(errors.join('; ') || 'A Shopify não retornou o pedido criado.');
    await repository.markOrderSynced(context.checkoutSessionId, data.orderCreate.order, new Date());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida ao criar pedido Shopify.';
    await repository.markOrderSyncFailed(context.checkoutSessionId, message);
    throw error;
  }
}

async function shopifyGraphql<T>(shop: string, token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Shopify-Access-Token': token }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(25_000) });
  const body = await response.json() as { data?: T; errors?: readonly { message: string }[] };
  if (!response.ok || !body.data || body.errors?.length) throw new Error(body.errors?.map(error => error.message).join('; ') || `Shopify respondeu HTTP ${response.status}.`);
  return body.data;
}
