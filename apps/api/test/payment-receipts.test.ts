import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { PrismaClient } from '@solid/database';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from '../src/auth-repository.js';
import type { CatalogRepository } from '../src/catalog-repository.js';
import { registerPaymentReceiptRoutes } from '../src/payment-receipt-routes.js';
import { validateReceipt, RECEIPT_MAX_BYTES } from '../src/payment-receipt-file.js';
import { decryptSecret, encryptSecret } from '../src/shopify-crypto.js';

const key = Buffer.alloc(32, 7).toString('base64');
const token = 't'.repeat(43);
const tokenHash = createHash('sha256').update(token).digest('hex');
const path = '/public/checkout-sessions/session-public/payments/payment-public/receipt';
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
const environment = { NODE_ENV: 'test', APP_ENCRYPTION_KEY: key } as AppEnvironment;
const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

function fixture() {
  let saved: Record<string, unknown> | null = null;
  const create = vi.fn(({ data }: { data: Record<string, unknown> }) => { saved = { ...data, createdAt: new Date() }; return Promise.resolve(saved); });
  const receipt = {
    findUnique: vi.fn(() => Promise.resolve(saved)),
    aggregate: vi.fn().mockResolvedValue({ _sum: { sizeBytes: 0 } }),
    create,
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
  };
  const payment = { findFirst: vi.fn(({ where }: { where: { publicId: string; session: { publicId: string; tokenHash: string } } }) => Promise.resolve(where.publicId === 'payment-public' && where.session.publicId === 'session-public' && where.session.tokenHash === tokenHash ? { id: 'payment-internal', session: { checkout: { storeId: 'store-a' } } } : null)) };
  const tx = { $queryRaw: vi.fn(), paymentReceipt: receipt };
  const db = { paymentAttempt: payment, paymentReceipt: receipt, $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)) } as unknown as PrismaClient;
  const auth = { findActiveSession: vi.fn().mockResolvedValue(null) };
  const catalog = { resolveStoreContext: vi.fn().mockResolvedValue({ storeId: 'store-a', role: 'OWNER' }) };
  const app = Fastify();
  app.addHook('onRequest', (request, _reply, done) => { request.cookies = { solid_session: 'merchant-session' }; done(); });
  registerPaymentReceiptRoutes(app, environment, auth as unknown as AuthRepository, catalog as unknown as CatalogRepository, db);
  apps.push(app);
  return { app, receipt, create, payment, auth, catalog, saved: () => saved };
}

describe('private payment receipts', () => {
  it('rejects missing token, wrong token, other session and other payment before storing', async () => {
    const { app, create } = fixture();
    for (const [url, authorization] of [[path, ''], [path, `Bearer ${'x'.repeat(43)}`], [path.replace('session-public', 'another-session'), `Bearer ${token}`], [path.replace('payment-public', 'another-payment'), `Bearer ${token}`]]) {
      const response = await app.inject({ method: 'PUT', url: url!, headers: { authorization: authorization!, 'content-type': 'application/pdf' }, payload: pdf });
      expect(response.statusCode).toBe(404);
    }
    expect(create).not.toHaveBeenCalled();
  });
  it('encrypts a receipt, accepts identical retries and rejects a second different attachment', async () => {
    const { app, create, saved, payment } = fixture();
    const upload = (payload: Buffer) => app.inject({ method: 'PUT', url: path, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/pdf' }, payload });
    expect((await upload(pdf)).statusCode).toBe(200);
    const stored = saved()!;
    expect(stored.contentEncrypted).not.toContain('%PDF');
    expect(Buffer.from(decryptSecret(String(stored.contentEncrypted), key), 'base64')).toEqual(pdf);
    expect((await upload(pdf)).statusCode).toBe(200);
    expect(create).toHaveBeenCalledTimes(1);
    expect((await upload(Buffer.concat([pdf, Buffer.from('\n')]))).statusCode).toBe(409);
    const status = await app.inject({ url: path, headers: { authorization: `Bearer ${token}` } });
    expect(status.headers['cache-control']).toBe('private, no-store');
    expect(status.json()).not.toHaveProperty('receipt.contentEncrypted');
    expect(status.json()).not.toHaveProperty('receipt.contentHash');
    // Financial writes are deliberately absent from this repository surface.
    expect(Object.keys(payment)).toEqual(['findFirst']);
  });
  it('bounds storage usage and rejects invalid, oversized and unsupported files', async () => {
    const { app, receipt, create } = fixture();
    const upload = (payload: Buffer, type = 'application/pdf') => app.inject({ method: 'PUT', url: path, headers: { authorization: `Bearer ${token}`, 'content-type': type }, payload });
    expect((await upload(Buffer.from('<script>alert(1)</script>'))).statusCode).toBe(400);
    expect((await upload(Buffer.alloc(RECEIPT_MAX_BYTES + 1))).statusCode).toBe(413);
    expect((await upload(pdf, 'image/svg+xml')).statusCode).toBe(415);
    receipt.aggregate.mockResolvedValue({ _sum: { sizeBytes: 100 * 1024 * 1024 } });
    expect((await upload(pdf)).statusCode).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });
  it('requires merchant authentication and scopes listing and download to the active store', async () => {
    const { app, auth, receipt } = fixture();
    const url = '/orders/session-public/payment-receipts/payment-public';
    expect((await app.inject(url)).statusCode).toBe(401);
    auth.findActiveSession.mockResolvedValue({ userId: 'user-a', sessionId: 'auth-session' });
    expect((await app.inject(url)).statusCode).toBe(404);
    expect(receipt.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { payment: { publicId: 'payment-public', session: { publicId: 'session-public', checkout: { storeId: 'store-a' } } } } }));
    await app.inject('/orders/session-public/payment-receipts');
    expect(receipt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { payment: { session: { publicId: 'session-public', checkout: { storeId: 'store-a' } } } } }));
    receipt.findFirst.mockResolvedValue({ mimeType: 'application/pdf', contentEncrypted: encryptSecret(pdf.toString('base64'), key) });
    const download = await app.inject(url);
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-disposition']).toContain('attachment;');
    expect(download.headers['content-type']).toBe('application/octet-stream');
    expect(download.headers['cache-control']).toBe('private, no-store');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(download.rawPayload).toEqual(pdf);
  });
  it('decodes actual images, strips metadata and rejects forged image types', async () => {
    const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).png().toBuffer();
    const accepted = await validateReceipt(image, 'image/png');
    expect(accepted?.mimeType).toBe('image/webp');
    expect((await sharp(accepted!.content).metadata()).format).toBe('webp');
    expect(await validateReceipt(image, 'image/jpeg')).toBeNull();
    expect(await validateReceipt(pdf, 'image/png')).toBeNull();
    expect(await validateReceipt(Buffer.alloc(0), 'application/pdf')).toBeNull();
  });
});
