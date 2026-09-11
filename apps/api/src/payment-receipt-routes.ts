import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { AuthRepository } from './auth-repository.js';
import type { CatalogRepository } from './catalog-repository.js';
import { decryptSecret, encryptSecret } from './shopify-crypto.js';
import { RECEIPT_MAX_BYTES, RECEIPT_TYPES, validateReceipt } from './payment-receipt-file.js';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const validId = (value: string) => /^[A-Za-z0-9_-]{8,32}$/.test(value);
const error = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const retentionMs = 30 * 24 * 60 * 60 * 1000;
const storeQuota = 100 * 1024 * 1024;
type PublicParams = { sessionId: string; paymentId: string };

export function registerPaymentReceiptRoutes(parent: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, catalog: CatalogRepository, database: PrismaClient): void {
  void parent.register((app, _options, done) => {
    app.addContentTypeParser(RECEIPT_TYPES, { parseAs: 'buffer', bodyLimit: RECEIPT_MAX_BYTES }, (_request, body, done) => done(null, body));
    app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store'); });

    async function publicPayment(request: FastifyRequest<{ Params: PublicParams }>) {
      const { sessionId, paymentId } = request.params;
      const token = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : '';
      if (!validId(sessionId) || !validId(paymentId) || token.length < 32 || token.length > 128) return null;
      // Session expiry limits new purchases, but a buyer may report an already-paid Pix afterwards.
      return database.paymentAttempt.findFirst({
        where: { publicId: paymentId, providerTransactionId: { not: null }, createdAt: { gt: new Date(Date.now() - retentionMs) }, session: { publicId: sessionId, tokenHash: hash(token) } },
        select: { id: true, session: { select: { checkout: { select: { storeId: true } } } } },
      });
    }
    const publicPath = '/public/checkout-sessions/:sessionId/payments/:paymentId/receipt';
    app.get<{ Params: PublicParams }>(publicPath, async (request, reply) => {
      const payment = await publicPayment(request);
      if (!payment) return reply.code(404).send(error(request, 'PAYMENT_NOT_FOUND', 'Pagamento indisponível. Reabra o link original do checkout.'));
      const receipt = await database.paymentReceipt.findUnique({ where: { paymentAttemptId: payment.id }, select: { createdAt: true, mimeType: true, sizeBytes: true } });
      return { receipt: receipt ? { createdAt: receipt.createdAt, mimeType: receipt.mimeType, sizeBytes: receipt.sizeBytes } : null };
    });
    app.put<{ Params: PublicParams; Body: Buffer }>(publicPath, { bodyLimit: RECEIPT_MAX_BYTES, config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request, reply) => {
      if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(error(request, 'RECEIPT_UNAVAILABLE', 'Envio de comprovante temporariamente indisponível.'));
      const payment = await publicPayment(request);
      if (!payment) return reply.code(404).send(error(request, 'PAYMENT_NOT_FOUND', 'Pagamento indisponível. Reabra o link original do checkout.'));
      const mimeType = request.headers['content-type']?.split(';')[0]?.trim() ?? '';
      const file = Buffer.isBuffer(request.body) ? await validateReceipt(request.body, mimeType) : null;
      if (!file) return reply.code(400).send(error(request, 'INVALID_RECEIPT', 'Envie um comprovante válido em JPG, PNG, WebP ou PDF de até 3 MB.'));
      const contentHash = hash(file.content);
      const storeId = payment.session.checkout.storeId;
      const result = await database.$transaction(async tx => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`receipts:${storeId}`}, 0))`;
        const existing = await tx.paymentReceipt.findUnique({ where: { paymentAttemptId: payment.id }, select: { contentHash: true, createdAt: true, mimeType: true, sizeBytes: true } });
        if (existing) return existing.contentHash === contentHash ? { receipt: { createdAt: existing.createdAt, mimeType: existing.mimeType, sizeBytes: existing.sizeBytes } } : { error: 'EXISTS' as const };
        const usage = await tx.paymentReceipt.aggregate({ where: { payment: { session: { checkout: { storeId } } } }, _sum: { sizeBytes: true } });
        if ((usage._sum.sizeBytes ?? 0) + file.content.length > storeQuota) return { error: 'QUOTA' as const };
        const receipt = await tx.paymentReceipt.create({ data: { paymentAttemptId: payment.id, contentHash, contentEncrypted: encryptSecret(file.content.toString('base64'), environment.APP_ENCRYPTION_KEY!), mimeType: file.mimeType, sizeBytes: file.content.length }, select: { createdAt: true, mimeType: true, sizeBytes: true } });
        return { receipt };
      });
      if ('error' in result) return reply.code(result.error === 'EXISTS' ? 409 : 413).send(error(request, result.error === 'EXISTS' ? 'RECEIPT_EXISTS' : 'RECEIPT_QUOTA', result.error === 'EXISTS' ? 'Já recebemos um comprovante para este Pix.' : 'A loja atingiu o limite de comprovantes. Entre em contato com a loja.'));
      return reply.code(200).send(result);
    });

    async function merchantStore(request: FastifyRequest) {
      const token = request.cookies[environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session'];
      const session = token ? await auth.findActiveSession(hash(token), new Date()) : null;
      const context = session ? await catalog.resolveStoreContext(session.userId, session.sessionId) : null;
      return context?.storeId ?? null;
    }
    app.get<{ Params: { orderId: string } }>('/orders/:orderId/payment-receipts', async (request, reply) => {
      const storeId = await merchantStore(request);
      if (!storeId) return reply.code(401).send(error(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
      if (!validId(request.params.orderId)) return reply.code(404).send(error(request, 'ORDER_NOT_FOUND', 'Pedido não encontrado.'));
      const items = await database.paymentReceipt.findMany({ where: { payment: { session: { publicId: request.params.orderId, checkout: { storeId } } } }, select: { createdAt: true, mimeType: true, sizeBytes: true, payment: { select: { publicId: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
      return { items: items.map(({ payment, ...item }) => ({ ...item, paymentId: payment.publicId })) };
    });
    app.get<{ Params: { orderId: string; paymentId: string } }>('/orders/:orderId/payment-receipts/:paymentId', async (request, reply) => {
      const storeId = await merchantStore(request);
      if (!storeId) return reply.code(401).send(error(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
      if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(error(request, 'RECEIPT_UNAVAILABLE', 'Comprovante temporariamente indisponível.'));
      const { orderId, paymentId } = request.params;
      if (!validId(orderId) || !validId(paymentId)) return reply.code(404).send(error(request, 'RECEIPT_NOT_FOUND', 'Comprovante não encontrado.'));
      const receipt = await database.paymentReceipt.findFirst({ where: { payment: { publicId: paymentId, session: { publicId: orderId, checkout: { storeId } } } }, select: { contentEncrypted: true, mimeType: true } });
      if (!receipt) return reply.code(404).send(error(request, 'RECEIPT_NOT_FOUND', 'Comprovante não encontrado.'));
      const extension = receipt.mimeType === 'application/pdf' ? 'pdf' : 'webp';
      const content = Buffer.from(decryptSecret(receipt.contentEncrypted, environment.APP_ENCRYPTION_KEY), 'base64');
      return reply.header('Content-Disposition', `attachment; filename="comprovante-${paymentId}.${extension}"`).header('X-Content-Type-Options', 'nosniff').header('Content-Security-Policy', "default-src 'none'; sandbox").type('application/octet-stream').send(content);
    });
    done();
  });
}
