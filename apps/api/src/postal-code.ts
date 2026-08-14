export type PostalCodeAddress = { postalCode: string; street: string; neighborhood: string; city: string; state: string };
type ViaCepResponse = { logradouro?: unknown; bairro?: unknown; localidade?: unknown; uf?: unknown; erro?: unknown };

export class PostalCodeLookupError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'UNAVAILABLE') { super(code); }
}

export async function lookupBrazilianPostalCode(postalCode: string, fetcher: typeof fetch = fetch): Promise<PostalCodeAddress> {
  const response = await fetcher(`https://viacep.com.br/ws/${postalCode}/json/`, { headers: { Accept: 'application/json', 'User-Agent': 'SOLID-Checkout/0.1' }, signal: AbortSignal.timeout(4_000) }).catch(() => { throw new PostalCodeLookupError('UNAVAILABLE'); });
  if (!response.ok) throw new PostalCodeLookupError('UNAVAILABLE');
  const data = await response.json().catch(() => null) as ViaCepResponse | null;
  if (!data || data.erro === true || data.erro === 'true') throw new PostalCodeLookupError('NOT_FOUND');
  const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const city = text(data.localidade, 120); const state = text(data.uf, 2).toUpperCase();
  if (!city || !/^[A-Z]{2}$/.test(state)) throw new PostalCodeLookupError('UNAVAILABLE');
  return { postalCode, street: text(data.logradouro, 180), neighborhood: text(data.bairro, 120), city, state };
}
