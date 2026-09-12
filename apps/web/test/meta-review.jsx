import { createRoot } from 'react-dom/client';
import { PublicSessionCheckout } from '../src/PublicCheckout';
import '../src/public-checkout.css';
import MetaIntegration from '../src/MetaIntegration';
import '../src/admin-styles.css';
import '../src/admin-refresh.css';

let stored = { connected: false, pixelId: '', serverEnabled: false };
const session = { publicId: 'meta-session', status: 'OPEN', expiresAt: new Date(Date.now() + 1800000).toISOString(), source: 'DIRECT', customerCaptured: false, quantity: 1, unitPriceCents: 14900, totalCents: 14900, discountCents: 0, shippingPriceCents: 0, currency: 'BRL', checkout: { name: 'Loja teste Meta', product: { publicId: 'product-meta', checkoutTitle: 'Produto teste', fulfillmentType: 'DIGITAL' }, publishedConfig: { socialProofEnabled: false, showCoupon: false } } };
let payment = null;
window.fetch = async (input, init = {}) => {
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
  const path = new URL(String(input), location.href).pathname;
  if (path.endsWith('/integrations/meta/status')) return json(stored);
  if (path.endsWith('/tracking/meta')) return json({ pixelId: '123456789012345' });
  if (path.endsWith('/checkout-sessions/meta-session')) return json({ session });
  if (path.endsWith('/payments/latest')) return json({ payment });
  if (path.endsWith('/payments/westpay/pix')) { payment = { publicId: 'payment-meta', status: 'PENDING', amountCents: 14900, pixCode: 'PIX-LOCAL-SEM-COBRANCA', expiresAt: new Date(Date.now() + 600000).toISOString() }; return json({ payment }); }
  if (path.endsWith('/customer')) return json({ customerCaptured: true });
  if (path.endsWith('/presence')) return new Response(null, { status: 204 });
  if (init.method === 'PUT') {
    const body = JSON.parse(init.body);
    stored = { connected: true, pixelId: body.pixelId, serverEnabled: body.serverEnabled, serverVerified: false };
    return json(stored);
  }
  return json({});
};
function Review() {
  if (location.search.includes('checkout')) return <><button onClick={() => { if (payment) payment.status = 'PAID'; }}>Confirmar pagamento simulado</button><PublicSessionCheckout sessionId="meta-session" token="local-only-meta-checkout-token"/></>;
  return <div className="app solid-admin"><div style={{ width: '100%', maxWidth: 1250, margin: 'auto', padding: 20, boxSizing: 'border-box' }}><MetaIntegration csrfToken="local" storeKey="meta-review"/></div></div>;
}
createRoot(document.getElementById('root')).render(<Review/>);
