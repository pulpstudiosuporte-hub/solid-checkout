import { describe, expect, it } from 'vitest';
import { lookupBrazilianPostalCode, PostalCodeLookupError } from '../src/postal-code.js';

describe('consulta de CEP', () => {
  it('normaliza apenas os campos públicos necessários do endereço', async () => {
    const fetcher = async () => new Response(JSON.stringify({ cep: '01310-100', logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP', ibge: '3550308' }), { status: 200 });
    await expect(lookupBrazilianPostalCode('01310100', fetcher as typeof fetch)).resolves.toEqual({ postalCode: '01310100', street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' });
  });

  it('diferencia CEP inexistente de indisponibilidade do provedor', async () => {
    const missing = async () => new Response(JSON.stringify({ erro: true }), { status: 200 });
    const unavailable = async () => new Response('', { status: 500 });
    await expect(lookupBrazilianPostalCode('00000000', missing as typeof fetch)).rejects.toMatchObject({ code: 'NOT_FOUND' } satisfies Partial<PostalCodeLookupError>);
    await expect(lookupBrazilianPostalCode('01310100', unavailable as typeof fetch)).rejects.toMatchObject({ code: 'UNAVAILABLE' } satisfies Partial<PostalCodeLookupError>);
  });
});
