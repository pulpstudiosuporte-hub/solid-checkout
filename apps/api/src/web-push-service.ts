import { createHash } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyBaseLogger } from 'fastify';
import webpush from 'web-push';
import { decryptSecret } from './shopify-crypto.js';
import { notificationContent } from './notification-content.js';

export type StorePushDispatcher = (storeId: string, action: string, metadata: unknown, targetId: string) => Promise<void>;

export function createStorePushDispatcher(environment: AppEnvironment, database: PrismaClient, log: FastifyBaseLogger): StorePushDispatcher | undefined {
  if (!environment.VAPID_PUBLIC_KEY || !environment.VAPID_PRIVATE_KEY || !environment.VAPID_SUBJECT || !environment.APP_ENCRYPTION_KEY) return undefined;
  webpush.setVapidDetails(environment.VAPID_SUBJECT, environment.VAPID_PUBLIC_KEY, environment.VAPID_PRIVATE_KEY);
  return async (storeId, action, metadata, targetId) => {
    try {
      const payload = notificationContent(action, metadata);
      const [store, subscriptions] = await Promise.all([
        database.store.findUnique({ where: { id: storeId }, select: { name: true } }),
        database.pushSubscription.findMany({ where: { user: { memberships: { some: { storeId } } } }, select: { id: true, endpointEncrypted: true, p256dhEncrypted: true, authEncrypted: true } }),
      ]);
      await Promise.all(subscriptions.map(async subscription => {
        try {
          const endpoint = decryptSecret(subscription.endpointEncrypted, environment.APP_ENCRYPTION_KEY!);
          const p256dh = decryptSecret(subscription.p256dhEncrypted, environment.APP_ENCRYPTION_KEY!);
          const auth = decryptSecret(subscription.authEncrypted, environment.APP_ENCRYPTION_KEY!);
          await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, JSON.stringify({ ...payload, title: store?.name ? `${payload.title} \u00b7 ${store.name}` : payload.title, tag: `solid-${action}-${targetId}`, targetId }), { TTL: 300, urgency: action === 'payment.webhook_verified' ? 'high' : 'normal' });
          await database.pushSubscription.update({ where: { id: subscription.id }, data: { lastUsedAt: new Date() } });
        } catch (error) {
          const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : 0;
          if (statusCode === 404 || statusCode === 410) {
            await database.pushSubscription.deleteMany({ where: { id: subscription.id } });
            return;
          }
          log.warn({ err: error, subscription: createHash('sha256').update(subscription.id).digest('hex').slice(0, 12), action }, 'web_push_delivery_failed');
        }
      }));
    } catch (error) {
      // A notification is best-effort: it must never interrupt checkout or webhook processing.
      log.warn({ err: error, action, storeId }, 'web_push_dispatch_failed');
    }
  };
}
