import { beforeEach, describe, expect, it, vi } from 'vitest';

const values = new Map();
vi.stubGlobal('sessionStorage', {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
});

const { bindSupportSession, clearSupportSession, hasSupportSession, request } = await import('../src/api-request.js');
const { apiBaseUrl, bindTabToUser, clearTabUser, resolveMediaUrl } = await import('../src/api.js');

beforeEach(() => values.clear());

describe('cliente web da API', () => {
  it('mantém o contexto do usuário isolado por aba', () => {
    bindTabToUser('user-1');
    expect(sessionStorage.getItem('solid-tab-user-context')).toBe('user-1');
    clearTabUser();
    expect(sessionStorage.getItem('solid-tab-user-context')).toBeNull();
  });

  it('normaliza mídia própria para o host atual da API', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    expect(resolveMediaUrl(`https://old.example.com/media/${id}.webp?cache=1`)).toBe(`${apiBaseUrl}/media/${id}.webp`);
    expect(resolveMediaUrl('https://cdn.example.com/image.jpg')).toBe('https://cdn.example.com/image.jpg');
  });
});


describe('support request context', () => {
  it('binds only credentialed requests to the client and clears the context on exit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    try {
      bindSupportSession('grant-token', 'customer');
      expect(hasSupportSession()).toBe(true);
      await request('https://api.example.test/products', { credentials: 'include' });
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers.get('x-solid-support-session')).toBe('grant-token');
      expect(headers.get('x-solid-user-context')).toBe('customer');
      await request('https://api.example.test/health/ready', { credentials: 'omit' });
      expect(fetchMock.mock.calls[1][1].headers.has('x-solid-support-session')).toBe(false);
      clearSupportSession();
      expect(hasSupportSession()).toBe(false);
      expect(sessionStorage.getItem('solid-tab-user-context')).toBeNull();
      await request('https://api.example.test/auth/session', { credentials: 'include' });
      expect(fetchMock.mock.calls[2][1].headers.has('x-solid-support-session')).toBe(false);
    } finally { vi.unstubAllGlobals(); }
  });
});
