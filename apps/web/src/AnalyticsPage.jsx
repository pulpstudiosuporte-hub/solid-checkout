import React, { useEffect, useId, useState } from 'react';
import { CalendarDays, LoaderCircle, RefreshCw } from 'lucide-react';
import { getDashboard } from './api';

const WorldMap = React.lazy(() => import('./components/ui/WorldMap').then(module => ({ default: module.WorldMap })));

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function normalizeDashboard(raw) {
  const series = Array.isArray(raw?.series) ? raw.series.map(item => ({ date: typeof item?.date === 'string' ? item.date : '', revenueCents: finite(item?.revenueCents), paidOrders: finite(item?.paidOrders) })) : [];
  const paidOrders = finite(raw?.paidOrders); const pendingPix = finite(raw?.pendingPix); const source = raw?.analytics && typeof raw.analytics === 'object' ? raw.analytics : {};
  const stepSource = source.checkoutSteps && typeof source.checkoutSteps === 'object' ? source.checkoutSteps : {};
  const couponSource = source.coupons && typeof source.coupons === 'object' ? source.coupons : {};
  const bumpSource = source.orderBumps && typeof source.orderBumps === 'object' ? source.orderBumps : {};
  const geographySource = source.geography && typeof source.geography === 'object' ? source.geography : {};
  const sessions = finite(source.sessions || paidOrders + pendingPix);
  return {
    ...raw, paidOrders, pendingPix, revenueCents: finite(raw?.revenueCents), conversionRate: finite(raw?.conversionRate), series,
    analytics: {
      sessions, generatedOrders: finite(source.generatedOrders), generatedRevenueCents: finite(source.generatedRevenueCents ?? raw?.revenueCents), paidRevenueCents: finite(source.paidRevenueCents ?? raw?.revenueCents),
      averageTicketCents: finite(source.averageTicketCents ?? (paidOrders ? finite(raw?.revenueCents) / paidOrders : 0)), abandoned: finite(source.abandoned), abandonmentRate: finite(source.abandonmentRate),
      pending: finite(source.pending ?? pendingPix), cancelled: finite(source.cancelled), refunded: finite(source.refunded), uniqueCustomers: finite(source.uniqueCustomers),
      checkoutSteps: { visitors: finite(stepSource.visitors ?? sessions), personal: finite(stepSource.personal), shipping: finite(stepSource.shipping), payment: finite(stepSource.payment ?? paidOrders + pendingPix), paid: finite(stepSource.paid ?? paidOrders) },
      coupons: { orders: finite(couponSource.orders), revenueCents: finite(couponSource.revenueCents), discountCents: finite(couponSource.discountCents) },
      orderBumps: { items: finite(bumpSource.items), revenueCents: finite(bumpSource.revenueCents) },
      gateways: Array.isArray(source.gateways) ? source.gateways.map(item => ({ provider: String(item?.provider || 'Gateway'), attempts: finite(item?.attempts), paid: finite(item?.paid), revenueCents: finite(item?.revenueCents), conversionRate: finite(item?.conversionRate) })) : [],
      products: Array.isArray(source.products) ? source.products.map(item => ({ title: String(item?.title || 'Produto'), quantity: finite(item?.quantity), revenueCents: finite(item?.revenueCents) })) : [],
      geography: { locations: Array.isArray(geographySource.locations) ? geographySource.locations : [], countries: finite(geographySource.countries), regions: finite(geographySource.regions), cities: finite(geographySource.cities), visitors: finite(geographySource.visitors) },
    },
  };
}

function Value({ label, value, helper }) {
  return <div className="analytics-value"><span>{label}</span><strong>{value}</strong>{helper && <small>{helper}</small>}</div>;
}

function SectionTitle({ eyebrow, children, subtitle }) {
  return <header className="analytics-section-title"><small>{eyebrow}</small><h2>{children}</h2>{subtitle && <p>{subtitle}</p>}</header>;
}

function AreaChart({ series, mode = 'revenue' }) {
  const gradient = useId().replace(/:/g, '');
  const values = series.map(item => mode === 'revenue' ? item.revenueCents : item.paidOrders);
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => ({ x: values.length === 1 ? 50 : index * 100 / (values.length - 1), y: 92 - value / max * 78 }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = points.length ? `${line} L ${points.at(-1).x} 94 L ${points[0].x} 94 Z` : '';
  return <div className="analytics-area-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={mode === 'revenue' ? 'Receita no período' : 'Pedidos no período'}><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7357e9" stopOpacity=".3"/><stop offset="1" stopColor="#7357e9" stopOpacity="0"/></linearGradient></defs>{[20,44,68,92].map(y => <line key={y} x1="0" x2="100" y1={y} y2={y}/>) }<path d={area} fill={`url(#${gradient})`}/><path d={line} className="analytics-chart-line"/></svg><div>{series.map(item => <span key={item.date}>{item.date.slice(8,10)}/{item.date.slice(5,7)}</span>)}</div></div>;
}

function Bar({ label, value, max, detail }) {
  return <div className="analytics-bar"><div><b>{label}</b><span>{detail}</span></div><div className="analytics-bar-track"><i style={{ width: `${max ? Math.max(2, value / max * 100) : 0}%` }}/></div></div>;
}

export default function AnalyticsPage({ storeKey }) {
  const [period, setPeriod] = useState('today');
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => { const controller = new AbortController(); setState(current => ({ ...current, loading: true, error: '' })); getDashboard(period, controller.signal).then(data => setState({ loading: false, data, error: '' })).catch(error => { if (error.name !== 'AbortError') setState({ loading: false, data: null, error: error.message }); }); return () => controller.abort(); }, [period, refresh, storeKey]);
  if (state.loading && !state.data) return <main className="page"><div className="products-state"><LoaderCircle className="spin"/><b>Preparando suas análises...</b></div></main>;
  if (!state.data) return <main className="page"><div className="products-state error"><b>Não foi possível carregar as análises</b><span>{state.error}</span></div></main>;
  const data = normalizeDashboard(state.data);
  const a = data.analytics;
  const maxStep = Math.max(1, a.checkoutSteps.visitors); const maxProduct = Math.max(1, ...a.products.map(item => item.revenueCents));
  const cityLocations = a.geography.locations.filter(location => location.city).sort((left, right) => finite(right.visitors) - finite(left.visitors));
  const maxCityVisitors = Math.max(1, ...cityLocations.map(location => finite(location.visitors)));
  const bestDay = data.series.reduce((best, item) => item.revenueCents > (best?.revenueCents || -1) ? item : best, null);
  return <main className="page analytics-page">
    <header className="analytics-heading"><div><h1>Análises</h1><p>Indicadores comerciais e operacionais da sua loja.</p></div><div className="analytics-controls" role="group" aria-label="Período das análises">{[['today','Hoje'],['yesterday','Ontem'],['7d','Últimos 7 dias'],['month','Mês atual'],['year','Ano atual']].map(([id,label]) => <button key={id} className={period === id ? 'active' : ''} onClick={() => setPeriod(id)}>{label}</button>)}<button aria-label="Escolher período personalizado" title="Período personalizado"><CalendarDays size={16}/></button><button onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16}/> Atualizar</button></div></header>

    <section className="analytics-card overview-card"><div className="analytics-card-head"><h2>Visão geral</h2><p>Indicadores principais do período selecionado</p></div><div className="analytics-values five"><Value label="Vendas geradas" value={money.format(a.generatedRevenueCents/100)} helper={`${a.generatedOrders} Pix gerados`}/><Value label="Receita confirmada" value={money.format(a.paidRevenueCents/100)} helper={`${data.paidOrders} pagos`}/><Value label="Ticket médio" value={money.format(a.averageTicketCents/100)}/><Value label="Conversão checkout" value={`${data.conversionRate.toLocaleString('pt-BR')}%`} helper={`${a.sessions} criados`}/><Value label="Carrinhos abandonados" value={number.format(a.abandoned)} helper={`${a.abandonmentRate.toLocaleString('pt-BR')}% de abandono`}/></div></section>

    <SectionTitle eyebrow="TENDÊNCIAS" subtitle="Evolução de vendas e receita ao longo do período">Desempenho comercial</SectionTitle>
    <section className="analytics-card trend-card"><div className="analytics-card-head row"><div><h2>Vendas no período</h2><p>Pedidos criados e receita confirmada ao longo do tempo</p></div><span className="analytics-pill">Receita</span></div><div className="analytics-values three"><Value label="Total em receita" value={money.format(a.paidRevenueCents/100)}/><Value label="Média nos dias ativos" value={money.format(a.paidRevenueCents/Math.max(1,data.series.filter(item=>item.revenueCents).length)/100)}/><Value label="Melhor dia" value={money.format((bestDay?.revenueCents||0)/100)} helper={bestDay?.date ? `${bestDay.date.slice(8,10)}/${bestDay.date.slice(5,7)}` : 'Sem vendas'}/></div><AreaChart series={data.series}/></section>

    <SectionTitle eyebrow="CONVERSÃO" subtitle="Funil do checkout e carrinhos abandonados">Jornada do comprador</SectionTitle>
    <div className="analytics-grid two"><section className="analytics-card"><div className="analytics-card-head"><h2>Jornada do checkout</h2><p>Etapas do funil e taxa de avanço</p></div><div className="analytics-values three compact"><Value label="Visitantes" value={number.format(a.checkoutSteps.visitors)}/><Value label="Pedidos pagos" value={number.format(a.checkoutSteps.paid)}/><Value label="Conversão" value={`${data.conversionRate.toLocaleString('pt-BR')}%`}/></div><div className="analytics-bars">{[['Dados pessoais',a.checkoutSteps.personal],['Entrega',a.checkoutSteps.shipping],['Pagamento',a.checkoutSteps.payment],['Pago',a.checkoutSteps.paid]].map(([label,value]) => <Bar key={label} label={label} value={value} max={maxStep} detail={`${value} · ${Math.round(value/maxStep*100)}%`}/>)}</div></section><section className="analytics-card"><div className="analytics-card-head"><h2>Status dos carrinhos</h2><p>Distribuição do período</p></div><div className="analytics-status-grid"><Value label="Finalizados" value={a.checkoutSteps.paid}/><Value label="Abandonados" value={a.abandoned}/><Value label="Pendentes" value={a.pending}/><Value label="Cancelados" value={a.cancelled}/></div></section></div>

    <SectionTitle eyebrow="OPERAÇÃO" subtitle="Saúde do checkout e dos pagamentos">Saúde da operação</SectionTitle>
    <section className="analytics-card"><div className="analytics-values five"><Value label="Conversão checkout" value={`${data.conversionRate.toLocaleString('pt-BR')}%`}/><Value label="Conversão pagamento" value={`${a.checkoutSteps.payment ? (a.checkoutSteps.paid/a.checkoutSteps.payment*100).toFixed(1) : '0,0'}%`}/><Value label="Reembolso" value={a.refunded}/><Value label="Cancelamento" value={a.cancelled}/><Value label="Pedidos / visitantes" value={`${a.sessions ? (a.checkoutSteps.payment/a.sessions*100).toFixed(1) : '0,0'}%`}/></div></section>

    <SectionTitle eyebrow="PAGAMENTOS" subtitle="Distribuição e performance dos processadores">Gateways</SectionTitle>
    <section className="analytics-card"><div className="analytics-card-head"><h2>Performance por adquirente</h2><p>Comparação entre os gateways configurados</p></div><div className="analytics-table-wrap"><table><thead><tr><th>Gateway</th><th>Conversão</th><th>Tentativas</th><th>Pagos</th><th>Receita confirmada</th></tr></thead><tbody>{a.gateways.length ? a.gateways.map(item => <tr key={item.provider}><td><b>{item.provider}</b></td><td>{item.conversionRate.toLocaleString('pt-BR')}%</td><td>{item.attempts}</td><td>{item.paid}</td><td>{money.format(item.revenueCents/100)}</td></tr>) : <tr><td colSpan="5" className="analytics-empty">Nenhuma tentativa de pagamento no período.</td></tr>}</tbody></table></div></section>

    <SectionTitle eyebrow="CLIENTES E PRODUTOS" subtitle="Comportamento de compra e performance do catálogo">Catálogo</SectionTitle>
    <div className="analytics-grid two"><section className="analytics-card"><div className="analytics-card-head"><h2>Clientes</h2><p>Comportamento no período</p></div><div className="analytics-values three"><Value label="Clientes identificados" value={a.uniqueCustomers}/><Value label="Ticket médio" value={money.format(a.averageTicketCents/100)}/><Value label="Pedidos pagos" value={a.checkoutSteps.paid}/></div></section><section className="analytics-card"><div className="analytics-card-head"><h2>Produtos</h2><p>Mais vendidos por receita gerada</p></div><div className="analytics-bars products">{a.products.length ? a.products.map(item => <Bar key={item.title} label={item.title} value={item.revenueCents} max={maxProduct} detail={`${item.quantity} itens · ${money.format(item.revenueCents/100)}`}/>) : <div className="analytics-empty">Nenhum produto vendido no período.</div>}</div></section></div>

    <SectionTitle eyebrow="COMPORTAMENTO" subtitle="Receita adicional e uso de descontos">Crescimento</SectionTitle>
    <div className="analytics-grid two"><section className="analytics-card"><div className="analytics-card-head"><h2>Vendas adicionais</h2><p>Receita extra de order bumps</p></div><div className="analytics-values two-values"><Value label="Order bumps aceitos" value={a.orderBumps.items}/><Value label="Receita adicional" value={money.format(a.orderBumps.revenueCents/100)}/></div></section><section className="analytics-card"><div className="analytics-card-head"><h2>Cupons</h2><p>Performance dos descontos</p></div><div className="analytics-values three"><Value label="Pedidos com cupom" value={a.coupons.orders}/><Value label="Receita com cupom" value={money.format(a.coupons.revenueCents/100)}/><Value label="Total de desconto" value={money.format(a.coupons.discountCents/100)}/></div></section></div>

    <SectionTitle eyebrow="GEOGRAFIA" subtitle="Visitantes únicos identificados pela localização anonimizada da Cloudflare">Distribuição geográfica</SectionTitle>
    <div className="analytics-grid two"><section className="analytics-card geo-placeholder"><div className="analytics-card-head"><h2>Mapa de visitantes</h2><p>Posição aproximada por cidade no período</p></div><div className="dot-map world"><React.Suspense fallback={<LoaderCircle className="spin" aria-label="Carregando mapa"/>}><WorldMap locations={a.geography.locations}/></React.Suspense></div><div className="analytics-values three compact"><Value label="Visitantes" value={number.format(a.geography.visitors)}/><Value label="Cidades" value={number.format(a.geography.cities)}/><Value label="Países" value={number.format(a.geography.countries)}/></div></section><section className="analytics-card"><div className="analytics-card-head"><h2>Top cidades</h2><p>Visitantes únicos, sem duplicar reaberturas do checkout</p></div><div className="analytics-bars cities">{cityLocations.length ? cityLocations.slice(0,15).map(location => <Bar key={`${location.country}-${location.region}-${location.city}`} label={location.city} value={finite(location.visitors)} max={maxCityVisitors} detail={`${location.region || location.country} · ${number.format(finite(location.visitors))} visitantes`}/>) : <div className="analytics-empty">As próximas visitas com localização completa aparecerão aqui.</div>}</div></section></div>
  </main>;
}
