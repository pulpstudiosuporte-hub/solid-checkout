import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CheckoutEditor from '../src/CheckoutEditor';
import { PublicSessionCheckout } from '../src/PublicCheckout';
import { defaultCheckoutConfig } from '../src/checkout-config';
import '../src/admin-styles.css';
import '../src/admin-refresh.css';
import '../src/public-checkout.css';
const query = new URLSearchParams(location.search);
const config = { ...defaultCheckoutConfig, timer: false, exitOfferEnabled: true, exitOfferCouponCode: 'FICA10', exitOfferDelaySeconds: 5, exitOfferTimedEnabled: query.has('timed'), exitOfferTimedSeconds: 8, socialProofEnabled: false, showBump: false };
const expiry = new Date(Date.now() + 300000).toISOString();
const session = { publicId: 'exit-review-session', status: 'OPEN', source: 'DIRECT', expiresAt: expiry, customerCaptured: false, quantity: 1, unitPriceCents: 10000, totalCents: 10000, discountCents: 0, shippingPriceCents: 0, checkout: { name: 'Loja de teste', product: { publicId: 'product-demo', checkoutTitle: 'Curso de fotografia', priceCents: 10000, fulfillmentType: 'DIGITAL' }, publishedConfig: config } };
window.fetch = async (input, init = {}) => {
  const path = new URL(String(input), location.href).pathname;
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  if (path === '/coupons') return json({ items: [{ publicId: 'coupon-demo', code: 'FICA10', type: 'PERCENT', value: 1000, active: true }] });
  if (path.endsWith('/exit-offer')) return json({ offer: query.has('unavailable') ? null : { code: 'FICA10', type: 'PERCENT', value: 1000, couponDiscountCents: 1000, expiresAt: query.has('short') ? new Date(Date.now() + 15000).toISOString() : expiry } });
  if (path.endsWith('/coupon')) { if (query.has('fail')) return json({ error: { message: 'Cupom indisponível. Seu pedido não foi alterado.' } }, 400); const { code } = JSON.parse(init.body); return json({ coupon: { code, discountCents: 1000, paymentDiscountCents: 0, grandTotalCents: 9000 } }); }
  if (path.endsWith('/payments/latest')) return json({ payment: null });
  if (path === '/public/checkout-sessions/exit-review-session') return json({ session });
  return json({ items: [] });
};
function Review() {
  const [saved, setSaved] = useState(false);
  if (query.has('buyer')) return <PublicSessionCheckout sessionId={session.publicId} token="local-fixture-token"/>;
  return <><CheckoutEditor checkout={{ publicId: 'checkout-demo', name: 'Checkout de demonstração', draftConfig: config }} products={[]} onBack={() => {}} onSaveDraft={async (savedConfig) => { setSaved(savedConfig); }} onPublish={async () => {}}/>{saved && <output style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99999 }}>Rascunho salvo no teste{saved.exitOfferTimedEnabled && `: oferta após ${saved.exitOfferTimedSeconds}s`}</output>}</>;
}
createRoot(document.getElementById('root')).render(<Review/>);
