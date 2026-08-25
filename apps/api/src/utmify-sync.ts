import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaGatewayRepository } from './gateway-repository.js';
import { decryptSecret } from './shopify-crypto.js';
import { sendUtmifyOrder, utcDate, type UtmifyStatus } from './utmify-client.js';

export async function syncUtmifyOrder(environment: AppEnvironment, repository: PrismaGatewayRepository, checkoutSessionId: string, status: UtmifyStatus, log: FastifyBaseLogger): Promise<void> {
  if (!environment.APP_ENCRYPTION_KEY) return;
  const context = await repository.utmifyOrderContext(checkoutSessionId); if (!context?.customerDataEncrypted) return;
  const credentials = await repository.credentials(context.checkout.storeId, 'UTMIFY'); if (!credentials) return;
  try {
    const customer = JSON.parse(decryptSecret(context.customerDataEncrypted, environment.APP_ENCRYPTION_KEY)) as Record<string, string>;
    const total = context.totalCents - context.discountCents + context.shippingPriceCents;
    const items = context.items.length ? context.items : [{ productId: context.checkout.product.publicId, titleSnapshot: context.checkout.product.checkoutTitle, unitPriceCents: context.totalCents, quantity: 1, product: { publicId: context.checkout.product.publicId } }];
    await sendUtmifyOrder(decryptSecret(credentials.apiKeyEncrypted, environment.APP_ENCRYPTION_KEY), {
      orderId: context.publicId, platform: 'SOLID Checkout', paymentMethod: 'pix', status, createdAt: utcDate(context.createdAt), approvedDate: status === 'paid' ? utcDate(context.completedAt ?? new Date()) : null, refundedAt: status === 'refunded' ? utcDate(new Date()) : null,
      customer: { name: customer.name, email: customer.email, phone: customer.phone || null, document: customer.document || null, country: 'BR', ip: null },
      products: items.map(item => ({ id: item.product.publicId, name: item.titleSnapshot, planId: null, planName: null, quantity: item.quantity, priceInCents: item.unitPriceCents })),
      trackingParameters: context.trackingParameters,
      commission: { totalPriceInCents: total, gatewayFeeInCents: 0, userCommissionInCents: total, currency: context.currency }, isTest: false,
    });
  } catch (error) { log.warn({ err: error, checkoutSessionId, utmifyStatus: status }, 'utmify_order_sync_failed'); }
}
