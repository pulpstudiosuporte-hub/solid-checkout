const baseUrl = 'https://api.gw.westpay.com.br';
const userAgent = 'SOLID-Checkout/0.1 (+suporte@solidcheckout.xyz)';

export type WestPayCredentials = Readonly<{ apiKey: string; publicKey: string }>;
export type WestPayPix = Readonly<{ id: string; status: string; amount: number; pix?: { qrcode?: string; expiresAt?: string } }>;

const headers = (credentials: WestPayCredentials) => ({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.publicKey}`).toString('base64')}`, 'User-Agent': userAgent });

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  const detail = typeof body?.message === 'string' ? body.message : typeof body?.error === 'string' ? body.error : 'erro desconhecido';
  if (!response.ok) throw new Error(`WestPay request failed (${response.status}): ${detail}`);
  return body as T;
}

export async function testWestPay(credentials: WestPayCredentials): Promise<void> {
  const response = await fetch(`${baseUrl}/api/v1/balance`, { headers: headers(credentials), signal: AbortSignal.timeout(10_000) });
  await responseJson<unknown>(response);
}

export async function findWestPayPix(credentials: WestPayCredentials, externalRef: string): Promise<WestPayPix | null> {
  const url = new URL(`${baseUrl}/api/v1/transactions/pix-in`); url.searchParams.set('externalRef', externalRef);
  const response = await fetch(url, { headers: headers(credentials), signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) return null;
  return responseJson<WestPayPix>(response);
}

export async function getWestPayPix(credentials: WestPayCredentials, id: string): Promise<WestPayPix | null> {
  const url = new URL(`${baseUrl}/api/v1/transactions/pix-in`); url.searchParams.set('id', id);
  const response = await fetch(url, { headers: headers(credentials), signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) return null;
  return responseJson<WestPayPix>(response);
}

export async function createWestPayPix(credentials: WestPayCredentials, payload: Record<string, unknown>): Promise<WestPayPix> {
  const response = await fetch(`${baseUrl}/api/v1/transactions`, { method: 'POST', headers: headers(credentials), body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) });
  return responseJson<WestPayPix>(response);
}
