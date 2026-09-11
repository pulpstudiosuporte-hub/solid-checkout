import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { FastifyBaseLogger } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import { postPinnedWebhook, startWebhookDelivery } from '../src/webhook-routes.js';
import { encryptSecret } from '../src/shopify-crypto.js';

const transport = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('node:https', () => ({ request: transport.request }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
const key = Buffer.alloc(32, 7).toString('base64');

function requestMock(status: number | null) {
  const response = Object.assign(new PassThrough(), { statusCode: status });
  const request = Object.assign(new EventEmitter(), {
    end: vi.fn(() => { queueMicrotask(() => { callback(response); if (status !== null) response.end(); }); }),
    destroy: vi.fn((error: Error) => { request.emit('error', error); request.emit('close'); }),
  });
  let callback: (stream: typeof response) => void;
  transport.request.mockImplementation((_options, handler: typeof callback) => { callback = handler; return request; });
  response.once('end', () => request.emit('close'));
  return { request, response };
}

describe('webhook transport and delivery', () => {
  it('enforces an absolute deadline even while a response keeps streaming', async () => {
    vi.useFakeTimers();
    const { response, request } = requestMock(null);
    const promise = postPinnedWebhook({ url: new URL('https://1.1.1.1/hook'), address: '1.1.1.1', family: 4 }, '{}', {});
    const outcome = expect(promise).rejects.toThrow('Tempo limite');
    for (let index = 0; index < 10; index++) { response.write('still streaming'); await vi.advanceTimersByTimeAsync(1000); }
    await outcome;
    expect(request.destroy).toHaveBeenCalledOnce();
  });

  it('rejects an interrupted response instead of leaving the job pending forever', async () => {
    const { response, request } = requestMock(null);
    const promise = postPinnedWebhook({ url: new URL('https://1.1.1.1/hook'), address: '1.1.1.1', family: 4 }, '{}', {});
    await Promise.resolve();
    response.emit('aborted'); request.emit('close');
    await expect(promise).rejects.toThrow('interrompida');
  });

  it.each([204, 503])('records attempts and HTTP status for a %s response', async statusCode => {
    vi.useFakeTimers(); requestMock(statusCode);
    const update = vi.fn().mockResolvedValue({});
    const db = { webhookDelivery: {
      findMany: vi.fn().mockResolvedValue([{ id: 'job-a', attempts: 2, event: 'order.paid', payload: { id: 'evt-a' }, webhookEndpoint: { active: true, url: 'https://1.1.1.1/hook', secretEncrypted: encryptSecret('signing-secret', key) } }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }), update,
    } } as unknown as PrismaClient;
    const logger = { error: vi.fn() };
    const stop = startWebhookDelivery({ APP_ENCRYPTION_KEY: key } as AppEnvironment, db, logger as unknown as FastifyBaseLogger);
    await vi.advanceTimersByTimeAsync(1);
    stop();
    expect(logger.error).not.toHaveBeenCalled();
    expect(update.mock.calls[0]?.[0]).toMatchObject({ data: { attempts: 3, statusCode, success: statusCode === 204, status: statusCode === 204 ? 'DELIVERED' : 'PENDING' } });
  });
});
