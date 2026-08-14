import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from './auth-repository.js';
import type { CatalogRepository, CheckoutInput, ProductInput, StoreContext } from './catalog-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const text = (value: unknown, max: number): string | null => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
const optionalText = (value: unknown, max: number): string | undefined | null => value === undefined || value === null || value === '' ? undefined : text(value, max);
const integer = (value: unknown, min: number, max: number): number | null => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;

export function registerCatalogRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, catalog: CatalogRepository): void {
  const secure = environment.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';
  const allowedOrigin = (request: FastifyRequest): boolean => typeof request.headers.origin === 'string' && environment.CORS_ORIGINS.includes(request.headers.origin);
  const authenticate = async (request: FastifyRequest, mutation = false): Promise<StoreContext | null> => {
    const token = request.cookies[sessionCookie];
    if (!token) return null;
    const session = await auth.findActiveSession(sha256(token), new Date());
    if (!session) return null;
    if (mutation) {
      const cookieToken = request.cookies[csrfCookie]; const headerToken = request.headers['x-csrf-token'];
      if (!allowedOrigin(request) || !cookieToken || typeof headerToken !== 'string' || !safeEqual(cookieToken, headerToken) || !safeEqual(sha256(headerToken), session.csrfTokenHash)) return null;
    }
    return catalog.resolveStoreContext(session.userId, session.sessionId);
  };
  const canWrite = (context: StoreContext): boolean => context.role === 'OWNER' || context.role === 'ADMIN';

  app.get<{ Querystring: Record<string, string | undefined> }>('/products', async (request, reply) => {
    const context = await authenticate(request);
    if (!context) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const page = Number(request.query.page ?? '1'); const pageSize = Number(request.query.pageSize ?? '20');
    const search = request.query.search?.trim(); const status = request.query.status; const source = request.query.source?.toUpperCase();
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || (search && search.length > 120) || (status && status !== 'active' && status !== 'inactive') || (source && source !== 'MANUAL' && source !== 'SHOPIFY')) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Filtros de produtos inválidos.'));
    const result = await catalog.listProducts(context, { page, pageSize, ...(search ? { search } : {}), ...(status ? { status: status as 'active' | 'inactive' } : {}), ...(source ? { source: source as 'MANUAL' | 'SHOPIFY' } : {}) });
    return reply.send({ ...result, page, pageSize, pages: Math.max(1, Math.ceil(result.total / pageSize)) });
  });

  app.post<{ Body: Record<string, unknown> }>('/products', async (request, reply) => {
    const context = await authenticate(request, true);
    if (!context) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    if (!canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const title = text(request.body?.title, 240); const description = optionalText(request.body?.description, 10_000); const imageUrl = optionalText(request.body?.imageUrl, 2048);
    const priceCents = integer(request.body?.priceCents, 0, 2_000_000_000); const compareAtCents = request.body?.compareAtCents == null ? undefined : integer(request.body.compareAtCents, 1, 2_000_000_000);
    const stockQuantity = request.body?.stockQuantity == null ? undefined : integer(request.body.stockQuantity, 0, 2_000_000_000); const maxPerOrder = request.body?.maxPerOrder === undefined ? 10 : integer(request.body.maxPerOrder, 1, 1000);
    if (!title || description === null || imageUrl === null || priceCents === null || compareAtCents === null || stockQuantity === null || maxPerOrder === null || (compareAtCents !== undefined && compareAtCents <= priceCents) || (imageUrl && !imageUrl.startsWith('https://'))) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Dados do produto inválidos.'));
    const input: ProductInput = { title, priceCents, trackInventory: request.body?.trackInventory === true, maxPerOrder, active: request.body?.active !== false, ...(description ? { description } : {}), ...(imageUrl ? { imageUrl } : {}), ...(compareAtCents !== undefined ? { compareAtCents } : {}), ...(stockQuantity !== undefined ? { stockQuantity } : {}) };
    return reply.code(201).send({ product: await catalog.createProduct(context, input, request.id) });
  });

  app.get('/checkouts', async (request, reply) => {
    const context = await authenticate(request);
    if (!context) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    return reply.send({ items: await catalog.listCheckouts(context) });
  });

  app.post<{ Body: Record<string, unknown> }>('/checkouts', async (request, reply) => {
    const context = await authenticate(request, true);
    if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const name = text(request.body?.name, 120); const slug = text(request.body?.slug, 80); const productPublicId = text(request.body?.productId, 32);
    const draftConfig = request.body?.draftConfig === undefined ? {} : request.body.draftConfig;
    if (!name || !slug || !productPublicId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || typeof draftConfig !== 'object' || draftConfig === null || Array.isArray(draftConfig) || JSON.stringify(draftConfig).length > 100_000) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Dados do checkout inválidos.'));
    const input: CheckoutInput = { name, slug, productPublicId, draftConfig: draftConfig as Record<string, unknown> };
    const checkout = await catalog.createCheckout(context, input, request.id);
    if (!checkout) return reply.code(404).send(errorBody(request, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.'));
    return reply.code(201).send({ checkout });
  });
}
