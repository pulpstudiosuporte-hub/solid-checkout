import { describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import type { Prisma, PrismaClient } from '@solid/database';
import { createStoreWebhookDispatcher, resolveSafeWebhookUrl } from '../src/webhook-routes.js';

const environment = { APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') } as AppEnvironment;

describe('store webhooks', () => {
  it.each(['https://127.0.0.1/hook', 'https://10.0.0.1/hook', 'https://169.254.169.254/latest', 'https://100.64.0.1/hook', 'http://1.1.1.1/hook'])('rejects unsafe endpoint %s', async url => {
    await expect(resolveSafeWebhookUrl(url)).rejects.toThrow();
  });

  it('accepts a public HTTPS endpoint and pins its address', async () => {
    const result = await resolveSafeWebhookUrl('https://1.1.1.1/webhooks?source=solid');
    expect(result.address).toBe('1.1.1.1');
    expect(result.url.pathname).toBe('/webhooks');
  });

  it('persists one durable job per active endpoint with a shared event id', async () => {
    let captured: Prisma.WebhookDeliveryCreateManyArgs | undefined;
    const createMany = vi.fn((args: Prisma.WebhookDeliveryCreateManyArgs) => { captured = args; return Promise.resolve({ count: 2 }); });
    const database = { webhookEndpoint: { findMany: vi.fn().mockResolvedValue([{ id: 'endpoint-1' }, { id: 'endpoint-2' }]) }, webhookDelivery: { createMany } } as unknown as PrismaClient;
    await createStoreWebhookDispatcher(environment, database)('store-1', 'order.created', { order: { id: 'order-1', paymentId: 'payment-1' } });
    expect(createMany).toHaveBeenCalledOnce();
    const jobs = Array.isArray(captured?.data) ? captured.data : [captured!.data];
    expect(jobs).toHaveLength(2);
    const first = jobs[0]!; const second = jobs[1]!;
    expect(first.eventId).toBe(second.eventId);
    expect(JSON.stringify(first.payload)).toContain('"paymentId":"payment-1"');
  });

  it('does not enqueue work when no endpoint subscribes', async () => {
    const createMany = vi.fn();
    const database = { webhookEndpoint: { findMany: vi.fn().mockResolvedValue([]) }, webhookDelivery: { createMany } } as unknown as PrismaClient;
    await createStoreWebhookDispatcher(environment, database)('store-1', 'order.paid', {});
    expect(createMany).not.toHaveBeenCalled();
  });
});
