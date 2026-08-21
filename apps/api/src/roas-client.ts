const baseUrl = 'https://api2.roasclub.xyz';
const userAgent = 'SOLID-Checkout/0.1 (+suporte@solidcheckout.xyz)';

export type RoasCredentials = Readonly<{ secretKey: string; publicKey: string }>;

export class RoasRequestError extends Error {
  constructor(readonly status: number, readonly details: readonly string[]) {
    super(`Roas request failed (${status})`);
    this.name = 'RoasRequestError';
  }
}

const headers = (credentials: RoasCredentials) => ({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${credentials.publicKey}:${credentials.secretKey}`).toString('base64')}`, 'User-Agent': userAgent });

async function responseJson<T>(response: Response): Promise<T> {
  const raw = await response.text();
  const body = (() => { try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; } })();
  if (!response.ok) {
    const rawErrors = Array.isArray(body?.errors) ? body.errors : Array.isArray(body?.details) ? body.details : [];
    const details = [body?.message, body?.error, body?.detail, ...rawErrors.flatMap(value => typeof value === 'string' ? [value] : typeof value === 'object' && value !== null ? [String((value as Record<string, unknown>).message ?? (value as Record<string, unknown>).detail ?? '')] : []), ...(raw && !body ? [raw] : [])].filter((value): value is string => typeof value === 'string' && value.length > 0).map(value => value.slice(0, 300));
    throw new RoasRequestError(response.status, details);
  }
  return body as T;
}

// Consulta oficial usada para validar chaves antes de armazená-las.
export async function testRoas(credentials: RoasCredentials): Promise<void> {
  const response = await fetch(`${baseUrl}/v1/company`, { headers: headers(credentials), signal: AbortSignal.timeout(10_000) });
  await responseJson<unknown>(response);
}

export type RoasPix = Readonly<{ id: string; status: string; amount: number; externalRef?: string; pixCode?: string; expiresAt?: string }>;
const record = (value: unknown): Record<string, unknown> | null => typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
const valueOf = (source: Record<string, unknown> | null, ...keys: string[]): unknown => keys.map(key => source?.[key]).find(value => value !== undefined && value !== null);

function normalizePix(raw: unknown): RoasPix | null {
  const body = record(raw); const wrapped = valueOf(body, 'data', 'Data'); const first = Array.isArray(wrapped) ? wrapped[0] : wrapped; const item = record(first) ?? body;
  const pixValue = valueOf(item, 'pix', 'Pix', 'pix_data', 'pixData'); const pix = record(Array.isArray(pixValue) ? pixValue[0] : pixValue);
  const id = valueOf(item, 'id', 'Id', 'transaction_id', 'transactionId'); const status = valueOf(item, 'status', 'Status'); const amount = valueOf(item, 'amount', 'Amount');
  if ((typeof id !== 'string' && typeof id !== 'number') || typeof status !== 'string' || typeof amount !== 'number') return null;
  const pixCode = valueOf(pix, 'qrcode', 'qr_code', 'copy_paste', 'copyPaste', 'emv') ?? valueOf(item, 'qrcode', 'qr_code', 'copy_paste');
  const expiresAt = valueOf(pix, 'expires_at', 'expiresAt', 'expiration_date') ?? valueOf(item, 'expires_at', 'expiresAt');
  const externalRef = valueOf(item, 'external_ref', 'externalRef', 'external_id', 'externalId');
  return { id: String(id), status, amount, ...(typeof pixCode === 'string' ? { pixCode } : {}), ...(typeof expiresAt === 'string' ? { expiresAt } : {}), ...(typeof externalRef === 'string' ? { externalRef } : {}) };
}

export async function createRoasPix(credentials: RoasCredentials, payload: Record<string, unknown>): Promise<RoasPix> {
  const response = await fetch(`${baseUrl}/v1/payment-transaction/create`, { method: 'POST', headers: headers(credentials), body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) });
  const pix = normalizePix(await responseJson<unknown>(response)); if (!pix) throw new Error('A Roas retornou uma resposta de Pix incompleta.'); return pix;
}

export async function getRoasPix(credentials: RoasCredentials, id: string): Promise<RoasPix | null> {
  const response = await fetch(`${baseUrl}/v1/payment-transaction/info/${encodeURIComponent(id)}`, { headers: headers(credentials), signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) return null;
  return normalizePix(await responseJson<unknown>(response));
}
