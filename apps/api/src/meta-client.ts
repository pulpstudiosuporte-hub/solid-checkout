export type MetaEventName = 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase';

export async function validateMetaCredentials(pixelId: string, accessToken: string): Promise<void> {
  const url = new URL(`https://graph.facebook.com/${encodeURIComponent(pixelId)}`); url.searchParams.set('fields', 'id,name'); url.searchParams.set('access_token', accessToken);
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Meta credentials rejected (${response.status})`);
}

export async function sendMetaEvent(pixelId: string, accessToken: string, event: Record<string, unknown>, testEventCode?: string | null): Promise<void> {
  const url = new URL(`https://graph.facebook.com/${encodeURIComponent(pixelId)}/events`); url.searchParams.set('access_token', accessToken);
  const body: Record<string, unknown> = { data: [event] }; if (testEventCode) body.test_event_code = testEventCode;
  const response = await fetch(url, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Meta CAPI request failed (${response.status})`);
}
