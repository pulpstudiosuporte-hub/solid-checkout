import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AnalyticsPage from '../src/AnalyticsPage';
import '../src/admin-styles.css';
import '../src/admin-refresh.css';

let fail = false;
let empty = false;
// Dev-only data. Intentionally ignores AbortSignal to exercise stale-response guards.
window.fetch = async input => {
  const url = new URL(String(input), location.origin);
  const store = url.searchParams.get('store');
  const period = url.searchParams.get('period');
  const shouldFail = fail;
  const isEmpty = empty;
  await new Promise(resolve => setTimeout(resolve, period === 'year' ? 900 : 250));
  if (shouldFail) return new Response(JSON.stringify({ error: { message: 'Falha simulada de conexão.' } }), { status: 503 });
  const days = period === 'year' ? 250 : period === 'today' ? 1 : 7;
  const series = Array.from({ length: days }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), revenueCents: isEmpty ? 0 : (store === 'b' ? 200 : 100) * (index % 5 + 1), paidOrders: isEmpty ? 0 : index % 5 + 1 }));
  const revenueCents = series.reduce((sum, item) => sum + item.revenueCents, 0);
  return new Response(JSON.stringify({ revenueCents, paidOrders: isEmpty ? 0 : 1, conversionRate: 25, series, analytics: { sessions: 0, generatedOrders: 4, generatedRevenueCents: revenueCents + 300, abandoned: 0, checkoutSteps: { visitors: 4, personal: 3, shipping: 2, payment: 2, paid: 1 }, products: [{ title: `Produto da loja ${store}`, revenueCents, quantity: 1 }] } }), { headers: { 'Content-Type': 'application/json' } });
};
function Review() {
  const [store, setStore] = useState('a');
  return <div className="app solid-admin" style={{ minHeight: '100vh' }}><div style={{ width: '100%' }}><nav aria-label="Cenários de teste" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 12 }}><button onClick={() => setStore(store === 'a' ? 'b' : 'a')}>Trocar loja</button><button onClick={() => { fail = !fail; }}>Alternar erro</button><button onClick={() => { empty = !empty; }}>Alternar sem vendas</button><span>Loja {store}</span></nav><AnalyticsPage storeKey={store}/></div></div>;
}
createRoot(document.getElementById('root')).render(<Review/>);
