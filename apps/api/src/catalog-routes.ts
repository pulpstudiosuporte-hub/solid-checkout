import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from './auth-repository.js';
import type { CatalogRepository, CheckoutConfigInput, CheckoutInput, ProductInput, ShippingMethodInput, StoreContext } from './catalog-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const text = (value: unknown, max: number): string | null => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
const optionalText = (value: unknown, max: number): string | undefined | null => value === undefined || value === null || value === '' ? undefined : text(value, max);
const integer = (value: unknown, min: number, max: number): number | null => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
const hexColor = (value: unknown, fallback: string): string | null => { const candidate = value ?? fallback; return typeof candidate === 'string' && /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toLowerCase() : null; };
const checkoutConfig = (value: unknown): CheckoutConfigInput | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>; const result: Record<string, unknown> = {};
  const enums: Record<string, readonly string[]> = { template: ['minimal', 'conversion', 'compact', 'showcase'], font: ['Plus Jakarta Sans', 'Poppins', 'Montserrat', 'DM Sans', 'Roboto', 'Inter', 'Arial', 'Georgia'], language: ['pt-BR', 'en-US', 'es'], currency: ['BRL', 'USD', 'EUR'], buttonEffect: ['lift', 'pulse', 'none'] };
  const limits: Record<string, number> = { logoText: 24, timerText: 80, title: 120, subtitle: 300, buttonText: 60, footerText: 300 };
  const booleans = ['secureHeader', 'timer', 'showCoupon', 'showBump', 'showSummary'];
  const colors = ['primary', 'pageBg', 'cardBg', 'textColor', 'borderColor', 'inputBg'];
  for (const [key, allowed] of Object.entries(enums)) { if (typeof input[key] !== 'string' || !allowed.includes(input[key])) return null; result[key] = input[key]; }
  for (const [key, max] of Object.entries(limits)) { if (typeof input[key] !== 'string' || input[key].trim().length < 1 || input[key].trim().length > max) return null; result[key] = input[key].trim(); }
  for (const key of booleans) { if (typeof input[key] !== 'boolean') return null; result[key] = input[key]; }
  for (const key of colors) { if (typeof input[key] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(input[key])) return null; result[key] = input[key].toLowerCase(); }
  for (const [key, fallback] of [['pageTextColor', '#17171a'], ['headerTextColor', '#17171a'], ['buttonTextColor', '#ffffff']] as const) { const color = input[key] ?? fallback; if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) return null; result[key] = color.toLowerCase(); }
  const buttonBgColor = hexColor(input.buttonBgColor, typeof input.primary === 'string' ? input.primary : '#7357e9'); if (buttonBgColor === null) return null; result.buttonBgColor = buttonBgColor;
  for (const [key, fallback] of [['timerBgColor', '#151c2c'], ['timerTextColor', '#ffffff'], ['timerNumberColor', '#ff515a']] as const) { const color = input[key] ?? fallback; if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) return null; result[key] = color.toLowerCase(); }
  const radius = integer(input.radius, 0, 28); const timerMinutes = integer(input.timerMinutes, 1, 60); if (radius === null || timerMinutes === null) return null;
  result.radius = radius; result.timerMinutes = timerMinutes;
  const contentWidth = input.contentWidth === undefined ? 1120 : integer(input.contentWidth, 650, 1280); if (contentWidth === null) return null; result.contentWidth = contentWidth;
  const timerRadius = input.timerRadius === undefined ? 14 : integer(input.timerRadius, 0, 30); if (timerRadius === null) return null; result.timerRadius = timerRadius;
  const timerStyle = input.timerStyle ?? 'bar'; if (typeof timerStyle !== 'string' || !['bar', 'pill', 'outline'].includes(timerStyle)) return null; result.timerStyle = timerStyle;
  for (const key of ['privacyUrl', 'termsUrl', 'successUrl']) { const url = input[key]; if (typeof url !== 'string' || url.length > 2048 || url && url !== '#' && !url.startsWith('https://')) return null; result[key] = url; }
  const layout = input.layout ?? 'split'; if (typeof layout !== 'string' || !['split', 'centered'].includes(layout)) return null; result.layout = layout;
  for (const [key, fallback, max] of [['secureText', 'Pagamento 100% seguro', 60], ['eyebrow', 'FINALIZE SEU PEDIDO', 60], ['summaryTitle', 'Resumo da compra', 80]] as const) { const value = input[key] ?? fallback; if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > max) return null; result[key] = value.trim(); }
  for (const [key, fallback] of [['heroEnabled', false], ['showProgress', true]] as const) { const value = input[key] ?? fallback; if (typeof value !== 'boolean') return null; result[key] = value; }
  const progressStyle = input.progressStyle ?? 'outline'; if (typeof progressStyle !== 'string' || !['outline', 'solid'].includes(progressStyle)) return null; result.progressStyle = progressStyle;
  for (const [key, fallback] of [['progressActiveColor', '#7357e9'], ['progressInactiveColor', '#ffffff'], ['progressActiveTextColor', '#ffffff'], ['progressLabelColor', '#777780'], ['progressActiveLabelColor', '#17171a']] as const) { const color = hexColor(input[key], fallback); if (color === null) return null; result[key] = color; }
  const showTrust = input.showTrust ?? true; if (typeof showTrust !== 'boolean') return null; result.showTrust = showTrust;
  for (const [key, fallback, max] of [['trustBenefit1', 'Pagamento protegido', 80], ['trustBenefit2', 'Confirmação automática', 80], ['trustBenefit3', 'Seus dados estão seguros', 80], ['testimonialName', 'Cliente verificado', 80], ['testimonialText', 'Compra simples, rápida e segura.', 240]] as const) { const value = input[key] ?? fallback; if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > max) return null; result[key] = value.trim(); }
  if (input.testimonials !== undefined) {
    if (!Array.isArray(input.testimonials) || input.testimonials.length > 50) return null;
    const testimonials = [] as { id: string; name: string; text: string; imageUrl: string; rating: number }[]; const ids = new Set<string>();
    for (const value of input.testimonials) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
      const testimonial = value as Record<string, unknown>; const id = text(testimonial.id, 64); const name = text(testimonial.name, 80); const body = text(testimonial.text, 240); const rating = integer(testimonial.rating, 1, 5); const imageUrl = testimonial.imageUrl ?? '';
      if (!id || ids.has(id) || !/^[A-Za-z0-9_-]+$/.test(id) || !name || !body || rating === null || typeof imageUrl !== 'string' || imageUrl.length > 2048 || imageUrl && !imageUrl.startsWith('https://')) return null;
      ids.add(id); testimonials.push({ id, name, text: body, imageUrl, rating });
    }
    result.testimonials = testimonials;
  }
  const headerBg = input.headerBg ?? '#ffffff'; if (typeof headerBg !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(headerBg)) return null; result.headerBg = headerBg.toLowerCase();
  const heroHeight = input.heroHeight === undefined ? 220 : integer(input.heroHeight, 120, 420); if (heroHeight === null) return null; result.heroHeight = heroHeight;
  for (const key of ['logoUrl', 'heroImageUrl', 'heroMobileImageUrl', 'summaryBannerUrl']) { const url = input[key] ?? ''; if (typeof url !== 'string' || url.length > 2048 || url && !url.startsWith('https://')) return null; result[key] = url; }
  const summaryBannerFit = input.summaryBannerFit ?? 'cover'; if (typeof summaryBannerFit !== 'string' || !['cover', 'contain'].includes(summaryBannerFit)) return null; result.summaryBannerFit = summaryBannerFit;
  const blockOrder = input.blockOrder ?? ['hero', 'timer', 'progress', 'content'];
  const allowedBlocks = ['hero', 'timer', 'progress', 'content'];
  if (!Array.isArray(blockOrder) || blockOrder.length !== allowedBlocks.length || new Set(blockOrder).size !== allowedBlocks.length || blockOrder.some(value => typeof value !== 'string' || !allowedBlocks.includes(value))) return null;
  result.blockOrder = blockOrder;
  const customElements = input.customElements ?? [];
  if (!Array.isArray(customElements) || customElements.length > 20) return null;
  const customIds = new Set<string>();
  const sanitizedElements: Array<Record<string, unknown>> = [];
  for (const value of customElements) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const element = value as Record<string, unknown>;
    const id = text(element.id, 64); const title = text(element.title, 100); const body = text(element.text, 500);
    const slot = integer(element.slot, 0, 4); const rating = element.rating === undefined ? 5 : integer(element.rating, 1, 5);
    const allowedTypes = ['announcement', 'banner', 'testimonial', 'timer', 'video', 'gallery', 'reviews', 'guarantee', 'faq', 'list', 'progress', 'sales', 'seal'];
    const enabled = element.enabled === undefined ? true : element.enabled; const display = element.display ?? 'fixed'; const device = element.device ?? 'all'; const align = element.align ?? 'left';
    const fontSize = element.fontSize === undefined ? 14 : integer(element.fontSize, 10, 32); const radius = element.radius === undefined ? 12 : integer(element.radius, 0, 40); const paddingY = element.paddingY === undefined ? 16 : integer(element.paddingY, 0, 64); const paddingX = element.paddingX === undefined ? 18 : integer(element.paddingX, 0, 64); const durationMinutes = element.durationMinutes === undefined ? 10 : integer(element.durationMinutes, 1, 120); const progress = element.progress === undefined ? 72 : integer(element.progress, 1, 100); const imageHeight = element.imageHeight === undefined ? 220 : integer(element.imageHeight, 48, 520); const widthPercent = element.widthPercent === undefined ? 100 : integer(element.widthPercent, 25, 100); const horizontalAlign = element.horizontalAlign ?? 'center';
    const textColor = hexColor(element.textColor, '#17171a'); const backgroundColor = hexColor(element.backgroundColor, '#ffffff'); const iconColor = hexColor(element.iconColor, '#7357e9'); const iconBackgroundColor = hexColor(element.iconBackgroundColor, '#f0ebff'); const imageUrl = element.imageUrl ?? ''; const mediaUrl = element.mediaUrl ?? ''; const linkUrl = element.linkUrl ?? ''; const imageFit = element.imageFit ?? 'cover'; const imageAlt = optionalText(element.imageAlt, 160);
    if (!id || customIds.has(id) || !/^[A-Za-z0-9_-]+$/.test(id) || typeof element.type !== 'string' || !allowedTypes.includes(element.type) || !title || !body || slot === null || rating === null || typeof enabled !== 'boolean' || typeof display !== 'string' || !['fixed', 'carousel'].includes(display) || typeof device !== 'string' || !['all', 'desktop', 'mobile'].includes(device) || typeof align !== 'string' || !['left', 'center', 'right'].includes(align) || fontSize === null || radius === null || paddingY === null || paddingX === null || durationMinutes === null || progress === null || imageHeight === null || widthPercent === null || ![25, 33, 50, 66, 75, 100].includes(widthPercent) || typeof horizontalAlign !== 'string' || !['left', 'center', 'right'].includes(horizontalAlign) || typeof imageFit !== 'string' || !['cover', 'contain'].includes(imageFit) || imageAlt === null || textColor === null || backgroundColor === null || iconColor === null || iconBackgroundColor === null || [imageUrl, mediaUrl, linkUrl].some(url => typeof url !== 'string' || url.length > 2048 || url && !url.startsWith('https://'))) return null;
    customIds.add(id); sanitizedElements.push({ id, type: element.type, slot, title, text: body, rating, enabled, display, device, align, widthPercent, horizontalAlign, fontSize, radius, paddingY, paddingX, durationMinutes, progress, imageHeight, imageFit, imageAlt: imageAlt ?? '', textColor, backgroundColor, iconColor, iconBackgroundColor, imageUrl, mediaUrl, linkUrl });
  }
  result.customElements = sanitizedElements;
  const elementEditMode = input.elementEditMode ?? 'guided'; if (typeof elementEditMode !== 'string' || !['guided', 'free'].includes(elementEditMode)) return null; result.elementEditMode = elementEditMode;
  const globalStyle = input.elementGlobalStyle ?? { radius: 12, spacing: 12, fontScale: 100 };
  if (typeof globalStyle !== 'object' || globalStyle === null || Array.isArray(globalStyle)) return null;
  const globalInput = globalStyle as Record<string, unknown>; const globalRadius = integer(globalInput.radius, 0, 32); const globalSpacing = integer(globalInput.spacing, 4, 40); const globalFontScale = integer(globalInput.fontScale, 80, 130);
  if (globalRadius === null || globalSpacing === null || globalFontScale === null) return null; result.elementGlobalStyle = { radius: globalRadius, spacing: globalSpacing, fontScale: globalFontScale };
  const bumpProductId = input.orderBumpProductId;
  if (bumpProductId !== undefined && (typeof bumpProductId !== 'string' || bumpProductId.length > 32 || bumpProductId && !/^[A-Za-z0-9_-]+$/.test(bumpProductId))) return null;
  result.orderBumpProductId = typeof bumpProductId === 'string' ? bumpProductId : '';
  for (const [key, max] of Object.entries({ orderBumpTitle: 120, orderBumpMessage: 300 })) {
    const value = input[key]; if (value !== undefined && (typeof value !== 'string' || value.length > max)) return null;
    result[key] = typeof value === 'string' ? value.trim() : '';
  }
  if (input.orderBumps !== undefined) {
    if (!Array.isArray(input.orderBumps) || input.orderBumps.length > 12) return null;
    const productIds = new Set<string>();
    const orderBumps = [] as { productId: string; title: string; message: string }[];
    for (const value of input.orderBumps) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
      const bump = value as Record<string, unknown>;
      if (typeof bump.productId !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(bump.productId) || productIds.has(bump.productId) || (bump.title !== undefined && (typeof bump.title !== 'string' || bump.title.length > 120)) || (bump.message !== undefined && (typeof bump.message !== 'string' || bump.message.length > 300))) return null;
      productIds.add(bump.productId); orderBumps.push({ productId: bump.productId, title: typeof bump.title === 'string' ? bump.title.trim() : '', message: typeof bump.message === 'string' ? bump.message.trim() : '' });
    }
    result.orderBumps = orderBumps;
  }
  return result;
};

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

  app.get<{ Params: { productId: string } }>('/products/:productId', async (request, reply) => {
    const context = await authenticate(request);
    if (!context) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const productId = text(request.params.productId, 32);
    if (!productId) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Produto inválido.'));
    const product = await catalog.getProduct(context, productId);
    if (!product) return reply.code(404).send(errorBody(request, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.'));
    return reply.send({ product });
  });

  app.post<{ Body: Record<string, unknown> }>('/products', async (request, reply) => {
    const context = await authenticate(request, true);
    if (!context) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    if (!canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const title = text(request.body?.title, 240); const description = optionalText(request.body?.description, 10_000); const imageUrl = optionalText(request.body?.imageUrl, 2048); const fulfillmentType = request.body?.fulfillmentType === 'DIGITAL' ? 'DIGITAL' : request.body?.fulfillmentType === undefined || request.body?.fulfillmentType === 'PHYSICAL' ? 'PHYSICAL' : null; const externalDeliveryUrl = optionalText(request.body?.externalDeliveryUrl, 2048);
    const priceCents = integer(request.body?.priceCents, 0, 2_000_000_000); const compareAtCents = request.body?.compareAtCents == null ? undefined : integer(request.body.compareAtCents, 1, 2_000_000_000);
    const stockQuantity = request.body?.stockQuantity == null ? undefined : integer(request.body.stockQuantity, 0, 2_000_000_000); const maxPerOrder = request.body?.maxPerOrder === undefined ? 10 : integer(request.body.maxPerOrder, 1, 1000);
    const allowedImage = !imageUrl || imageUrl.startsWith('https://') || (environment.API_PUBLIC_URL && imageUrl.startsWith(`${environment.API_PUBLIC_URL.replace(/\/$/, '')}/media/`));
    if (!title || description === null || imageUrl === null || priceCents === null || compareAtCents === null || stockQuantity === null || maxPerOrder === null || (compareAtCents !== undefined && compareAtCents <= priceCents) || !allowedImage) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Dados do produto inválidos.'));
    const validDeliveryUrl = !externalDeliveryUrl || externalDeliveryUrl.startsWith('https://');
    if (!fulfillmentType || externalDeliveryUrl === null || !validDeliveryUrl || fulfillmentType === 'DIGITAL' && !externalDeliveryUrl || fulfillmentType === 'PHYSICAL' && externalDeliveryUrl) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Dados do produto inválidos.'));
    const input: ProductInput = { title, priceCents, fulfillmentType, trackInventory: fulfillmentType === 'DIGITAL' ? false : request.body?.trackInventory === true, maxPerOrder, active: request.body?.active !== false, ...(description ? { description } : {}), ...(imageUrl ? { imageUrl } : {}), ...(externalDeliveryUrl ? { externalDeliveryUrl } : {}), ...(compareAtCents !== undefined ? { compareAtCents } : {}), ...(stockQuantity !== undefined && fulfillmentType === 'PHYSICAL' ? { stockQuantity } : {}) };
    return reply.code(201).send({ product: await catalog.createProduct(context, input, request.id) });
  });

  app.delete<{ Params: { productId: string } }>('/products/:productId', async (request, reply) => {
    const context = await authenticate(request, true);
    if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const productId = text(request.params.productId, 32);
    if (!productId) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Produto inválido.'));
    const result = await catalog.deleteManualProduct(context, productId, request.id);
    if (result === 'not_found') return reply.code(404).send(errorBody(request, 'PRODUCT_NOT_FOUND', 'Produto manual não encontrado.'));
    if (result === 'archived') return reply.send({ archived: true });
    return reply.code(204).send();
  });

  app.get('/checkouts', async (request, reply) => {
    const context = await authenticate(request);
    if (!context) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    return reply.send({ items: await catalog.listCheckouts(context) });
  });

  app.get('/shipping-methods', async (request, reply) => {
    const context = await authenticate(request);
    if (!context) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    return reply.send({ items: await catalog.listShippingMethods(context) });
  });

  app.post<{ Body: Record<string, unknown> }>('/shipping-methods', async (request, reply) => {
    const context = await authenticate(request, true);
    if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const name = text(request.body?.name, 120); const priceCents = integer(request.body?.priceCents, 0, 2_000_000_000); const minDays = integer(request.body?.minDays, 0, 365); const maxDays = integer(request.body?.maxDays, 0, 365);
    if (!name || priceCents === null || minDays === null || maxDays === null || maxDays < minDays || typeof request.body?.active !== 'boolean') return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Método de frete inválido.'));
    const input: ShippingMethodInput = { name, priceCents, minDays, maxDays, active: request.body.active };
    return reply.code(201).send({ method: await catalog.createShippingMethod(context, input, request.id) });
  });

  app.put<{ Params: { methodId: string }; Body: Record<string, unknown> }>('/shipping-methods/:methodId', async (request, reply) => {
    const context = await authenticate(request, true);
    if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const methodId = text(request.params.methodId, 32); const name = text(request.body?.name, 120); const priceCents = integer(request.body?.priceCents, 0, 2_000_000_000); const minDays = integer(request.body?.minDays, 0, 365); const maxDays = integer(request.body?.maxDays, 0, 365);
    if (!methodId || !name || priceCents === null || minDays === null || maxDays === null || maxDays < minDays || typeof request.body?.active !== 'boolean') return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Método de frete inválido.'));
    const method = await catalog.updateShippingMethod(context, methodId, { name, priceCents, minDays, maxDays, active: request.body.active }, request.id);
    if (!method) return reply.code(404).send(errorBody(request, 'SHIPPING_METHOD_NOT_FOUND', 'Método de frete não encontrado.'));
    return reply.send({ method });
  });
  app.delete<{ Params: { methodId: string } }>('/shipping-methods/:methodId', async (request, reply) => {
    const context = await authenticate(request, true); if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const methodId = text(request.params.methodId, 32); if (!methodId || !await catalog.deleteShippingMethod(context, methodId, request.id)) return reply.code(404).send(errorBody(request, 'SHIPPING_METHOD_NOT_FOUND', 'Método de frete não encontrado.'));
    return reply.code(204).send();
  });

  app.post<{ Body: Record<string, unknown> }>('/checkouts', async (request, reply) => {
    const context = await authenticate(request, true);
    if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const name = text(request.body?.name, 120); const slug = text(request.body?.slug, 80); const productPublicId = text(request.body?.productId, 32);
    const draftConfig = request.body?.draftConfig === undefined ? {} : request.body.draftConfig;
    if (!name || !slug || !productPublicId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || typeof draftConfig !== 'object' || draftConfig === null || Array.isArray(draftConfig) || JSON.stringify(draftConfig).length > 100_000) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Dados do checkout inválidos.'));
    const input: CheckoutInput = { name, slug, productPublicId, draftConfig: draftConfig as Record<string, unknown> };
    const checkout = await catalog.createCheckout(context, input, request.id);
    if (checkout === 'limit_reached') return reply.code(409).send(errorBody(request, 'CHECKOUT_LIMIT_REACHED', 'Seu plano atingiu o limite de checkouts desta loja. Faça upgrade para criar outro.'));
    if (!checkout) return reply.code(404).send(errorBody(request, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.'));
    return reply.code(201).send({ checkout });
  });

  app.delete<{ Params: { checkoutId: string } }>('/checkouts/:checkoutId', async (request, reply) => {
    const context = await authenticate(request, true);
    if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const checkoutId = text(request.params.checkoutId, 32);
    if (!checkoutId) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Checkout inválido.'));
    const result = await catalog.deleteCheckout(context, checkoutId, request.id);
    if (result === 'not_found') return reply.code(404).send(errorBody(request, 'CHECKOUT_NOT_FOUND', 'Checkout não encontrado.'));
    if (result === 'archived') return reply.send({ archived: true });
    return reply.code(204).send();
  });

  app.post<{ Params: { checkoutId: string } }>('/checkouts/:checkoutId/publish', async (request, reply) => {
    const context = await authenticate(request, true);
    if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    if (catalog.hasActiveDomain && !(await catalog.hasActiveDomain(context))) return reply.code(409).send(errorBody(request, 'DOMAIN_REQUIRED', 'Ative um domínio seguro para publicar o checkout.'));
    const checkoutId = text(request.params.checkoutId, 32);
    if (!checkoutId) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Checkout inválido.'));
    const checkout = await catalog.publishCheckout(context, checkoutId, request.id);
    if (!checkout) return reply.code(404).send(errorBody(request, 'CHECKOUT_NOT_FOUND', 'Checkout não encontrado ou produto indisponível.'));
    return reply.send({ checkout });
  });

  app.patch<{ Params: { checkoutId: string }; Body: Record<string, unknown> }>('/checkouts/:checkoutId/draft', async (request, reply) => {
    const context = await authenticate(request, true);
    if (!context || !canWrite(context)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const checkoutId = text(request.params.checkoutId, 32); const config = checkoutConfig(request.body?.config);
    if (!checkoutId || !config) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Personalização do checkout inválida.'));
    const checkout = await catalog.updateCheckoutDraft(context, checkoutId, config, request.id);
    if (!checkout) return reply.code(404).send(errorBody(request, 'CHECKOUT_NOT_FOUND', 'Checkout não encontrado.'));
    return reply.send({ checkout });
  });
}
