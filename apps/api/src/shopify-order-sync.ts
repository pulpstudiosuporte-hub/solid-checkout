import type { AppEnvironment } from '@solid/config';
import { decryptSecret } from './shopify-crypto.js';
import type { ShopifyRepository } from './shopify-repository.js';
import { isShopifyAuthorizationFailure, ShopifyAuthorizationError } from './shopify-auth-error.js';

type Customer = { name?: string; email?: string; phone?: string };
type Address = { postalCode?: string; street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string; country?: string };
type ShopifyOrderResponse = { orderCreate: { order: { id: string; name?: string | null } | null; userErrors: readonly { message: string }[] } };

const CREATE_ORDER = `mutation SolidOrderCreate($order: OrderCreateOrderInput!) {
  orderCreate(order: $order) {
    order { id name }
    userErrors { message }
  }
}`;
const MARK_ORDER_PAID = `mutation SolidOrderMarkAsPaid($input: OrderMarkAsPaidInput!) {
  orderMarkAsPaid(input: $input) { order { id name } userErrors { message } }
}`;

export async function syncPaidShopifyOrder(environment: AppEnvironment, repository: ShopifyRepository, checkoutSessionId: string): Promise<void> {
  if (!environment.APP_ENCRYPTION_KEY) return;
  let affectedStoreId: string | undefined;
  try {
    const existing = await repository.shopifyOrderId(checkoutSessionId);
    if (existing) {
      affectedStoreId = existing.storeId;
      await markAsPaid(environment, repository, existing.storeId, existing.orderId);
      await repository.markOrderPaymentSynced(checkoutSessionId, new Date());
      return;
    }
    const context = await repository.claimPaidOrderSync(checkoutSessionId, new Date());
    if (!context) return;
    affectedStoreId = context.storeId;
    const credentials = await repository.credentials(context.storeId);
    if (!credentials) throw new Error('A loja não possui uma conexão Shopify ativa.');
    const customer = JSON.parse(decryptSecret(context.customerDataEncrypted, environment.APP_ENCRYPTION_KEY)) as Customer;
    const address = JSON.parse(decryptSecret(context.shippingAddressEncrypted, environment.APP_ENCRYPTION_KEY)) as Address;
    const [firstName, ...rest] = (customer.name ?? '').trim().split(/\s+/);
    const phone = shopifyPhone(customer.phone);
    const shippingAddress = { firstName, lastName: rest.join(' ') || undefined, address1: [address.street, address.number].filter(Boolean).join(', '), address2: [address.complement, address.neighborhood].filter(Boolean).join(' - ') || undefined, city: address.city, provinceCode: address.state, countryCode: address.country ?? 'BR', zip: address.postalCode, phone };
    const order = {
      email: customer.email,
      phone,
      currency: context.currency,
      financialStatus: context.paid ? 'PAID' : 'PENDING',
      lineItems: context.items.map(item => item.variantExternalId.startsWith('gid://shopify/ProductVariant/') ? ({ variantId: item.variantExternalId, quantity: item.quantity }) : ({ title: item.title, quantity: item.quantity, priceSet: { shopMoney: { amount: (item.unitPriceCents / 100).toFixed(2), currencyCode: context.currency } } })),
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
    if (context.paid) await markAsPaid(environment, repository, context.storeId, data.orderCreate.order.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida ao criar pedido Shopify.';
    await repository.markOrderSyncFailed(checkoutSessionId, message);
    if (error instanceof ShopifyAuthorizationError && affectedStoreId) await repository.markReconnectRequired(affectedStoreId, message);
    throw error;
  }
}

function shopifyPhone(value: string | undefined): string | undefined {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (!digits) return undefined;
  if (/^55\d{10,11}$/.test(digits)) return `+${digits}`;
  if (/^\d{10,11}$/.test(digits)) return `+55${digits}`;
  return undefined;
}

async function markAsPaid(environment: AppEnvironment, repository: ShopifyRepository, storeId: string, orderId: string): Promise<void> {
  if (!environment.APP_ENCRYPTION_KEY) return;
  const credentials = await repository.credentials(storeId);
  if (!credentials) throw new Error('A loja não possui uma conexão Shopify ativa.');
  const data = await shopifyGraphql<{ orderMarkAsPaid: { userErrors: readonly { message: string }[] } }>(credentials.shopDomain, decryptSecret(credentials.accessTokenEncrypted, environment.APP_ENCRYPTION_KEY), MARK_ORDER_PAID, { input: { id: orderId } });
  const errors = data.orderMarkAsPaid.userErrors.map(error => error.message).filter(Boolean);
  if (errors.length && !errors.some(message => /already paid|já.*pag/i.test(message))) throw new Error(errors.join('; '));
}

async function shopifyGraphql<T>(shop: string, token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Shopify-Access-Token': token }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(25_000) });
  const raw = await response.text();
  const body = (() => { try { return JSON.parse(raw) as { data?: T; errors?: unknown }; } catch { return { errors: raw }; } })();
  const errors = shopifyErrorMessages(body.errors);
  if (isShopifyAuthorizationFailure(response.status, errors)) throw new ShopifyAuthorizationError(errors.join('; ') || `Shopify respondeu HTTP ${response.status}.`);
  if (!response.ok || !body.data || errors.length) throw new Error(errors.join('; ') || `Shopify respondeu HTTP ${response.status}.`);
  return body.data;
}

function shopifyErrorMessages(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim().slice(0, 500)] : [];
  if (Array.isArray(value)) return value.flatMap(shopifyErrorMessages);
  if (typeof value !== 'object' || value === null) return [];
  const item = value as Record<string, unknown>;
  if (typeof item.message === 'string') return shopifyErrorMessages(item.message);
  return Object.values(item).flatMap(shopifyErrorMessages);
}
