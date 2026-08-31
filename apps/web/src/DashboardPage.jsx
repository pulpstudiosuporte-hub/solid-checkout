import React, { useEffect, useId, useState } from 'react';
import { ArrowRight, CircleDollarSign, Globe2, LoaderCircle, Radio, ShoppingCart, TrendingUp } from 'lucide-react';
import { getDashboard } from './api';

const WorldMap = React.lazy(() => import('./components/ui/WorldMap').then(module => ({ default: module.WorldMap })));

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compactMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

function Metric({ icon: Icon, label, value, tone, helper }) {
  return <article className={`dashboard-metric card ${tone}`}>
    <div className="dashboard-metric-top"><span className="metric-label">{label}</span><span className={`metric-icon ${tone}`}><Icon size={19}/></span></div>
    <strong>{value}</strong>
    <small><i/>{helper}</small>
  </article>;
}

function RevenueChart({ series }) {
  const gradientId = useId().replace(/:/g, '');
  const [activeIndex, setActiveIndex] = useState(null);
  const width = 680;
  const top = 18;
  const bottom = 206;
  const max = Math.max(1, ...series.map(item => item.revenueCents));
  const coordinates = series.map((item, index) => ({
    ...item,
    x: series.length === 1 ? width / 2 : index * width / (series.length - 1),
    y: bottom - (item.revenueCents / max) * (bottom - top),
  }));
  const smoothPath = coordinates.length ? coordinates.reduce((path, point, index, list) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = list[index - 1];
    const before = list[index - 2] || previous;
    const after = list[index + 1] || point;
    const controlOneX = previous.x + (point.x - before.x) / 6;
    const controlOneY = previous.y + (point.y - before.y) / 6;
    const controlTwoX = point.x - (after.x - previous.x) / 6;
    const controlTwoY = point.y - (after.y - previous.y) / 6;
    return `${path} C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${point.x} ${point.y}`;
  }, '') : '';
  const area = smoothPath ? `${smoothPath} L ${coordinates.at(-1).x} ${bottom} L ${coordinates[0].x} ${bottom} Z` : '';
  const active = activeIndex === null ? null : coordinates[activeIndex];
  const selectNearest = event => {
    if (!coordinates.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    setActiveIndex(Math.round((relativeX / bounds.width) * (coordinates.length - 1)));
  };

  return <div className="dashboard-chart-layout">
    <div className="dashboard-y-axis"><span>{compactMoney.format(max / 100)}</span><span>{compactMoney.format(max / 200)}</span><span>R$ 0</span></div>
    <div className="chart dashboard-chart" onPointerMove={selectNearest} onPointerLeave={() => setActiveIndex(null)}>
      <svg viewBox={`0 0 ${width} 230`} preserveAspectRatio="none" role="img" aria-label="Evolução da receita confirmada no período">
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7357e9" stopOpacity=".28"/><stop offset="1" stopColor="#7357e9" stopOpacity="0"/></linearGradient></defs>
        <g className="gridlines dashboard-gridlines">{coordinates.map(item => <line key={item.date} x1={item.x} y1={top} x2={item.x} y2={bottom}/>)}</g>
        {area && <path d={area} fill={`url(#${gradientId})`}/>}<path className="line dashboard-smooth-line" d={smoothPath} fill="none"/>
        {active && <g className="chart-active-marker"><line x1={active.x} y1={top} x2={active.x} y2={bottom}/><circle cx={active.x} cy={active.y} r="6"/></g>}
        {coordinates.map((item, index) => <circle key={item.date} className="chart-hit-point" cx={item.x} cy={item.y} r="10" tabIndex="0" onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}><title>{`${item.date}: ${money.format(item.revenueCents / 100)} · ${item.paidOrders} pedidos`}</title></circle>)}
      </svg>
      {active && <div className={`dashboard-chart-tooltip ${activeIndex === 0 ? 'edge-left' : activeIndex === coordinates.length - 1 ? 'edge-right' : ''}`} style={{ left: `${(active.x / width) * 100}%`, top: `${(active.y / 230) * 100}%` }} role="status"><b>Dia: {active.date.slice(8, 10)}/{active.date.slice(5, 7)}</b><span>Receita: {money.format(active.revenueCents / 100)}</span><small>{active.paidOrders} {active.paidOrders === 1 ? 'pedido pago' : 'pedidos pagos'}</small></div>}
      <div className="x-labels">{series.map(item => <span key={item.date}>{item.date.slice(8, 10)}/{item.date.slice(5, 7)}</span>)}</div>
    </div>
  </div>;
}

export default function DashboardPage({ setPage, storeKey }) {
  const [geoPeriod, setGeoPeriod] = useState('today');
  const [liveTick, setLiveTick] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '', storeKey: null });
  const [geoState, setGeoState] = useState({ data: null, error: '', storeKey: null, period: 'today' });

  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: '', ...(current.storeKey === storeKey ? {} : { data: null, storeKey }) }));
    getDashboard('today', controller.signal).then(data => setState({ loading: false, data, error: '', storeKey })).catch(error => {
      if (error.name !== 'AbortError') setState(current => ({ ...current, loading: false, error: error.message, storeKey }));
    });
    return () => controller.abort();
  }, [storeKey, liveTick]);
  useEffect(() => {
    if (geoPeriod === 'today') return;
    const controller = new AbortController();
    getDashboard(geoPeriod, controller.signal).then(data => setGeoState({ data, error: '', storeKey, period: geoPeriod })).catch(error => {
      if (error.name !== 'AbortError') setGeoState({ data: null, error: error.message, storeKey, period: geoPeriod });
    });
    return () => controller.abort();
  }, [geoPeriod, storeKey]);
  useEffect(() => { const interval = window.setInterval(() => setLiveTick(value => value + 1), 30_000); return () => window.clearInterval(interval); }, []);

  if (state.loading && !state.data) return <main className="page"><div className="products-state"><LoaderCircle className="spin"/><b>Carregando indicadores...</b></div></main>;
  if (!state.data) return <main className="page"><div className="products-state error"><b>Não foi possível carregar a visão geral</b><span>{state.error}</span></div></main>;

  const data = state.data;
  const analytics = data.analytics || {
    sessions: data.paidOrders + data.pendingPix,
    generatedRevenueCents: data.revenueCents,
  };
  const selectedGeoData = geoPeriod === 'today' ? data : (geoState.storeKey === storeKey && geoState.period === geoPeriod ? geoState.data : null);
  const geography = selectedGeoData?.analytics?.geography || { locations: [], countries: 0, regions: 0, cities: 0, visitors: 0 };
  const locations = Array.isArray(geography.locations) ? geography.locations : [];
  const firstName = data.userName?.split(' ')[0] || 'empreendedor';
  const hour = new Date().getHours(); const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return <main className="page home-overview">
    <header className="home-greeting"><h1>{greeting}, {firstName}!</h1><button onClick={() => setPage('Análises')}><TrendingUp size={16}/> Ver análises completas</button></header>
    <section className="home-kpis" aria-label="Indicadores de hoje">
      <Metric icon={Radio} label="Visitantes agora" value={Number(data.activeVisitors || 0)} tone="green" helper="Ativos no último minuto"/>
      <Metric icon={CircleDollarSign} label="Pedidos gerados" value={money.format(analytics.generatedRevenueCents / 100)} tone="purple" helper={`${Number(analytics.generatedOrders || 0)} Pix gerados`}/>
      <Metric icon={ShoppingCart} label="Pedidos hoje" value={data.paidOrders} tone="blue" helper="Pagamentos aprovados"/>
      <Metric icon={TrendingUp} label="Taxa de conversão" value={`${data.conversionRate.toLocaleString('pt-BR')}%`} tone="orange" helper="Sessões que viraram venda"/>
    </section>
    <section className="home-main-grid">
      <article className="card home-geo"><div className="home-card-title"><div><h2>Alcance geográfico</h2><p>Onde seus visitantes estão acessando o checkout.</p></div><select value={geoPeriod} onChange={event => setGeoPeriod(event.target.value)} aria-label="Período do alcance"><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="month">Este mês</option></select></div><div className={`dot-map world ${locations.length ? 'has-locations' : ''}`}><React.Suspense fallback={<LoaderCircle className="spin" aria-label="Carregando mapa"/>}><WorldMap locations={locations}/></React.Suspense>{!locations.length && <><Globe2 size={28}/><span>{geoState.error && geoPeriod !== 'today' ? 'Não foi possível atualizar o mapa agora.' : 'O mapa começará a preencher com as próximas visitas identificadas pela Cloudflare.'}</span></>}</div>{locations.length > 0 && <div className="geo-location-list">{locations.slice(0,5).map((location,index)=><span key={`${location.country}-${location.region}-${location.city}-${index}`}><b>{location.city || location.region || location.country}</b><small>{location.region ? `${location.region} · ` : ''}{location.country} · {location.visitors}</small></span>)}</div>}<div className="home-geo-stats"><div><span>Cidades alcançadas</span><strong>{Number(geography.cities || 0)}</strong><small>{Number(geography.regions || 0)} regiões</small></div><div><span>Visitantes localizados</span><strong>{Number(geography.visitors || 0)}</strong><small>No período selecionado</small></div><div><span>Países alcançados</span><strong>{Number(geography.countries || 0)}</strong><small>Localização anonimizada</small></div></div></article>
      <aside className="card home-news"><div className="home-news-cover"><span>NOVIDADES SOLID</span><b>Seu painel de conversão evoluiu</b></div>{[['Catálogo de integrações renovado','Agora'],['Busca avançada no painel','Agora'],['Checkout responsivo e personalizável','Recente'],['Webhooks duráveis por loja','Recente']].map(([title,time]) => <button key={title} onClick={() => setPage('Novidades')}><span>{title}</span><small>{time}</small><ArrowRight size={15}/></button>)}<button className="home-news-cta" onClick={() => setPage('Novidades')}>Ver novidades e roadmap <ArrowRight size={16}/></button></aside>
    </section>
    <section className="home-tools"><h2>Ferramentas para expandir seu negócio</h2><p>Configure os recursos essenciais para aumentar sua conversão.</p><div><button onClick={() => setPage('Checkouts')}><b>Personalize seu checkout</b><span>Edite layout, conteúdo e elementos de conversão.</span><ArrowRight size={17}/></button><button onClick={() => setPage('Order bumps')}><b>Aumente o ticket médio</b><span>Crie ofertas complementares no checkout.</span><ArrowRight size={17}/></button><button onClick={() => setPage('Carrinhos')}><b>Recupere vendas</b><span>Acompanhe oportunidades que não foram concluídas.</span><ArrowRight size={17}/></button></div></section>
  </main>;
}
