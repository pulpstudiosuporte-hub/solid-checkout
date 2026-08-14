import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository, SessionUser } from './auth-repository.js';
import { encryptSecret } from './shopify-crypto.js';
import type { ShopifyRepository } from './shopify-repository.js';

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
    const current = await session(request); if (!current) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'AutenticaÃ§Ã£o necessÃ¡ria.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context) return reply.code(409).send(errorBody(request, 'STORE_REQUIRED', 'Selecione uma loja.'));
    return reply.send({ configured, ...(await repository.status(context.storeId)) });
  });

  app.post<{ Body: { shop?: unknown } }>('/integrations/shopify/connect', async (request, reply) => {
    const current = await session(request); if (!current || !csrfValid(request, current)) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    if (!configured) return reply.code(503).send(errorBody(request, 'SHOPIFY_NOT_CONFIGURED', 'A integraÃ§Ã£o Shopify ainda nÃ£o foi configurada no servidor.'));
    const context = await repository.context(current.userId, current.sessionId); if (!context || context.role === 'ANALYST') return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Somente proprietÃ¡rios e administradores podem conectar integraÃ§Ãµes.'));
    const rawShop = typeof request.body?.shop === 'string' ? request.body.shop.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
    const shop = rawShop.includes('.') ? rawShop : `${rawShop}.myshopify.com`;
    if (!shopPattern.test(shop)) return reply.code(400).send(errorBody(request, 'INVALID_SHOP', 'Informe um domÃ­nio myshopify.com vÃ¡lido.'));
    const state = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 10 * 60_000);
    await repository.createState({ stateHash: sha256(state), storeId: context.storeId, userId: current.userId, sessionId: current.sessionId, shopDomain: shop, expiresAt });
    const signature = createHmac('sha256', environment.SHOPIFY_CLIENT_SECRET!).update(state).digest('base64url');
    const authorize = new URL(`https://${shop}/admin/oauth/authorize`); authorize.searchParams.set('client_id', environment.SHOPIFY_CLIENT_ID!); authorize.searchParams.set('scope', scopes); authorize.searchParams.set('redirect_uri', environment.SHOPIFY_REDIRECT_URI!); authorize.searchParams.set('state', state);
    return reply.setCookie(oauthCookie, `${state}.${signature}`, { httpOnly: true, secure, sameSite: 'lax', path: '/integrations/shopify/callback', maxAge: 600 }).send({ authorizationUrl: authorize.toString() });
  });

  app.get<{ Querystring: Record<string, string | undefined> }>('/integrations/shopify/callback', async (request, reply) => {
    if (!configured) return reply.code(503).send(errorBody(request, 'SHOPIFY_NOT_CONFIGURED', 'IntegraÃ§Ã£o indisponÃ­vel.'));
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
}
