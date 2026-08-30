import React, { useEffect, useId, useState } from 'react';
import { ArrowRight, CircleDollarSign, Globe2, LoaderCircle, Radio, ShoppingCart, TrendingUp } from 'lucide-react';
import { getDashboard } from './api';

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
  const [period, setPeriod] = useState('today');
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, data: null, error: '' });
    getDashboard(period, controller.signal).then(data => setState({ loading: false, data, error: '' })).catch(error => {
      if (error.name !== 'AbortError') setState({ loading: false, data: null, error: error.message });
    });
    return () => controller.abort();
  }, [period, storeKey]);

  if (state.loading) return <main className="page"><div className="products-state"><LoaderCircle className="spin"/><b>Carregando indicadores...</b></div></main>;
  if (!state.data) return <main className="page"><div className="products-state error"><b>Não foi possível carregar a visão geral</b><span>{state.error}</span></div></main>;

  const data = state.data;
  const firstName = data.userName?.split(' ')[0] || 'empreendedor';
  const hour = new Date().getHours(); const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return <main className="page home-overview">
    <header className="home-greeting"><h1>{greeting}, {firstName}!</h1><button onClick={() => setPage('Análises')}><TrendingUp size={16}/> Ver análises completas</button></header>
    <section className="home-kpis" aria-label="Indicadores de hoje">
      <Metric icon={Radio} label="Visitantes agora" value={data.analytics.sessions} tone="green" helper="Atualização ao vivo"/>
      <Metric icon={CircleDollarSign} label="Pedidos gerados" value={money.format(data.analytics.generatedRevenueCents / 100)} tone="purple" helper={`${data.analytics.sessions} sessões criadas`}/>
      <Metric icon={ShoppingCart} label="Pedidos hoje" value={data.paidOrders} tone="blue" helper="Pagamentos aprovados"/>
      <Metric icon={TrendingUp} label="Taxa de conversão" value={`${data.conversionRate.toLocaleString('pt-BR')}%`} tone="orange" helper="Sessões que viraram venda"/>
    </section>
    <section className="home-main-grid">
      <article className="card home-geo"><div className="home-card-title"><div><h2>Alcance geográfico</h2><p>Onde seus visitantes estão acessando o checkout.</p></div><select value={period} onChange={event => setPeriod(event.target.value)} aria-label="Período do alcance"><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="month">Este mês</option></select></div><div className="dot-map world"><Globe2 size={28}/><span>O mapa será preenchido quando a localização anonimizada estiver ativa.</span></div><div className="home-geo-stats"><div><span>Cidades alcançadas</span><strong>0</strong><small>Dados em preparação</small></div><div><span>Visitantes</span><strong>{data.analytics.sessions}</strong><small>No período selecionado</small></div><div><span>Taxa de crescimento</span><strong>—</strong><small>Comparativo em preparação</small></div></div></article>
      <aside className="card home-news"><div className="home-news-cover"><span>NOVIDADES SOLID</span><b>Seu painel de conversão evoluiu</b></div>{[['Nova área de Análises disponível','Agora'],['Indicadores de checkout e gateways','Agora'],['Editor de checkout com modelos','Recente'],['Recuperação de carrinhos ativa','Recente']].map(([title,time]) => <button key={title} onClick={() => title.includes('Análises') && setPage('Análises')}><span>{title}</span><small>{time}</small><ArrowRight size={15}/></button>)}<button className="home-news-cta" onClick={() => setPage('Análises')}>Explorar os indicadores <ArrowRight size={16}/></button></aside>
    </section>
    <section className="home-tools"><h2>Ferramentas para expandir seu negócio</h2><p>Configure os recursos essenciais para aumentar sua conversão.</p><div><button onClick={() => setPage('Checkouts')}><b>Personalize seu checkout</b><span>Edite layout, conteúdo e elementos de conversão.</span><ArrowRight size={17}/></button><button onClick={() => setPage('Order bumps')}><b>Aumente o ticket médio</b><span>Crie ofertas complementares no checkout.</span><ArrowRight size={17}/></button><button onClick={() => setPage('Carrinhos')}><b>Recupere vendas</b><span>Acompanhe oportunidades que não foram concluídas.</span><ArrowRight size={17}/></button></div></section>
  </main>;
}
