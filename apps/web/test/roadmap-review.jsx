import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AdminContentPage from '../src/AdminContentPage';
import NewsRoadmapPage from '../src/NewsRoadmapPage';
import '../src/admin-styles.css';
import '../src/admin-refresh.css';
let fail = false;
let count = 0;
const items = [{ publicId: 'platform-freight', title: 'Novas integrações de frete', description: 'Melhor Envio, Superfrete e Frenet no catálogo de integrações.', type: 'SUGGESTION', status: 'PLANNED', approved: true, votes: 4, author: 'Equipe SOLID', store: 'Sem loja', createdAt: '2026-09-11T12:00:00Z' }];
window.fetch = async (input, init = {}) => {
  const path = new URL(String(input), location.origin).pathname;
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  await new Promise(resolve => setTimeout(resolve, 80));
  if (fail) return json({ error: { message: 'Falha simulada. Tente novamente.' } }, 503);
  if (path === '/admin/content') return json({ feedback: items, integrationAssets: [], releases: [] });
  if (path === '/platform-content') return json({ releases: [], integrationAssets: [] });
  if (path === '/product-feedback') return json({ items: items.filter(item => item.approved) });
  if (path === '/admin/content/feedback' && init.method === 'POST') { const item = { ...JSON.parse(init.body), publicId: `manual-${++count}`, author: 'Admin', store: 'Sem loja', votes: 0, createdAt: new Date().toISOString() }; items.push(item); return json({ feedback: item }, 201); }
  if (path.startsWith('/admin/content/feedback/')) {
    const index = items.findIndex(item => item.publicId === path.split('/').pop());
    if (index < 0) return json({ error: { message: 'Item não encontrado.' } }, 404);
    if (init.method === 'PATCH') Object.assign(items[index], JSON.parse(init.body));
    if (init.method === 'DELETE') items.splice(index, 1);
    return json({ updated: true });
  }
  return json({});
};
function Review() {
  const [page, setPage] = useState('admin');
  return <div className="app solid-admin"><div style={{ width: '100%' }}><nav aria-label="Cenários locais" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: 12 }}><button onClick={() => setPage('admin')}>Administração</button><button onClick={() => setPage('merchant')}>Visão do lojista</button><button onClick={() => { fail = !fail; }}>Alternar falha</button></nav>{page === 'admin' ? <AdminContentPage csrfToken="local"/> : <NewsRoadmapPage csrfToken="local"/>}</div></div>;
}
createRoot(document.getElementById('root')).render(<Review/>);
