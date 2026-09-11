import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CircleDollarSign, Globe2, LoaderCircle, Radio, ShoppingCart, Sparkles, TrendingUp } from 'lucide-react';
import { getDashboard, getPlatformContent } from './api';
import { dashboardNewsItems } from './platform-content';
import RevenueOverview from './RevenueOverview';

const WorldMap = React.lazy(() => import('./components/ui/WorldMap').then(module => ({ default: module.WorldMap })));

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function Metric({ icon: Icon, label, value, tone, helper }) {
  return <article className={`dashboard-metric card ${tone}`}>
    <div className="dashboard-metric-top"><span className="metric-label">{label}</span><span className={`metric-icon ${tone}`}><Icon size={19}/></span></div>
    <strong>{value}</strong>
    <small><i/>{helper}</small>
  </article>;
}

export default function DashboardPage({ setPage, storeKey }) {
  const [geoPeriod, setGeoPeriod] = useState('today');
  const [liveTick, setLiveTick] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '', storeKey: null });
  const [geoState, setGeoState] = useState({ data: null, error: '', storeKey: null, period: 'today' });
  const [newsState, setNewsState] = useState({ loading: true, items: [], error: '' });

  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: '', ...(current.storeKey === storeKey ? {} : { data: null, storeKey }) }));
    getDashboard('today', controller.signal).then(data => setState({ loading: false, data, error: '', storeKey })).catch(error => {
      if (error.name !== 'AbortError') setState(current => ({ ...current, loading: false, error: error.message, storeKey }));
    });
    return () => controller.abort();
  }, [storeKey, liveTick]);
  useEffect(() => { const controller = new AbortController(); getPlatformContent(controller.signal).then(result => setNewsState({ loading: false, items: result.releases || [], error: '' })).catch(error => { if (error.name !== 'AbortError') setNewsState({ loading: false, items: [], error: error.message }); }); return () => controller.abort(); }, []);
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
  const newsItems = dashboardNewsItems(newsState.items);
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
    <header className="home-greeting"><div><p className="eyebrow">SUA OPERAÇÃO, EM UM SÓ LUGAR</p><h1>{greeting}, {firstName}!</h1><p>Uma visão clara do que acontece na sua loja.</p></div><div className="home-greeting-actions"><span className="home-today">{new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date())}</span><button className="secondary" onClick={() => setPage('Análises')}><TrendingUp size={16}/> Ver análises completas</button></div></header>
    <section className="home-kpis" aria-label="Indicadores de hoje">
      <Metric icon={Radio} label="Visitantes agora" value={Number(data.activeVisitors || 0)} tone="green" helper="Ativos no último minuto"/>
      <Metric icon={CircleDollarSign} label="Pedidos gerados" value={money.format(analytics.generatedRevenueCents / 100)} tone="purple" helper={`${Number(analytics.generatedOrders || 0)} Pix gerados`}/>
      <Metric icon={ShoppingCart} label="Pedidos hoje" value={data.paidOrders} tone="blue" helper="Pagamentos aprovados"/>
      <Metric icon={TrendingUp} label="Taxa de conversão" value={`${data.conversionRate.toLocaleString('pt-BR')}%`} tone="orange" helper="Sessões que viraram venda"/>
    </section>
    <section className="home-main-grid">
      <article className="card home-geo"><div className="home-card-title"><div><h2>Alcance geográfico</h2><p>Onde seus visitantes estão acessando o checkout.</p></div><select value={geoPeriod} onChange={event => setGeoPeriod(event.target.value)} aria-label="Período do alcance"><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="month">Este mês</option></select></div><div className={`dot-map world ${locations.length ? 'has-locations' : ''}`}><React.Suspense fallback={<LoaderCircle className="spin" aria-label="Carregando mapa"/>}><WorldMap locations={locations}/></React.Suspense>{!locations.length && <><Globe2 size={28}/><span>{geoState.error && geoPeriod !== 'today' ? 'Não foi possível atualizar o mapa agora.' : 'O mapa começará a preencher com as próximas visitas identificadas pela Cloudflare.'}</span></>}</div>{locations.length > 0 && <div className="geo-location-list">{locations.slice(0,5).map((location,index)=><span key={`${location.country}-${location.region}-${location.city}-${index}`}><b>{location.city || location.region || location.country}</b><small>{location.region ? `${location.region} · ` : ''}{location.country} · {location.visitors}</small></span>)}</div>}<div className="home-geo-stats"><div><span>Cidades alcançadas</span><strong>{Number(geography.cities || 0)}</strong><small>{Number(geography.regions || 0)} regiões</small></div><div><span>Visitantes localizados</span><strong>{Number(geography.visitors || 0)}</strong><small>No período selecionado</small></div><div><span>Países alcançados</span><strong>{Number(geography.countries || 0)}</strong><small>Localização anonimizada</small></div></div></article>
      <aside className="card home-news"><div className="home-news-cover"><span>NOVIDADES SOLID</span><b>{newsState.items[0]?.title || 'Acompanhe a evolução da plataforma'}</b></div>{newsState.loading ? <div className="home-news-state"><LoaderCircle className="spin"/> Carregando novidades...</div> : newsState.error ? <div className="home-news-state error"><AlertCircle size={17}/> Novidades indisponíveis agora</div> : newsItems.length ? newsItems.map(([id,title,time]) => <button key={id} onClick={() => setPage('Novidades')}><span>{title}</span><small>{time}</small><ArrowRight size={15}/></button>) : <div className="home-news-state"><Sparkles size={17}/> Nenhuma novidade publicada</div>}<button className="home-news-cta" onClick={() => setPage('Novidades')}>Ver novidades e roadmap <ArrowRight size={16}/></button></aside>
    </section>
    <RevenueOverview storeKey={storeKey} onOrders={() => setPage('Pedidos')}/>
    <section className="home-tools"><h2>Ferramentas para expandir seu negócio</h2><p>Configure os recursos essenciais para aumentar sua conversão.</p><div><button onClick={() => setPage('Checkouts')}><b>Personalize seu checkout</b><span>Edite layout, conteúdo e elementos de conversão.</span><ArrowRight size={17}/></button><button onClick={() => setPage('Order bumps')}><b>Aumente o ticket médio</b><span>Crie ofertas complementares no checkout.</span><ArrowRight size={17}/></button><button onClick={() => setPage('Carrinhos')}><b>Recupere vendas</b><span>Acompanhe oportunidades que não foram concluídas.</span><ArrowRight size={17}/></button></div></section>
  </main>;
}
