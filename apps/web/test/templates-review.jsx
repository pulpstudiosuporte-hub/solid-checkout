// Local fixture only. All network requests are replaced; no real order is created.
import { createRoot } from 'react-dom/client';
import { PublicSessionCheckout } from '../src/PublicCheckout';
import CheckoutEditor from '../src/CheckoutEditor';
import { defaultCheckoutConfig } from '../src/checkout-config';
import { structuralCheckoutTemplates } from '../src/checkout-template-catalog';
import { templates } from '../src/theme-kit/templates.mjs';
import '../src/admin-styles.css';
import '../src/public-checkout.css';
const query = new URLSearchParams(location.search);
const config = { ...defaultCheckoutConfig, ...(structuralCheckoutTemplates[query.get('template') || 'retail']?.preset || templates.minimal.config), logoText: 'AURORA', title: 'Finalize seu pedido', subtitle: 'Informe seus dados para continuar.', showTrust: false, showBump: false, socialProofEnabled: false, footerCompanyName: 'Aurora', footerText: 'Loja de demonstração', footerPaymentMethods: ['pix'], showSummary: !query.has('no-summary') };
const product = { publicId: 'demo-product', checkoutTitle: 'Tênis urbano · Branco', priceCents: 14900, fulfillmentType: 'PHYSICAL' };
if (query.has('pink')) Object.assign(config, { primary: '#ff0797', pageBg: '#fff5fa', borderColor: '#ffc4e5', inputBg: '#fff8fc', radius: 18, font: 'Poppins' });
if (query.has('gallery')) {
  config.logoText = query.has('pink') ? 'ATELIÊ' : query.has('natural') ? 'BOTÂNICA' : query.get('template') === 'retail' ? 'URBANO' : query.get('template') === 'marketplace' ? 'VITRINE' : 'ESSENCIAL';
  config.footerCompanyName = config.logoText;
  if (query.has('pink')) Object.assign(config, { buttonBgColor: '#bb3569', primary: '#bb3569' });
  if (query.has('natural')) Object.assign(config, { primary: '#28634a', buttonBgColor: '#28634a', pageBg: '#edf3ee', cardBg: '#ffffff', borderColor: '#c8d9cc', inputBg: '#f8faf8', radius: 18 });
}
if (query.has('narrow')) config.contentWidth = 760;
const session = { publicId: 'template-session', source: 'DIRECT', status: 'OPEN', expiresAt: new Date(Date.now() + 1800000).toISOString(), quantity: 1, unitPriceCents: 14900, totalCents: 14900, discountCents: 0, shippingPriceCents: 0, customerCaptured: false, checkout: { name: 'Aurora', product, publishedConfig: config } };
let payment = null;
const method = { publicId: 'delivery', name: 'Entrega de teste', priceCents: 1000, minDays: 2, maxDays: 4 };
const json = (value, status = 200) => Promise.resolve(new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }));
window.fetch = async (input, init = {}) => {
  const path = new URL(String(input), location.href).pathname;
  if (path.includes('postal-code')) return json({ address: { street: 'Rua de teste', neighborhood: 'Centro', city: 'São Paulo', state: 'SP' } });
  if (path.endsWith('/payments/latest')) return json({ payment });
  if (path.endsWith('/payments/westpay/pix')) { payment = { publicId: 'test-payment', status: 'PENDING', amountCents: 15900, pixCode: 'TESTE-SEM-VALOR-FINANCEIRO', expiresAt: session.expiresAt }; return json({ payment }); }
  if (path.endsWith('/customer')) return json({ customerCaptured: true });
  if (path.endsWith('/shipping')) return json({ shippingCaptured: true });
  if (path.endsWith('/shipping-methods')) return json({ items: [method] });
  if (path.endsWith('/shipping-method')) return json({ shippingMethod: method, shippingPriceCents: 1000, grandTotalCents: 15900 });
  if (path.endsWith('/quantity')) { session.quantity = JSON.parse(init.body).quantity; session.totalCents = session.quantity * 14900; return json({ session, update: { totalCents: session.totalCents, grandTotalCents: session.totalCents } }); }
  if (path.endsWith('/template-session')) return json({ session });
  if (path.endsWith('/presence') || path.endsWith('/chromasense/events')) return Promise.resolve(new Response(null, { status: 204 }));
  return json({ items: [], pixelId: null, measurementId: null });
};
createRoot(document.getElementById('root')).render(query.has('editor') ? <CheckoutEditor checkout={{ publicId: 'demo', name: 'Teste', draftConfig: config }} products={[]} onBack={() => {}} onSaveDraft={async () => {}} onPublish={async () => {}}/> : <PublicSessionCheckout sessionId={session.publicId} token="local-fixture"/>);
