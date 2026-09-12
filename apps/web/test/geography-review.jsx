import { createRoot } from 'react-dom/client';
import DashboardPage from '../src/DashboardPage';
import '../src/admin-styles.css';
import '../src/admin-refresh.css';
const locations = [
  { country: 'BR', region: 'SP', city: 'São Paulo', latitude: -23.5505, longitude: -46.6333, visitors: 7 },
  { country: 'BR', region: 'AM', city: 'Manaus', latitude: -3.119, longitude: -60.0217, visitors: 3 },
  { country: 'BR', region: 'DF', city: 'Brasília', latitude: -15.7939, longitude: -47.8828, visitors: 2 },
  { country: 'BR', region: 'PE', city: 'Recife', latitude: -8.0476, longitude: -34.877, visitors: 2 },
  { country: 'GB', region: 'ENG', city: 'Londres', latitude: 51.5074, longitude: -0.1278, visitors: 1 },
  { country: 'US', region: 'NY', city: null, latitude: 40.7128, longitude: -74.006, visitors: 1 },
  { country: 'BR', region: 'SP', city: 'Sem coordenadas', latitude: null, longitude: null, visitors: 1 },
];
const empty = new URLSearchParams(window.location.search).has('empty');
const originalFetch = window.fetch.bind(window);
window.fetch = async input => {
  const path = new URL(String(input), location.origin).pathname;
  if (path !== '/platform-content' && !path.includes('dashboard')) return originalFetch(input);
  return new Response(JSON.stringify(path === '/platform-content' ? { releases: [] } : { userName: 'Revisão local', revenueCents: 0, paidOrders: 0, pendingPix: 0, conversionRate: 0, activeVisitors: 0, series: [], analytics: { generatedRevenueCents: 0, sessions: empty ? 0 : 17, geography: { locations: empty ? [] : locations, cities: empty ? 0 : 5, countries: empty ? 0 : 3, regions: empty ? 0 : 6, visitors: empty ? 0 : 17 } }, checklist: {} }), { headers: { 'Content-Type': 'application/json' } });
};
createRoot(document.getElementById('root')).render(<div className="app solid-admin"><div style={{ width: '100%' }}><DashboardPage storeKey="test-store" setPage={() => {}}/></div></div>);
