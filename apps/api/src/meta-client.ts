import { createHash, randomUUID } from 'node:crypto';

export type MetaEventName = 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase';

export class MetaApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 422, public readonly metaCode?: number) {
    super(message); this.name = 'MetaApiError';
  }
}

async function metaRequest(url: URL, accessToken: string, body?: Record<string, unknown>, readingPixel = false): Promise<Record<string, unknown>> {
  let response: Response; let result: Record<string, unknown>;
  try {
    response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { accept: 'application/json', authorization: `Bearer ${accessToken}`, ...(body && { 'content-type': 'application/json' }) },
      ...(body && { body: JSON.stringify(body) }), signal: AbortSignal.timeout(8_000),
    });
    result = await response.json() as Record<string, unknown>;
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid response');
  } catch {
    // Do not retain fetch errors or upstream text: they can contain credentials.
    throw new MetaApiError('META_UNAVAILABLE', 'Não foi possível consultar a Meta agora. Tente novamente em instantes.', 503);
  }
  if (!response.ok || result.error) {
    const details = result.error && typeof result.error === 'object' ? result.error as Record<string, unknown> : {};
    const code = typeof details.code === 'number' ? details.code : undefined;
    if (response.status >= 500 || response.status === 429 || details.is_transient === true || [4, 17, 32, 613].includes(code ?? 0)) {
      throw new MetaApiError('META_UNAVAILABLE', 'A Meta está temporariamente indisponível ou limitou as consultas. Tente novamente em instantes.', 503, code);
    }
    if (code === 190 || code === 102 || response.status === 401) throw new MetaApiError('META_TOKEN_INVALID', 'A Meta informou que o token está inválido ou expirado. Gere outro token da API de Conversões no Gerenciador de Eventos.', 422, code);
    if (readingPixel && [10, 100, 200].includes(code ?? 0)) throw new MetaApiError('META_TEST_CODE_REQUIRED', 'Não foi possível consultar o cadastro deste Pixel. Para validar pelo envio de eventos, preencha o código da aba Eventos de teste na Meta e conecte novamente.', 422, code);
    if (code === 10 || code === 200 || response.status === 403) throw new MetaApiError('META_PERMISSION_DENIED', 'A Meta não autorizou o envio para este Pixel. Confira se o token tem acesso a essa fonte de dados.', 422, code);
    throw new MetaApiError('META_VALIDATION_FAILED', `A Meta não confirmou a conexão${code ? ` (código ${code})` : ''}. Confira o ID da fonte de dados, as permissões do token e o código de teste, se preenchido.`, 422, code);
  }
  return result;
}

export async function validateMetaCredentials(pixelId: string, accessToken: string, testEventCode?: string): Promise<void> {
  if (testEventCode) {
    if (!/^TEST[A-Za-z0-9_-]{1,60}$/.test(testEventCode)) throw new MetaApiError('META_TEST_CODE_INVALID', 'Copie o código TEST da aba Eventos de teste na Meta.');
    // Only the explicit test path emits a synthetic event; never a production purchase.
    const id = `solid-connection-test:${randomUUID()}`;
    await sendMetaEvent(pixelId, accessToken, {
      event_name: 'SolidConnectionTest', event_time: Math.floor(Date.now() / 1000), event_id: id,
      action_source: 'system_generated', user_data: { external_id: [createHash('sha256').update(id).digest('hex')] },
    }, testEventCode);
    return;
  }
  const url = new URL(`https://graph.facebook.com/${encodeURIComponent(pixelId)}`); url.searchParams.set('fields', 'id');
  const result = await metaRequest(url, accessToken, undefined, true);
  if (result.id !== pixelId) throw new MetaApiError('META_VALIDATION_FAILED', 'A Meta não confirmou o ID deste Pixel. Confira a fonte de dados selecionada.');
}

export async function sendMetaEvent(pixelId: string, accessToken: string, event: Record<string, unknown>, testEventCode?: string | null): Promise<void> {
  const url = new URL(`https://graph.facebook.com/${encodeURIComponent(pixelId)}/events`);
  const body: Record<string, unknown> = { data: [event] }; if (testEventCode) body.test_event_code = testEventCode;
  const result = await metaRequest(url, accessToken, body);
  if (result.events_received !== 1) throw new MetaApiError('META_EVENT_NOT_ACCEPTED', 'A Meta não confirmou o recebimento do evento. Confira os diagnósticos no Gerenciador de Eventos.');
}
