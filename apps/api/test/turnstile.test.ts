import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import { verifyTurnstile } from '../src/turnstile.js';

const environment = (secret?: string) => ({ TURNSTILE_SECRET_KEY: secret } as AppEnvironment);

describe('verifyTurnstile', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mantém a instalação compatível enquanto a proteção não está configurada', async () => {
    expect(await verifyTurnstile(environment(), undefined, '127.0.0.1', 'register')).toBe(true);
  });

  it('recusa token ausente quando a proteção está configurada', async () => {
    expect(await verifyTurnstile(environment('turnstile-secret'), undefined, '127.0.0.1', 'register')).toBe(false);
  });

  it('aceita somente tokens válidos para a ação esperada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, action: 'register' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await verifyTurnstile(environment('turnstile-secret'), 'valid-token-with-enough-characters', '203.0.113.10', 'register')).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('recusa token reutilizado em outra ação', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, action: 'register' }), { status: 200 })));
    expect(await verifyTurnstile(environment('turnstile-secret'), 'valid-token-with-enough-characters', '127.0.0.1', 'generate_pix')).toBe(false);
  });

  it('falha de forma fechada quando a Cloudflare está indisponível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await verifyTurnstile(environment('turnstile-secret'), 'valid-token-with-enough-characters', '127.0.0.1', 'register')).toBe(false);
  });
});
