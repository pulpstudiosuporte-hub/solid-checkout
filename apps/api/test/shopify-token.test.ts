import { describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import { decryptSecret, encryptSecret } from '../src/shopify-crypto.js';
import { ShopifyAuthorizationError } from '../src/shopify-auth-error.js';
import type { ShopifyRepository } from '../src/shopify-repository.js';
import { exchangeShopifyClientCredentials, getShopifyAccessToken } from '../src/shopify-token.js';

const encryptionKey = Buffer.alloc(32, 8).toString('base64');
const environment = { APP_ENCRYPTION_KEY: encryptionKey } as AppEnvironment;

describe('Shopify client credentials', () => {
  it('renova o token expirado e persiste somente a versão criptografada', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'novo-token', expires_in: 86_399, scope: 'read_products,write_orders' }), { status: 200 }));
    let savedToken = '';
    let savedExpiry: Date | undefined;
    const repository = { updateAccessToken: (_storeId: string, encrypted: string, expiresAt: Date) => { savedToken = encrypted; savedExpiry = expiresAt; return Promise.resolve(); } } as ShopifyRepository;
    const token = await getShopifyAccessToken('store-id', {
      authMode: 'CLIENT_CREDENTIALS',
      shopDomain: 'minha-loja.myshopify.com',
      accessTokenEncrypted: encryptSecret('token-expirado', encryptionKey),
      accessTokenExpiresAt: new Date(Date.now() - 1_000),
      clientIdEncrypted: encryptSecret('client-id', encryptionKey),
      clientSecretEncrypted: encryptSecret('client-secret', encryptionKey),
    }, environment, repository);

    expect(token).toBe('novo-token');
    expect(savedToken).not.toContain('novo-token');
    expect(decryptSecret(savedToken, encryptionKey)).toBe('novo-token');
    expect(savedExpiry?.getTime()).toBeGreaterThan(Date.now());
  });

  it('classifica credenciais recusadas como falha de autorização', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid_client_credentials' }), { status: 401 }));
    await expect(exchangeShopifyClientCredentials('minha-loja.myshopify.com', 'client-id', 'client-secret')).rejects.toBeInstanceOf(ShopifyAuthorizationError);
  });
});
