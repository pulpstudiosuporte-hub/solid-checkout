import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { CatalogRepository } from './catalog-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const slug = (value: unknown): string | null => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80 ? value : null;
const publicId = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z0-9_-]{8,32}$/.test(value) ? value : null;
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const validProxySignature = (query: Record<string, string | string[] | undefined>, secret: string): boolean => {
  const signature = query.signature; if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const message = Object.entries(query).filter(([key]) => key !== 'signature').map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value ?? ''}`).sort().join('');
  const expected = createHmac('sha256', secret).update(message).digest('hex');
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
};

export function registerPublicCheckoutRoutes(app: FastifyInstance, environment: AppEnvironment, catalog: CatalogRepository): void {
  app.get<{ Params: { storeSlug: string; checkoutSlug: string } }>('/public/checkouts/:storeSlug/:checkoutSlug', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request, reply) => {
    const storeSlug = slug(request.params.storeSlug); const checkoutSlug = slug(request.params.checkoutSlug);
    if (!storeSlug || !checkoutSlug) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Checkout inválido.'));
    const checkout = await catalog.getPublicCheckout(storeSlug, checkoutSlug);
    if (!checkout) return reply.code(404).send(errorBody(request, 'CHECKOUT_NOT_FOUND', 'Checkout indisponível.'));
    return reply.header('cache-control', 'public, max-age=30, stale-while-revalidate=60').send({ checkout });
  });

  app.post<{ Params: { storeSlug: string; checkoutSlug: string }; Body: Record<string, unknown> }>('/public/checkouts/:storeSlug/:checkoutSlug/sessions', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const storeSlug = slug(request.params.storeSlug); const checkoutSlug = slug(request.params.checkoutSlug);
    const quantity = request.body?.quantity === undefined ? 1 : request.body.quantity;
    const variantPublicId = request.body?.variantId === undefined ? undefined : publicId(request.body.variantId);
    if (!storeSlug || !checkoutSlug || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000 || request.body?.variantId !== undefined && !variantPublicId) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Itens do checkout inválidos.'));
    const token = randomBytes(32).toString('base64url');
    const session = await catalog.createPublicCheckoutSession({ storeSlug, checkoutSlug, quantity, tokenHash: sha256(token), source: 'DIRECT', expiresAt: new Date(Date.now() + 30 * 60_000), ...(variantPublicId ? { variantPublicId } : {}) });
    if (!session) return reply.code(409).send(errorBody(request, 'CHECKOUT_UNAVAILABLE', 'Produto, variante ou estoque indisponível.'));
    return reply.header('cache-control', 'no-store').code(201).send({ session, token });
  });

  app.get<{ Params: { sessionId: string }; Headers: { authorization?: string } }>('/public/checkout-sessions/:sessionId', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const sessionId = publicId(request.params.sessionId);
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!sessionId || token.length < 32 || token.length > 128) return reply.code(401).send(errorBody(request, 'INVALID_SESSION', 'Sessão inválida.'));
    const session = await catalog.getPublicCheckoutSession(sessionId, sha256(token), new Date());
    if (!session) return reply.code(404).send(errorBody(request, 'SESSION_NOT_FOUND', 'Sessão expirada ou indisponível.'));
    return reply.header('cache-control', 'no-store').send({ session });
  });

  app.post<{ Querystring: Record<string, string | string[] | undefined>; Body: Record<string, unknown> }>('/integrations/shopify/proxy/checkout-session', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!environment.SHOPIFY_CLIENT_SECRET || !validProxySignature(request.query, environment.SHOPIFY_CLIENT_SECRET)) return reply.code(401).send(errorBody(request, 'INVALID_PROXY_SIGNATURE', 'Solicitação Shopify inválida.'));
    const timestamp = typeof request.query.timestamp === 'string' ? Number(request.query.timestamp) : 0;
    const shopDomain = typeof request.query.shop === 'string' && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(request.query.shop) ? request.query.shop : null;
    const checkoutSlug = slug(request.body?.checkoutSlug); const rawLines = Array.isArray(request.body?.lines) ? request.body.lines : [];
    const lines = rawLines.flatMap(value => { if (typeof value !== 'object' || value === null) return []; const line = value as Record<string, unknown>; return typeof line.variantId === 'string' && /^\d{1,20}$/.test(line.variantId) && typeof line.quantity === 'number' && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 1000 ? [{ variantId: line.variantId, quantity: line.quantity }] : []; });
    if (!shopDomain || !checkoutSlug || rawLines.length < 1 || rawLines.length > 50 || lines.length !== rawLines.length || !Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Carrinho Shopify inválido.'));
    const token = randomBytes(32).toString('base64url');
    const session = await catalog.createShopifyCartSession({ shopDomain, checkoutSlug, lines, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) });
    if (!session) return reply.code(409).send(errorBody(request, 'CHECKOUT_UNAVAILABLE', 'Checkout, produto ou estoque indisponível.'));
    return reply.header('cache-control', 'no-store').code(201).send({ session, token });
  });
}
