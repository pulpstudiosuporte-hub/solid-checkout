import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import { HttpDokployDomainClient } from '../src/dokploy-client.js';

afterEach(() => vi.unstubAllGlobals());

describe('reconciliação de domínio Dokploy', () => {
  it('normaliza a URL e remove registros duplicados mantendo o primeiro', async () => {
    const requestUrl = (input: string | URL | Request): string => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const fetcher = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.includes('domain.byApplicationId')) return Promise.resolve(new Response(JSON.stringify({ domains: [{ domainId: 'domain-1', host: 'checkout.loja.com' }, { domainId: 'domain-2', host: 'CHECKOUT.LOJA.COM' }] }), { status: 200 }));
      if (url.endsWith('/api/domain.delete') && init?.body === JSON.stringify({ domainId: 'domain-2' })) return Promise.resolve(new Response('{}', { status: 200 }));
      return Promise.resolve(new Response('unexpected request', { status: 500 }));
    });
    vi.stubGlobal('fetch', fetcher);
    const environment = { DOKPLOY_URL: 'https://dokploy.example.com/api/', DOKPLOY_API_KEY: 'key', DOKPLOY_CHECKOUT_APPLICATION_ID: 'app-1' } as AppEnvironment;
    await expect(new HttpDokployDomainClient(environment).reconcileCheckoutDomain('checkout.loja.com')).resolves.toBe('domain-1');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const firstInput = fetcher.mock.calls[0]?.[0];
    expect(firstInput ? requestUrl(firstInput) : null).toBe('https://dokploy.example.com/api/domain.byApplicationId?applicationId=app-1');
  });
});
