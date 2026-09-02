import { createHash } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaGatewayRepository } from './gateway-repository.js';
import { decryptSecret } from './shopify-crypto.js';
import { sendMetaEvent, type MetaEventName } from './meta-client.js';

const hash = (value: string | undefined) => value ? createHash('sha256').update(value.trim().toLowerCase()).digest('hex') : null;
export async function syncMetaEvent(environment: AppEnvironment, repository: PrismaGatewayRepository, checkoutSessionId: string, eventName: MetaEventName, log: FastifyBaseLogger, persistentRetry = false): Promise<void> {
  if (!environment.APP_ENCRYPTION_KEY) return; const context = await repository.utmifyOrderContext(checkoutSessionId); if (!context?.customerDataEncrypted) return;
  const credentials = await repository.credentials(context.checkout.storeId, 'META'); if (!credentials) { if (persistentRetry) await repository.markIntegrationDeliveryFailure(context.checkout.storeId, checkoutSessionId, 'META', eventName, 'Integração Meta desconectada'); return; }
  try {
    const customer = JSON.parse(decryptSecret(context.customerDataEncrypted, environment.APP_ENCRYPTION_KEY)) as Record<string, string>;
    const tracking = typeof context.trackingParameters === 'object' && context.trackingParameters !== null ? context.trackingParameters as Record<string, unknown> : {};
    const fallbackProduct = context.checkout.product;
    const total = context.totalCents - context.discountCents + context.shippingPriceCents; const items = context.items.length ? context.items : fallbackProduct ? [{ productId: fallbackProduct.publicId, titleSnapshot: fallbackProduct.checkoutTitle, unitPriceCents: context.totalCents, quantity: 1, product: { publicId: fallbackProduct.publicId } }] : [];
    if (!items.length) throw new Error('Sessão sem itens rastreáveis');
    const phone = customer.phone?.replace(/\D/g, ''); const normalizedPhone = phone ? (phone.startsWith('55') ? phone : `55${phone}`) : undefined; const names = customer.name?.trim().toLowerCase().split(/\s+/) ?? [];
    const userData = { em: [hash(customer.email)], ph: [hash(normalizedPhone)], fn: [hash(names[0])], ln: [hash(names.length > 1 ? names[names.length - 1] : undefined)], country: [hash('br')], external_id: [hash(context.publicId)], client_ip_address: tracking.client_ip_address || undefined, client_user_agent: tracking.client_user_agent || undefined, fbp: tracking.fbp || undefined, fbc: tracking.fbc || undefined };
    await sendMetaEvent(decryptSecret(credentials.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY), decryptSecret(credentials.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY), { event_name: eventName, event_time: Math.floor(Date.now() / 1000), event_id: `${context.publicId}:${eventName}`, event_source_url: tracking.event_source_url || undefined, action_source: 'website', user_data: userData, custom_data: { currency: context.currency, value: total / 100, content_ids: items.map(item => item.product.publicId), content_type: 'product', contents: items.map(item => ({ id: item.product.publicId, quantity: item.quantity, item_price: item.unitPriceCents / 100 })), num_items: items.reduce((sum, item) => sum + item.quantity, 0), order_id: context.publicId } });
    await repository.markIntegrationDeliverySuccess(context.checkout.storeId, checkoutSessionId, 'META', eventName);
    await repository.recordIntegrationEvent(context.checkout.storeId, 'META', eventName, true, { checkoutSessionId: context.publicId });
  } catch (error) { const message = error instanceof Error ? error.message : 'Falha desconhecida'; log.warn({ err: error, checkoutSessionId, metaEvent: eventName }, 'meta_capi_sync_failed'); try { await repository.markIntegrationDeliveryFailure(context.checkout.storeId, checkoutSessionId, 'META', eventName, message); await repository.recordIntegrationEvent(context.checkout.storeId, 'META', eventName, false, { checkoutSessionId: context.publicId }); } catch (persistenceError) { log.error({ err: persistenceError, checkoutSessionId }, 'meta_failure_persistence_failed'); } }
}
