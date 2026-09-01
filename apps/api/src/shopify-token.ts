import type { AppEnvironment } from '@solid/config';
import { decryptSecret, encryptSecret } from './shopify-crypto.js';
import { ShopifyAuthorizationError } from './shopify-auth-error.js';
import type { ShopifyCredentials, ShopifyRepository } from './shopify-repository.js';

const SHOP_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const TOKEN_SAFETY_WINDOW_MS = 60_000;

type ClientToken = Readonly<{ accessToken: string; expiresAt: Date; scope: string }>;

export async function exchangeShopifyClientCredentials(shopDomain: string, clientId: string, clientSecret: string): Promise<ClientToken> {
  if (!SHOP_PATTERN.test(shopDomain)) throw new Error('Invalid Shopify shop domain');
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!response.ok || !body.access_token) throw new ShopifyAuthorizationError(body.error_description || body.error || 'Shopify rejected client credentials');
  const expiresIn = Number.isFinite(body.expires_in) && Number(body.expires_in) > 0 ? Number(body.expires_in) : 86_400;
  return { accessToken: body.access_token, expiresAt: new Date(Date.now() + expiresIn * 1000), scope: body.scope ?? '' };
}

export async function getShopifyAccessToken(storeId: string, credentials: ShopifyCredentials, environment: AppEnvironment, repository: ShopifyRepository): Promise<string> {
  if (!credentials.accessTokenExpiresAt || credentials.accessTokenExpiresAt.getTime() > Date.now() + TOKEN_SAFETY_WINDOW_MS) return decryptSecret(credentials.accessTokenEncrypted, environment.APP_ENCRYPTION_KEY!);
  if (credentials.authMode !== 'CLIENT_CREDENTIALS' || !credentials.clientIdEncrypted || !credentials.clientSecretEncrypted) throw new Error('Shopify access token expired');
  const token = await exchangeShopifyClientCredentials(credentials.shopDomain, decryptSecret(credentials.clientIdEncrypted, environment.APP_ENCRYPTION_KEY!), decryptSecret(credentials.clientSecretEncrypted, environment.APP_ENCRYPTION_KEY!));
  await repository.updateAccessToken(storeId, encryptSecret(token.accessToken, environment.APP_ENCRYPTION_KEY!), token.expiresAt);
  return token.accessToken;
}

export async function inspectShopifyConnection(shopDomain: string, accessToken: string): Promise<{ shopDomain: string; shopName: string; scopes: string[] }> {
  const response = await fetch(`https://${shopDomain}/admin/api/2026-07/graphql.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query: '{ shop { name myshopifyDomain } currentAppInstallation { accessScopes { handle } } }' }), signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => ({})) as { data?: { shop?: { name?: string; myshopifyDomain?: string }; currentAppInstallation?: { accessScopes?: { handle?: string }[] } }; errors?: { message?: string }[] };
  const returnedDomain = body.data?.shop?.myshopifyDomain?.trim().toLowerCase();
  if (!response.ok || body.errors?.length || !returnedDomain) throw new Error('Shopify credentials could not be validated');
  return { shopDomain: returnedDomain, shopName: body.data?.shop?.name?.trim() || returnedDomain, scopes: (body.data?.currentAppInstallation?.accessScopes ?? []).map(scope => scope.handle || '').filter(Boolean) };
}
