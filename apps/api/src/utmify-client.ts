const endpoint = 'https://api.utmify.com.br/api-credentials/orders';

export type UtmifyStatus = 'waiting_payment' | 'paid' | 'refused' | 'refunded' | 'chargedback';

export async function sendUtmifyOrder(token: string, payload: Record<string, unknown>): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'x-api-token': token }, body: JSON.stringify(payload), signal: controller.signal });
    if (!response.ok) throw new Error(`UTMify request failed (${response.status})`);
  } finally { clearTimeout(timeout); }
}

export async function testUtmifyToken(token: string): Promise<void> {
  const now = utcDate(new Date());
  await sendUtmifyOrder(token, { orderId: `solid-test-${Date.now()}`, platform: 'SOLID Checkout', paymentMethod: 'pix', status: 'waiting_payment', createdAt: now, approvedDate: null, refundedAt: null, customer: { name: 'Teste SOLID', email: 'integracao@solidcheckout.xyz', phone: '11999999999', document: '52998224725', country: 'BR', ip: '127.0.0.1' }, products: [{ id: 'integration-test', name: 'Teste de integração', planId: null, planName: null, quantity: 1, priceInCents: 100 }], trackingParameters: { src: null, sck: null, utm_source: 'solid_integration_test', utm_campaign: null, utm_medium: null, utm_content: null, utm_term: null }, commission: { totalPriceInCents: 100, gatewayFeeInCents: 0, userCommissionInCents: 100, currency: 'BRL' }, isTest: true });
}

export function utcDate(value: Date): string { return value.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''); }
