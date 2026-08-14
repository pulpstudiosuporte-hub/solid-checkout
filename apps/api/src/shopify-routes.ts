import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository, SessionUser } from './auth-repository.js';
import { decryptSecret, encryptSecret } from './shopify-crypto.js';
import type { ShopifyCatalog, ShopifyRepository } from './shopify-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const equal = (left: string, right: string): boolean => { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
const shopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerShopifyRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, repository: ShopifyRepository): void {
  const secure = environment.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-solid_session' : 'solid_session'; const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf'; const oauthCookie = secure ? '__Secure-solid_shopify_oauth' : 'solid_shopify_oauth';
  const configured = Boolean(environment.APP_URL && environment.SHOPIFY_CLIENT_ID && environment.SHOPIFY_CLIENT_SECRET && environment.SHOPIFY_REDIRECT_URI && environment.APP_ENCRYPTION_KEY);
  const scopes = environment.SHOPIFY_SCOPES ?? 'read_products';
  const session = async (request: FastifyRequest): Promise<SessionUser | null> => { const token = request.cookies[sessionCookie]; return token ? auth.findActiveSession(sha256(token), new Date()) : null; };
  const csrfValid = (request: FastifyRequest, current: SessionUser): boolean => {
    const origin = request.headers.origin; const cookie = request.cookies[csrfCookie]; const header = request.headers['x-csrf-token'];
    return typeof origin === 'string' && environment.CORS_ORIGINS.includes(origin) && Boolean(cookie) && typeof header === 'string' && equal(sha256(cookie!), sha256(header)) && equal(sha256(header), current.csrfTokenHash);
  };
  const redirectResult = (result: string): string => `${environment.APP_URL}/#/integrations?shopify=${encodeURIComponent(result)}`;

  app.get('/integrations/shopify/status', async (request, reply) => {
    const current = await session(request); if (!current) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context) return reply.code(409).send(errorBody(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    return reply.send({ configured, ...(await repository.status(context.storeId)) });
  });

  app.post<{ Body: { shop?: unknown } }>('/integrations/shopify/connect', async (request, reply) => {
    const current = await session(request); if (!current || !csrfValid(request, current)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    if (!configured) return reply.code(503).send(errorBody(request, 'SHOPIFY_NOT_CONFIGURED', 'A integração Shopify ainda não foi configurada no servidor.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context || context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Somente proprietários e administradores podem conectar integrações.'));
    const rawShop = typeof request.body?.shop === 'string' ? request.body.shop.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
    const shop = rawShop.includes('.') ? rawShop : `${rawShop}.myshopify.com`;
    if (!shopPattern.test(shop)) return reply.code(400).send(errorBody(request, 'INVALID_SHOP', 'Informe um domínio myshopify.com válido.'));
    const state = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 10 * 60_000);
    await repository.createState({ stateHash: sha256(state), storeId: context.storeId, userId: current.userId, sessionId: current.sessionId, shopDomain: shop, expiresAt });
    const signature = createHmac('sha256', environment.SHOPIFY_CLIENT_SECRET!).update(state).digest('base64url');
    const authorize = new URL(`https://${shop}/admin/oauth/authorize`); authorize.searchParams.set('client_id', environment.SHOPIFY_CLIENT_ID!); authorize.searchParams.set('scope', scopes); authorize.searchParams.set('redirect_uri', environment.SHOPIFY_REDIRECT_URI!); authorize.searchParams.set('state', state);
    return reply.setCookie(oauthCookie, `${state}.${signature}`, { httpOnly: true, secure, sameSite: 'lax', path: '/integrations/shopify/callback', maxAge: 600 }).send({ authorizationUrl: authorize.toString() });
  });

  app.get<{ Querystring: Record<string, string | undefined> }>('/integrations/shopify/callback', async (request, reply) => {
    if (!configured) return reply.code(503).send(errorBody(request, 'SHOPIFY_NOT_CONFIGURED', 'Integração indisponível.'));
    const current = await session(request); const { code, hmac, shop, state, timestamp } = request.query;
    const cookie = request.cookies[oauthCookie]; const [cookieState, cookieSignature] = cookie?.split('.') ?? [];
    const expectedCookieSignature = cookieState ? createHmac('sha256', environment.SHOPIFY_CLIENT_SECRET!).update(cookieState).digest('base64url') : '';
    const message = Object.entries(request.query).filter(([key, value]) => key !== 'hmac' && key !== 'signature' && value !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
    const expectedHmac = createHmac('sha256', environment.SHOPIFY_CLIENT_SECRET!).update(message).digest('hex');
    const timestampValid = Boolean(timestamp) && Math.abs(Date.now() / 1000 - Number(timestamp)) < 600;
    if (!current || !state || !code || !hmac || !shop || !shopPattern.test(shop) || !timestampValid || !cookieState || !cookieSignature || !equal(state, cookieState) || !equal(cookieSignature, expectedCookieSignature) || !equal(hmac, expectedHmac)) return reply.clearCookie(oauthCookie, { path: '/integrations/shopify/callback' }).redirect(redirectResult('invalid'));
    const oauthState = await repository.consumeState(sha256(state), current.userId, current.sessionId, new Date());
    if (!oauthState || oauthState.shopDomain !== shop) return reply.clearCookie(oauthCookie, { path: '/integrations/shopify/callback' }).redirect(redirectResult('expired'));
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ client_id: environment.SHOPIFY_CLIENT_ID!, client_secret: environment.SHOPIFY_CLIENT_SECRET!, code, expiring: '1' }), signal: AbortSignal.timeout(10_000) });
    const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; scope?: string; expires_in?: number; refresh_token_expires_in?: number };
    if (!tokenResponse.ok || !token.access_token) return reply.clearCookie(oauthCookie, { path: '/integrations/shopify/callback' }).redirect(redirectResult('token_error'));
    const now = Date.now();
    await repository.connect({ storeId: oauthState.storeId, userId: current.userId, shopDomain: shop, accessTokenEncrypted: encryptSecret(token.access_token, environment.APP_ENCRYPTION_KEY!), ...(token.refresh_token ? { refreshTokenEncrypted: encryptSecret(token.refresh_token, environment.APP_ENCRYPTION_KEY!) } : {}), scopes: token.scope ?? scopes, ...(token.expires_in ? { accessTokenExpiresAt: new Date(now + token.expires_in * 1000) } : {}), ...(token.refresh_token_expires_in ? { refreshTokenExpiresAt: new Date(now + token.refresh_token_expires_in * 1000) } : {}), requestId: request.id });
    return reply.clearCookie(oauthCookie, { path: '/integrations/shopify/callback' }).redirect(redirectResult('connected'));
  });

  app.delete('/integrations/shopify', async (request, reply) => {
    const current = await session(request); if (!current || !csrfValid(request, current)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context || context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    await repository.disconnect(context.storeId, current.userId, request.id); return reply.code(204).send();
  });

  app.post('/integrations/shopify/sync', { config: { rateLimit: { max: 3, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const current = await session(request); if (!current || !csrfValid(request, current)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context || context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Somente proprietários e administradores podem sincronizar o catálogo.'));
    const credentials = await repository.credentials(context.storeId); if (!credentials) return reply.code(409).send(errorBody(request, 'SHOPIFY_NOT_CONNECTED', 'Conecte a Shopify antes de sincronizar.'));
    if (credentials.accessTokenExpiresAt && credentials.accessTokenExpiresAt <= new Date()) return reply.code(409).send(errorBody(request, 'SHOPIFY_TOKEN_EXPIRED', 'A autorização da Shopify expirou. Reconecte a loja.'));
    try {
      const token = decryptSecret(credentials.accessTokenEncrypted, environment.APP_ENCRYPTION_KEY!);
      const catalog = await fetchShopifyCatalog(credentials.shopDomain, token);
      return reply.send(await repository.syncCatalog(context.storeId, current.userId, request.id, catalog));
    } catch (error) {
      request.log.warn({ err: error, shopDomain: credentials.shopDomain }, 'shopify_catalog_sync_failed');
      return reply.code(502).send(errorBody(request, 'SHOPIFY_SYNC_FAILED', 'Não foi possível importar o catálogo da Shopify agora.'));
    }
  });
}

type PageInfo = { hasNextPage: boolean; endCursor?: string };
type ProductNode = ShopifyCatalog['products'][number] & { variantsPageInfo: PageInfo; imagesPageInfo: PageInfo; collectionsPageInfo: PageInfo };
type RawVariant = { id: string; title: string; sku?: string | null; barcode?: string | null; price: string; compareAtPrice?: string | null; inventoryQuantity?: number | null; availableForSale: boolean; image?: { url: string } | null; selectedOptions?: readonly { name: string; value: string }[] };
type RawMedia = { id: string; alt?: string | null; image?: { url: string; width?: number | null; height?: number | null } | null };
type RawProduct = { id: string; title: string; handle: string; descriptionHtml?: string | null; vendor?: string | null; productType?: string | null; tags?: readonly string[]; status: string; updatedAt: string; featuredMedia?: { preview?: { image?: { url: string } | null } | null } | null; variants: { nodes: readonly RawVariant[]; pageInfo: PageInfo }; media: { nodes: readonly RawMedia[]; pageInfo: PageInfo }; collections: { nodes: readonly { id: string }[]; pageInfo: PageInfo } };
type RawCollection = { id: string; title: string; handle: string; descriptionHtml?: string | null; image?: { url: string } | null; updatedAt: string };

async function shopifyGraphql<T>(shop: string, token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Shopify-Access-Token': token }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(25_000) });
  const body = await response.json() as { data?: T; errors?: readonly { message: string }[] };
  if (!response.ok || !body.data || body.errors?.length) throw new Error(`Shopify GraphQL request failed (${response.status})`);
  return body.data;
}

async function fetchShopifyCatalog(shop: string, token: string): Promise<ShopifyCatalog> {
  const products: ProductNode[] = []; let after: string | undefined; let pages = 0;
  do {
    const responseData: { products: { nodes: readonly RawProduct[]; pageInfo: PageInfo } } = await shopifyGraphql(shop, token, PRODUCTS_QUERY, { after });
    for (const node of responseData.products.nodes) products.push({ id: node.id, title: node.title, handle: node.handle, descriptionHtml: node.descriptionHtml ?? '', vendor: node.vendor ?? '', productType: node.productType ?? '', tags: node.tags ?? [], status: node.status, updatedAt: node.updatedAt, featuredImage: node.featuredMedia?.preview?.image?.url, variants: node.variants.nodes.map(variant => ({ id: variant.id, title: variant.title, sku: variant.sku || undefined, barcode: variant.barcode || undefined, price: variant.price, compareAtPrice: variant.compareAtPrice || undefined, inventoryQuantity: variant.inventoryQuantity ?? undefined, availableForSale: variant.availableForSale, imageUrl: variant.image?.url, selectedOptions: variant.selectedOptions ?? [] })), images: node.media.nodes.flatMap(media => media.image?.url ? [{ id: media.id, url: media.image.url, altText: media.alt || undefined, width: media.image.width ?? undefined, height: media.image.height ?? undefined }] : []), collectionIds: node.collections.nodes.map(collection => collection.id), variantsPageInfo: node.variants.pageInfo, imagesPageInfo: node.media.pageInfo, collectionsPageInfo: node.collections.pageInfo });
    after = responseData.products.pageInfo.endCursor; pages += 1;
    if (pages >= 100 && responseData.products.pageInfo.hasNextPage) throw new Error('Shopify catalog exceeds synchronous safety limit');
    if (!responseData.products.pageInfo.hasNextPage) break;
  } while (after);
  if (products.some(product => product.variantsPageInfo.hasNextPage || product.imagesPageInfo.hasNextPage || product.collectionsPageInfo.hasNextPage)) throw new Error('A product exceeds the synchronous nested catalog limit');

  const collections: ShopifyCatalog['collections'][number][] = []; after = undefined; pages = 0;
  do {
    const responseData: { collections: { nodes: readonly RawCollection[]; pageInfo: PageInfo } } = await shopifyGraphql(shop, token, COLLECTIONS_QUERY, { after });
    collections.push(...responseData.collections.nodes.map(node => ({ id: node.id, title: node.title, handle: node.handle, descriptionHtml: node.descriptionHtml ?? '', imageUrl: node.image?.url, updatedAt: node.updatedAt })));
    after = responseData.collections.pageInfo.endCursor; pages += 1;
    if (pages >= 100 && responseData.collections.pageInfo.hasNextPage) throw new Error('Shopify collections exceed synchronous safety limit');
    if (!responseData.collections.pageInfo.hasNextPage) break;
  } while (after);
  return { products, collections };
}

const PRODUCTS_QUERY = `query SolidProducts($after: String) { products(first: 100, after: $after, sortKey: ID) { nodes { id title handle descriptionHtml vendor productType tags status updatedAt featuredMedia { preview { image { url } } } variants(first: 250) { nodes { id title sku barcode price compareAtPrice inventoryQuantity availableForSale selectedOptions { name value } image { url } } pageInfo { hasNextPage endCursor } } media(first: 250, query: "media_type:IMAGE", sortKey: POSITION) { nodes { id alt ... on MediaImage { image { url width height } } } pageInfo { hasNextPage endCursor } } collections(first: 250) { nodes { id } pageInfo { hasNextPage endCursor } } } pageInfo { hasNextPage endCursor } } }`;
const COLLECTIONS_QUERY = `query SolidCollections($after: String) { collections(first: 100, after: $after, sortKey: ID) { nodes { id title handle descriptionHtml updatedAt image { url } } pageInfo { hasNextPage endCursor } } }`;
