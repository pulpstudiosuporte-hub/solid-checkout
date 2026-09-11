// Development-only browser fixture. Not a Vite production entry.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicSessionCheckout } from '../src/PublicCheckout';
import OrderPaymentReceipts from '../src/OrderPaymentReceipts';
import '../src/public-checkout.css';
import '../src/orders-page.css';

const fixture = { status: 'PENDING', expiresAt: new Date(Date.now() + 600_000).toISOString(), receipt: null, uploadFails: false, statusFails: false, clipboardFails: false, uploads: 0 };
const payment = () => ({ publicId: 'payment-review', status: fixture.status, amountCents: 14900, pixCode: '00020101021226850014BR.GOV.BCB.PIX2563pix.example.invalid/TESTE-SEM-VALOR-FINANCEIRO5204000053039865406149.005802BR5909LOJA TESTE6009SAO PAULO62070503***6304ABCD', expiresAt: fixture.expiresAt });
const session = { publicId: 'session-review', source: 'DIRECT', status: 'OPEN', expiresAt: new Date(Date.now() + 1800_000).toISOString(), customerCaptured: false, quantity: 1, unitPriceCents: 14900, totalCents: 14900, discountCents: 0, shippingPriceCents: 0, checkout: { name: 'Loja de teste', product: { publicId: 'product-review', checkoutTitle: 'Guia de organização', checkoutDescription: 'Produto fictício para teste local.', priceCents: 14900, fulfillmentType: 'DIGITAL' }, publishedConfig: { showBump: false, socialProofEnabled: false, showCoupon: false } } };
const respond = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
// All fetch calls are isolated here; no request reaches a live API or gateway.
window.fetch = async (input, init = {}) => {
  const path = new URL(String(input), window.location.href).pathname;
  if (path.endsWith('/payments/latest')) return fixture.statusFails ? respond({ error: { message: 'Falha simulada ao consultar pagamento.' } }, 503) : respond({ payment: payment() });
  if (path.endsWith('/payments/westpay/pix')) return respond({ payment: payment() });
  if (path.endsWith('/receipt')) {
    if (init.method === 'PUT') {
      fixture.uploads += 1;
      if (fixture.uploadFails) return respond({ error: { message: 'Falha simulada no envio. Tente novamente.' } }, 503);
      fixture.receipt = { createdAt: new Date().toISOString(), mimeType: init.body.type, sizeBytes: init.body.size };
    }
    return respond({ receipt: fixture.receipt });
  }
  if (path.endsWith('/payment-receipts')) return respond({ items: fixture.receipt ? [{ ...fixture.receipt, paymentId: 'payment-review' }] : [] });
  if (path.endsWith('/payment-receipts/payment-review')) return new Response('%PDF-1.4\n%%EOF', { headers: { 'Content-Type': 'application/octet-stream' } });
  if (path.endsWith('/customer')) return respond({ customerCaptured: true });
  if (path.endsWith('/tracking/meta')) return respond({ pixelId: null });
  if (path.endsWith('/delivery')) return respond({ delivery: null });
  if (path.endsWith('/presence') || path.endsWith('/chromasense/events')) return new Response(null, { status: 204 });
  if (path.endsWith('/checkout-sessions/session-review')) return respond({ session });
  return respond({ error: { message: `Rota não prevista no teste: ${path}` } }, 500);
};
Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { if (fixture.clipboardFails) throw new Error('Clipboard denied in fixture'); } } });

function Review() {
  const [version, setVersion] = useState(0);
  const [merchant, setMerchant] = useState(false);
  const update = (key, value) => { fixture[key] = value; setVersion(number => number + 1); };
  return <>
    <aside aria-label="Controles de teste" style={{ padding: 12, background: '#eef2ff', color: '#172554', display: 'flex', flexWrap: 'wrap', gap: 12, font: '14px system-ui' }}>
      <b>Teste local · sem cobrança</b>
      <button onClick={() => update('expiresAt', new Date(Date.now() - 1000).toISOString())}>Expirar contador</button>
      <button onClick={() => update('status', 'EXPIRED')}>Provedor: expirado</button>
      <button onClick={() => update('status', 'PAID')}>Provedor: pago</button>
      <label><input type="checkbox" onChange={event => update('clipboardFails', event.target.checked)} /> Falhar cópia</label>
      <label><input type="checkbox" onChange={event => update('uploadFails', event.target.checked)} /> Falhar envio</label>
      <label><input type="checkbox" onChange={event => update('statusFails', event.target.checked)} /> Falhar consulta</label>
      <button onClick={() => setMerchant(value => !value)}>Alternar visão da loja</button>
      <span aria-label="Tentativas de envio">Envios: {fixture.uploads}</span>
    </aside>
    {merchant ? <OrderPaymentReceipts key={version} orderId="session-review" /> : <PublicSessionCheckout sessionId="session-review" token="token-ficticio-para-revisao-local-sem-acesso-real" />}
  </>;
}
createRoot(document.getElementById('root')).render(<Review />);
