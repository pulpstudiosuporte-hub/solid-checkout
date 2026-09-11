import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import WebhooksPage from '../src/WebhooksPage';
import ChromaSensePage from '../src/ChromaSensePage';
import { defaultCheckoutConfig } from '../src/checkout-config';
import '../src/admin-styles.css';
import '../src/admin-refresh.css';

let activeStore = 'a';
let readonly = false;
let simulateFailure = false;
const records = {};
const sample = store => ({ publicId: `webhook-${store}`, name: `ERP Loja ${store.toUpperCase()}`, description: 'Endpoint fictício de teste.', url: 'https://example.com/webhook', active: true, events: ['order.paid'], _count: { deliveries: 1 }, deliveries: [{ status: 'DELIVERED', success: true }] });
// Local responses only. No fetch reaches an API or a webhook destination.
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
  const store = activeStore;
  const response = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  const method = init.method || 'GET';
  if (simulateFailure) return response({ error: { message: 'Falha de conexão simulada.' } }, 503);
  records[store] ||= [sample(store)];
  if (url.pathname === '/store-webhooks') {
    if (method === 'GET') return response({ items: records[store], writable: !readonly });
    if (readonly) return response({ error: { message: 'Sem permissão.' } }, 403);
    const form = JSON.parse(init.body);
    records[store].push({ ...sample(store), ...form, publicId: `created-${records[store].length}` });
    return response({ secret: 'chave-ficticia-para-teste-local-1234567890' }, 201);
  }
  if (url.pathname.startsWith('/store-webhooks/')) {
    if (readonly) return response({ error: { message: 'Sem permissão.' } }, 403);
    const id = url.pathname.split('/')[2];
    if (method === 'DELETE') { records[store] = records[store].filter(item => item.publicId !== id); return response({}, 204); }
    const item = records[store].find(item => item.publicId === id);
    if (url.pathname.endsWith('/test')) { item.deliveries = [{ status: 'PENDING', success: false }]; window.setTimeout(() => { item.deliveries = [{ status: 'DELIVERED', success: true }]; }, 1000); return response({ accepted: true }, 202); }
    Object.assign(item, JSON.parse(init.body)); return response({ item });
  }
  if (url.pathname === '/chromasense') {
    if (url.searchParams.get('period') === '90d') await new Promise(resolve => window.setTimeout(resolve, 300));
    const checkout = { publicId: `checkout-${store}`, name: `Checkout ${store.toUpperCase()}`, sessions: store === 'a' ? 12 : 4, preview: { config: defaultCheckoutConfig, product: { title: 'Produto de exemplo', priceCents: 14900 } } };
    return response({ checkouts: [checkout], summary: { sessions: checkout.sessions, clicks: 24, clickSessions: 8, attentionMs: 60000, conversionRate: 25, insightCount: 1 }, points: { click: [{ x: .4, y: .3, weight: 1 }] }, scroll: { average: 60, distribution: [12, 8, 4, 2] }, topTargets: [{ target: 'button', label: 'Botão', clicks: 24 }], insights: [{ key: 'rage', severity: 'high', title: 'Cliques repetidos detectados', description: 'Dados fictícios para revisão.' }], sessions: [{ publicId: `visit-${store}`, checkout, startedAt: new Date().toISOString(), device: 'mobile', events: 24, durationMs: 60000, maxScroll: 60, completed: true }] });
  }
  return response({ error: { message: `Endpoint não mapeado: ${url.pathname}` } }, 501);
};
Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Permissão negada no teste'); } } });

function Review() {
  const [page, setPage] = useState('Webhooks');
  const [store, setStore] = useState('a');
  const [viewer, setViewer] = useState(false);
  const [failure, setFailure] = useState(false);
  return <div className="app solid-admin"><div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
    <nav aria-label="Cenários locais" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16 }}>
      <button onClick={() => setPage('Webhooks')}>Webhooks</button><button onClick={() => setPage('ChromaSense')}>ChromaSense</button>
      <button onClick={() => { activeStore = store === 'a' ? 'b' : 'a'; setStore(activeStore); }}>Trocar loja</button>
      <label><input type="checkbox" checked={viewer} onChange={event => { readonly = event.target.checked; setViewer(readonly); }}/> Somente leitura</label>
      <label><input type="checkbox" checked={failure} onChange={event => { simulateFailure = event.target.checked; setFailure(simulateFailure); }}/> Simular falha</label>
    </nav>
    {page === 'Webhooks' ? <WebhooksPage key={String(viewer)} storeKey={store} csrfToken="local-test"/> : <ChromaSensePage storeKey={store}/>}
  </div></div>;
}
createRoot(document.getElementById('root')).render(<Review/>);
