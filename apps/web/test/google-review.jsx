import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import GoogleIntegration from '../src/GoogleIntegration';
import GoogleCheckoutTracking from '../src/GoogleCheckoutTracking';
import ShopifyIntegration from '../src/ShopifyIntegration';
import AdminContentPage from '../src/AdminContentPage';
import '../src/admin-styles.css';
import '../src/admin-refresh.css';

const empty = { mode: 'direct', measurementId: '', propertyId: '', adsId: '', conversionLabel: '', containerId: '' };
let store = 'a';
let viewer = false;
let fail = false;
let paid = false;
let created = false;
const records = {};
const assets = {};
const scripts = [];
const append = document.head.appendChild.bind(document.head);
document.head.appendChild = element => {
  if (element.tagName === 'SCRIPT' && element.src.includes('googletagmanager.com')) { scripts.push(element.src); return element; }
  return append(element);
};
// Dev-only harness: all API responses and Google scripts stay local.
window.fetch = async (input, init = {}) => {
  const path = new URL(String(input), location.origin).pathname;
  const currentStore = store;
  const body = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
  if (fail) return new Response(JSON.stringify({ error: { message: 'Falha simulada de conexão.' } }), { status: 503 });
  if (path.endsWith('/integrations/google')) {
    if (init.method === 'DELETE') { delete records[currentStore]; return new Response(null, { status: 204 }); }
    if (init.method === 'PUT') records[currentStore] = JSON.parse(init.body);
    return body({ configured: Boolean(records[currentStore]), writable: !viewer, config: records[currentStore] || empty });
  }
  if (path.endsWith('/tracking/google')) return body({ config: records[currentStore] || { ...empty, measurementId: 'G-ABCDE12345', adsId: 'AW-12345678', conversionLabel: 'test_label' }, scope: `store-${currentStore}`, checkoutId: 'checkout-test', transactionId: 'order-test', purchase: paid, orderValue: 109, ecommerce: { currency: 'BRL', value: 99, shipping: 10, items: [{ item_id: 'product-a', item_name: 'Produto de teste', quantity: 1, price: 99 }] } });
  if (path.includes('/admin/content/integrations/')) { const asset = JSON.parse(init.body); assets[path.split('/').pop()] = asset; return body({ asset }); }
  if (path.endsWith('/platform-content') || path.endsWith('/admin/content')) return body({ integrationAssets: Object.values(assets), feedback: [], releases: [] });
  if (path.endsWith('/status')) return body({ connected: false });
  return body({});
};

function Review() {
  const [activeStore, setActiveStore] = useState('a');
  const [readonly, setReadonly] = useState(false);
  const [page, setPage] = useState('config');
  const [payment, setPayment] = useState('PENDING');
  const [generated, setGenerated] = useState(false);
  const [snapshot, setSnapshot] = useState('');
  useEffect(() => { const timer = setInterval(() => setSnapshot(JSON.stringify({ scripts, events: (window.dataLayer || []).filter(item => item[0] === 'event' || item.event).map(item => item[0] === 'event' ? { event: item[1], data: item[2] } : item) }, null, 2)), 100); return () => clearInterval(timer); }, []);
  return <div className="app solid-admin"><div style={{ width: '100%', maxWidth: 1250, margin: 'auto', padding: 20, boxSizing: 'border-box' }}>
    <nav aria-label="Cenários de teste" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}><button className="secondary" onClick={() => setPage('config')}>Configuração</button><button className="secondary" onClick={() => setPage('catalog')}>Catálogo</button><button className="secondary" onClick={() => setPage('admin')}>Administração</button><button className="secondary" onClick={() => setPage('checkout')}>Checkout de teste</button><button className="secondary" onClick={() => { store = activeStore === 'a' ? 'b' : 'a'; setActiveStore(store); }}>Trocar loja</button><label><input type="checkbox" checked={readonly} onChange={event => { viewer = event.target.checked; setReadonly(viewer); }}/> Somente leitura</label><button className="secondary" onClick={() => { fail = !fail; }}>Alternar falha</button></nav>
    {page === 'config' ? <GoogleIntegration storeKey={`${activeStore}:${readonly}`} csrfToken="local"/> : page === 'admin' ? <AdminContentPage csrfToken="local"/> : page === 'catalog' ? <ShopifyIntegration storeKey={`${activeStore}:${readonly}`} csrfToken="local"/> : <><h1>Checkout de teste</h1><p>Produto de teste · R$ 109,00 com frete</p><button className="primary" onClick={() => { created = true; setGenerated(created); }}>Gerar Pix simulado</button><button className="secondary" onClick={() => { paid = true; setPayment('PAID'); }}>Confirmar pagamento simulado</button><GoogleCheckoutTracking sessionId="session-test" token="test-token" paymentStatus={payment} paymentCreated={generated} shippingSelected={true} checkoutRevision="1"/><pre aria-label="Eventos locais" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{snapshot}</pre></>}
  </div></div>;
}
createRoot(document.getElementById('root')).render(<Review/>);
