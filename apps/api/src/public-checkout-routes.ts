import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CatalogRepository } from './catalog-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const slug = (value: unknown): string | null => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80 ? value : null;
const publicId = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z0-9_-]{8,32}$/.test(value) ? value : null;
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerPublicCheckoutRoutes(app: FastifyInstance, catalog: CatalogRepository): void {
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
}
