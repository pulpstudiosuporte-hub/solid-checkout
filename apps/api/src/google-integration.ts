import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { AuthRepository } from './auth-repository.js';
import { decryptSecret, encryptSecret } from './shopify-crypto.js';

export type GoogleConfig = { mode: 'direct' | 'gtm'; measurementId: string; propertyId: string; adsId: string; conversionLabel: string; containerId: string };
export const emptyGoogleConfig: GoogleConfig = { mode: 'direct', measurementId: '', propertyId: '', adsId: '', conversionLabel: '', containerId: '' };

export function parseGoogleConfig(input: unknown): GoogleConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Informe a configuração do Google.');
  const data = input as Record<string, unknown>;
  if (data.mode !== 'direct' && data.mode !== 'gtm') throw new Error('Escolha como instalar as tags.');
  const field = (name: string) => {
    const value = data[name];
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string' || value.length > 128) throw new Error('Confira os identificadores informados.');
    return value.trim();
  };
  const config = { mode: data.mode, measurementId: field('measurementId').toUpperCase(), propertyId: field('propertyId'), adsId: field('adsId').toUpperCase(), conversionLabel: field('conversionLabel'), containerId: field('containerId').toUpperCase() } as GoogleConfig;
  if (config.propertyId && !/^\d{1,15}$/.test(config.propertyId)) throw new Error('O ID da propriedade GA4 deve conter apenas números.');
  if (config.mode === 'gtm') {
    if (!/^GTM-[A-Z0-9]{4,20}$/.test(config.containerId)) throw new Error('Informe um ID de contêiner no formato GTM-XXXXXXX.');
    if (config.measurementId || config.adsId || config.conversionLabel) throw new Error('Configure GA4 e Ads dentro do Tag Manager ao usar um contêiner.');
  } else {
    if (config.containerId) throw new Error('Escolha apenas uma forma de instalação para evitar eventos duplicados.');
    if (!config.measurementId && !config.adsId) throw new Error('Informe o ID do GA4 ou do Google Ads.');
    if (config.measurementId && !/^G-[A-Z0-9]{4,20}$/.test(config.measurementId)) throw new Error('Use o ID de medição GA4 (G-XXXXXXXXXX). IDs UA não são compatíveis.');
    if (config.adsId && !/^AW-\d{5,20}$/.test(config.adsId)) throw new Error('Informe o ID do Google Ads no formato AW-123456789.');
    if (Boolean(config.adsId) !== Boolean(config.conversionLabel) || (config.conversionLabel && !/^[A-Za-z0-9_-]{1,100}$/.test(config.conversionLabel))) throw new Error('Informe o ID e o rótulo da ação de conversão do Google Ads.');
  }
  return config;
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const equal = (a: string, b: string) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerGoogleIntegration(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const prefix = environment.NODE_ENV === 'production' ? '__Host-' : '';
  const context = async (request: FastifyRequest, mutate = false) => {
    const cookie = request.cookies[`${prefix}solid_session`];
    const current = cookie ? await auth.findActiveSession(hash(cookie), new Date()) : null;
    if (!current || (current.user.mfaEnabled && !current.mfaVerifiedAt)) return null;
    if (mutate) {
      const csrf = request.cookies[`${prefix}solid_csrf`];
      const header = request.headers['x-csrf-token'];
      if (!csrf || typeof header !== 'string' || !environment.CORS_ORIGINS.includes(request.headers.origin ?? '') || !equal(hash(csrf), hash(header)) || !equal(hash(header), current.csrfTokenHash)) return null;
    }
    const session = await db.session.findFirst({ where: { id: current.sessionId, userId: current.userId, revokedAt: null }, select: { activeStoreId: true } });
    if (!session?.activeStoreId) return null;
    const member = await db.storeMember.findUnique({ where: { storeId_userId: { storeId: session.activeStoreId, userId: current.userId } }, select: { role: true, store: { select: { publicId: true } } } });
    const expectedStore = (request.query as { store?: unknown }).store;
    if ((mutate && typeof expectedStore !== 'string') || (expectedStore !== undefined && expectedStore !== member?.store.publicId)) return null;
    return member ? { storeId: session.activeStoreId, userId: current.userId, writable: ['OWNER', 'ADMIN'].includes(member.role) } : null;
  };
  const readConfig = async (storeId: string) => {
    const record = await db.gatewayConnection.findUnique({ where: { storeId_provider: { storeId, provider: 'GOOGLE' } }, select: { active: true, publicKeyEncrypted: true, updatedAt: true } });
    if (!record?.active) return null;
    if (!environment.APP_ENCRYPTION_KEY) throw new Error('Criptografia indisponível.');
    return { config: parseGoogleConfig(JSON.parse(decryptSecret(record.publicKeyEncrypted, environment.APP_ENCRYPTION_KEY))), updatedAt: record.updatedAt };
  };

  app.get('/integrations/google', async (request, reply) => {
    const ctx = await context(request);
    if (!ctx) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Entre na conta e selecione uma loja.'));
    const saved = await readConfig(ctx.storeId);
    return reply.header('cache-control', 'private, no-store').send({ configured: Boolean(saved), writable: ctx.writable, config: saved?.config ?? emptyGoogleConfig, updatedAt: saved?.updatedAt ?? null });
  });
  app.put('/integrations/google', { config: { rateLimit: { max: 15, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const ctx = await context(request, true);
    if (!ctx?.writable) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Somente proprietários e administradores podem configurar esta integração.'));
    if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Configuração temporariamente indisponível.'));
    let config: GoogleConfig;
    try { config = parseGoogleConfig(request.body); } catch (error) { return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', (error as Error).message)); }
    const publicKeyEncrypted = encryptSecret(JSON.stringify(config), environment.APP_ENCRYPTION_KEY);
    const record = await db.$transaction(async tx => {
      const saved = await tx.gatewayConnection.upsert({ where: { storeId_provider: { storeId: ctx.storeId, provider: 'GOOGLE' } }, create: { storeId: ctx.storeId, provider: 'GOOGLE', publicKeyEncrypted, apiKeyEncrypted: encryptSecret('google-browser-tags', environment.APP_ENCRYPTION_KEY!), verifiedAt: null }, update: { publicKeyEncrypted, active: true, verifiedAt: null }, select: { updatedAt: true } });
      await tx.auditLog.create({ data: { storeId: ctx.storeId, actorType: 'USER', actorUserId: ctx.userId, action: 'integration.google_configured', targetType: 'integration', targetId: 'GOOGLE', metadata: { mode: config.mode, requestId: request.id } } });
      return saved;
    });
    return reply.header('cache-control', 'private, no-store').send({ configured: true, writable: true, config, updatedAt: record.updatedAt });
  });
  app.delete('/integrations/google', async (request, reply) => {
    const ctx = await context(request, true);
    if (!ctx?.writable) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    await db.$transaction(async tx => {
      await tx.gatewayConnection.updateMany({ where: { storeId: ctx.storeId, provider: 'GOOGLE' }, data: { active: false } });
      await tx.auditLog.create({ data: { storeId: ctx.storeId, actorType: 'USER', actorUserId: ctx.userId, action: 'integration.google_disconnected', targetType: 'integration', targetId: 'GOOGLE' } });
    });
    return reply.code(204).send();
  });

  app.get<{ Params: { sessionId: string } }>('/public/checkout-sessions/:sessionId/tracking/google', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const token = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{16,512})$/)?.[1];
    if (!token || !/^[a-zA-Z0-9_-]{1,64}$/.test(request.params.sessionId)) return reply.code(401).send(errorBody(request, 'INVALID_SESSION', 'Sessão inválida.'));
    const session = await db.checkoutSession.findFirst({
      where: { publicId: request.params.sessionId, tokenHash: hash(token), OR: [{ expiresAt: { gt: new Date() } }, { completedAt: { gte: new Date(Date.now() - 7 * 86400_000) } }] },
      select: { publicId: true, trackingParameters: true, totalCents: true, discountCents: true, paymentDiscountCents: true, shippingPriceCents: true, shippingMethodName: true, currency: true, quantity: true, unitPriceCents: true,
        checkout: { select: { publicId: true, storeId: true, store: { select: { publicId: true } }, product: { select: { publicId: true, checkoutTitle: true } } } },
        items: { select: { titleSnapshot: true, unitPriceCents: true, quantity: true, isOrderBump: true, product: { select: { publicId: true } } } },
        paymentAttempts: { where: { status: 'PAID' }, orderBy: { paidAt: 'desc' }, take: 1, select: { amountCents: true } } },
    });
    if (!session) return reply.code(404).send(errorBody(request, 'SESSION_NOT_FOUND', 'Sessão indisponível.'));
    const saved = await readConfig(session.checkout.storeId);
    if (!saved) return reply.header('cache-control', 'private, no-store').send({ config: null });
    const paid = session.paymentAttempts[0];
    const gross = session.totalCents + session.shippingPriceCents - session.discountCents;
    const rows = session.items.some(item => !item.isOrderBump) ? session.items : [...(session.checkout.product ? [{ titleSnapshot: session.checkout.product.checkoutTitle, unitPriceCents: session.unitPriceCents, quantity: session.quantity, product: session.checkout.product }] : []), ...session.items];
    const valueCents = Math.max(0, (paid?.amountCents ?? gross) - session.shippingPriceCents);
    const listCents = rows.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    // Allocate discounts across items so GA4's item revenue matches the order value (shipping excluded).
    let remaining = valueCents;
    const items = rows.map((item, index) => {
      const cents = index === rows.length - 1 ? remaining : Math.min(remaining, Math.round(valueCents * item.unitPriceCents * item.quantity / Math.max(1, listCents)));
      remaining -= cents;
      return { item_id: item.product.publicId, item_name: item.titleSnapshot.slice(0, 100), price: cents / Math.max(1, item.quantity) / 100, quantity: item.quantity };
    });
    const source = session.trackingParameters && typeof session.trackingParameters === 'object' ? session.trackingParameters as Record<string, unknown> : {};
    const attribution = Object.fromEntries(['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].flatMap(key => typeof source[key] === 'string' && /^[\p{L}\p{N}_ .~-]{1,200}$/u.test(source[key]) ? [[key, source[key]]] : []));
    return reply.header('cache-control', 'private, no-store').send({ attribution, config: saved.config, scope: session.checkout.store.publicId, checkoutId: session.checkout.publicId, purchase: Boolean(paid), transactionId: session.publicId, orderValue: Math.max(0, paid?.amountCents ?? gross) / 100, ecommerce: { currency: session.currency, value: valueCents / 100, shipping: session.shippingPriceCents / 100, items } });
  });
}
