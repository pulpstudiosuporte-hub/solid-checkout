import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoasPix } from '../src/roas-client.js';
import type { RoasRequestError } from '../src/roas-client.js';

afterEach(() => vi.unstubAllGlobals());

const credentials = { publicKey: 'public', secretKey: 'secret' };

describe('cliente Roas', () => {
  it('preserva mensagens estruturadas retornadas pelo provedor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: 'CPF inválido' }, { detail: 'Valor mínimo não atingido' }] }), { status: 400 })));
    const failure = createRoasPix(credentials, { amount: 500 }).catch((error: unknown) => error);
    await expect(failure).resolves.toMatchObject({ status: 400, details: ['CPF inválido', 'Valor mínimo não atingido'] } satisfies Partial<RoasRequestError>);
  });

  it('normaliza a resposta oficial de Pix', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'payment-1', amount: 500, status: 'PENDING', pix: { qr_code: 'pix-code', expiration_date: '2026-08-28T12:00:00Z' } } }), { status: 200 })));
    await expect(createRoasPix(credentials, { amount: 500 })).resolves.toEqual({ id: 'payment-1', amount: 500, status: 'PENDING', pixCode: 'pix-code', expiresAt: '2026-08-28T12:00:00Z' });
  });
});
