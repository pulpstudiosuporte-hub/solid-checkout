import React, { useEffect, useId, useMemo, useState } from 'react';
import { CalendarDays, LoaderCircle, RefreshCw } from 'lucide-react';
import { getDashboard } from './api';
import './analytics.css';

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
  const momentsSource = source.bestMoments && typeof source.bestMoments === 'object' ? source.bestMoments : {};
  const salesGeographySource = source.salesGeography && typeof source.salesGeography === 'object' ? source.salesGeography : {};
  const sessions = finite(source.sessions ?? paidOrders + pendingPix);
  return {
    ...raw, paidOrders, pendingPix, revenueCents: finite(raw?.revenueCents), conversionRate: finite(raw?.conversionRate), series,
    analytics: {
      sessions, generatedOrders: finite(source.generatedOrders), generatedRevenueCents: finite(source.generatedRevenueCents ?? raw?.revenueCents), paidRevenueCents: finite(source.paidRevenueCents ?? raw?.revenueCents),
      averageTicketCents: finite(source.averageTicketCents ?? (paidOrders ? finite(raw?.revenueCents) / paidOrders : 0)), abandoned: finite(source.abandoned), abandonmentRate: finite(source.abandonmentRate),
      pending: finite(source.pending ?? pendingPix), cancelled: finite(source.cancelled), refunded: finite(source.refunded), uniqueCustomers: finite(source.uniqueCustomers),
      checkoutSteps: { visitors: finite(stepSource.visitors ?? sessions), personal: finite(stepSource.personal), shipping: finite(stepSource.shipping), payment: finite(stepSource.payment ?? paidOrders + pendingPix), paid: finite(stepSource.paid ?? paidOrders) },
      coupons: { orders: finite(couponSource.orders), revenueCents: finite(couponSource.revenueCents), discountCents: finite(couponSource.discountCents), items: Array.isArray(couponSource.items) ? couponSource.items.map(item => ({ code: String(item?.code || 'Cupom'), orders: finite(item?.orders), revenueCents: finite(item?.revenueCents), discountCents: finite(item?.discountCents) })) : [] },
      bestMoments: { bestHour: Number.isInteger(momentsSource.bestHour) ? momentsSource.bestHour : null, bestWeekday: typeof momentsSource.bestWeekday === 'string' ? momentsSource.bestWeekday : null, hourly: Array.isArray(momentsSource.hourly) ? momentsSource.hourly.map(item => ({ hour: finite(item?.hour), orders: finite(item?.orders), revenueCents: finite(item?.revenueCents) })) : [] },
      orderBumps: { items: finite(bumpSource.items), revenueCents: finite(bumpSource.revenueCents) },
      gateways: Array.isArray(source.gateways) ? source.gateways.map(item => ({ provider: String(item?.provider || 'Gateway'), attempts: finite(item?.attempts), paid: finite(item?.paid), revenueCents: finite(item?.revenueCents), conversionRate: finite(item?.conversionRate) })) : [],
      products: Array.isArray(source.products) ? source.products.map(item => ({ title: String(item?.title || 'Produto'), quantity: finite(item?.quantity), revenueCents: finite(item?.revenueCents) })) : [],
      geography: { locations: Array.isArray(geographySource.locations) ? geographySource.locations : [], countries: finite(geographySource.countries), regions: finite(geographySource.regions), cities: finite(geographySource.cities), visitors: finite(geographySource.visitors) },
      salesGeography: { states: Array.isArray(salesGeographySource.states) ? salesGeographySource.states.map(item => ({ state: String(item?.state || '—'), orders: finite(item?.orders), revenueCents: finite(item?.revenueCents) })) : [], cities: Array.isArray(salesGeographySource.cities) ? salesGeographySource.cities.map(item => ({ city: String(item?.city || '—'), state: String(item?.state || '—'), orders: finite(item?.orders), revenueCents: finite(item?.revenueCents) })) : [] },
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
  const [tableOpen, setTableOpen] = useState(false);
  const gradient = useId().replace(/:/g, '');
  const values = series.map(item => mode === 'revenue' ? item.revenueCents : item.paidOrders);
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => ({ x: values.length === 1 ? 50 : index * 100 / (values.length - 1), y: 92 - value / max * 78 }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = points.length ? `${line} L ${points.at(-1).x} 94 L ${points[0].x} 94 Z` : '';
  const labels = [...new Set(Array.from({ length: Math.min(5, series.length) }, (_, index) => Math.round(index * (series.length - 1) / Math.max(1, Math.min(5, series.length) - 1))))];
  if (!series.length || !values.some(value => value > 0)) return <div className="analytics-chart-empty">Nenhuma venda paga no período. Os próximos pagamentos confirmados aparecerão aqui.</div>;
  return <>
    <div className="analytics-area-chart"><div className="analytics-chart-scale"><span>{mode === 'revenue' ? money.format(max / 100) : number.format(max)}</span><span>{mode === 'revenue' ? 'R$ 0' : '0'}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={mode === 'revenue' ? 'Receita no período. Valores diários disponíveis na tabela abaixo.' : 'Pedidos no período'}><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--primary, #c91d16)" stopOpacity=".3"/><stop offset="1" stopColor="var(--primary, #c91d16)" stopOpacity="0"/></linearGradient></defs>{[20,44,68,92].map(y => <line key={y} x1="0" x2="100" y1={y} y2={y}/>)}<path d={area} fill={`url(#${gradient})`}/><path d={line} className="analytics-chart-line"/>{points.length === 1 && <circle cx={points[0].x} cy={points[0].y} r="1.5" fill="var(--primary, #c91d16)"/>}</svg><div className="analytics-chart-dates">{labels.map(index => <span key={index}>{series[index].date.slice(8,10)}/{series[index].date.slice(5,7)}</span>)}</div></div>
    <details className="analytics-daily-details" onToggle={event => setTableOpen(event.currentTarget.open)}><summary>Ver valores por dia</summary>{tableOpen && <div className="analytics-table-wrap"><table><caption>Receita e pedidos pagos por dia · Horário de Brasília</caption><thead><tr><th>Data</th><th>Pedidos pagos</th><th>Receita confirmada</th></tr></thead><tbody>{series.map(item => <tr key={item.date}><td>{item.date.split('-').reverse().join('/')}</td><td>{number.format(item.paidOrders)}</td><td>{money.format(item.revenueCents / 100)}</td></tr>)}</tbody></table></div>}</details>
  </>;

}

function Bar({ label, value, max, detail }) {
  return <div className="analytics-bar"><div><b>{label}</b><span>{detail}</span></div><div className="analytics-bar-track"><i style={{ width: `${max ? Math.min(100, value > 0 ? Math.max(2, value / max * 100) : 0) : 0}%` }}/></div></div>;
}

export default function AnalyticsPage({ storeKey }) {
  return <AnalyticsWorkspace key={storeKey || 'default'} storeKey={storeKey}/>;
}

function AnalyticsWorkspace({ storeKey }) {
  const [period, setPeriod] = useState('today');
  const [refresh, setRefresh] = useState(0);
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [draft, setDraft] = useState({ from: '', to: '' });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [rangeError, setRangeError] = useState('');
  const [state, setState] = useState({ loading: true, data: null, error: '', requestKey: '' });
  const requestKey = `${period}:${custom.from}:${custom.to}`;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: '' }));
    getDashboard(period, controller.signal, { ...(storeKey ? { store: storeKey } : {}), ...(period === 'custom' ? custom : {}) })
      .then(data => { if (!controller.signal.aborted) setState({ loading: false, data, error: '', requestKey }); })
      .catch(error => { if (!controller.signal.aborted) setState(current => ({ ...current, loading: false, error: error.message, requestKey, data: current.requestKey === requestKey ? current.data : null })); });
    return () => controller.abort();
  }, [period, refresh, storeKey, custom, requestKey]);
  const data = useMemo(() => normalizeDashboard(state.data), [state.data]);
  const waiting = state.loading || state.requestKey !== requestKey;
  const applyRange = event => {
    event.preventDefault();
    if (!draft.from || !draft.to || draft.from > draft.to || draft.to > today || draft.from < '2020-01-01') { setRangeError('Escolha datas válidas entre 2020 e hoje, com início anterior ao fim.'); return; }
    if ((new Date(draft.to) - new Date(draft.from)) / 86400000 >= 366) { setRangeError('Selecione um intervalo de até 366 dias.'); return; }
    setCustom({ ...draft }); setPeriod('custom'); setCalendarOpen(false); setRangeError('');
  };
  const a = data.analytics;
  const maxStep = Math.max(1, a.checkoutSteps.visitors); const maxProduct = Math.max(1, ...a.products.map(item => item.revenueCents));
  const maxHourOrders = Math.max(1, ...a.bestMoments.hourly.map(item => item.orders));
  const maxStateRevenue = Math.max(1, ...a.salesGeography.states.map(item => item.revenueCents));
  const maxSalesCityRevenue = Math.max(1, ...a.salesGeography.cities.map(item => item.revenueCents));
  const bestDay = data.series.reduce((best, item) => item.revenueCents > (best?.revenueCents ?? 0) ? item : best, null);
  return <main className="page analytics-page">
    <header className="analytics-heading"><div><h1>Análises</h1><p>Indicadores comerciais e operacionais da sua loja.</p></div><div className="analytics-controls" role="group" aria-label="Período das análises">{[['today','Hoje'],['yesterday','Ontem'],['7d','Últimos 7 dias'],['month','Mês atual'],['year','Ano atual']].map(([id,label]) => <button key={id} aria-pressed={period === id} className={period === id ? 'active' : ''} onClick={() => setPeriod(id)}>{label}</button>)}<button aria-label="Escolher período personalizado" aria-expanded={calendarOpen} aria-controls="analytics-date-range" className={period === 'custom' ? 'active' : ''} onClick={() => setCalendarOpen(value => !value)}><CalendarDays size={16}/> Personalizado</button><button disabled={waiting} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} className={waiting ? 'spin' : ''}/> {waiting ? 'Atualizando' : 'Atualizar'}</button></div></header>

    {calendarOpen && <form id="analytics-date-range" className="analytics-date-range" onSubmit={applyRange}>
      <label>Data inicial<input type="date" required min="2020-01-01" max={today} value={draft.from} onChange={event => setDraft(value => ({ ...value, from: event.target.value }))}/></label>
      <label>Data final<input type="date" required min={draft.from || '2020-01-01'} max={today} value={draft.to} onChange={event => setDraft(value => ({ ...value, to: event.target.value }))}/></label>
      <button type="submit">Aplicar período</button><button type="button" onClick={() => setCalendarOpen(false)}>Cancelar</button>
      <p>Até 366 dias por consulta · Horário de Brasília</p>{rangeError && <p role="alert">{rangeError}</p>}
    </form>}
    {period === 'custom' && <p className="analytics-range-label">{custom.from.split('-').reverse().join('/')} a {custom.to.split('-').reverse().join('/')} · Horário de Brasília</p>}
    {state.error && <div className="analytics-feedback" role="alert"><span>{state.data ? 'Não foi possível atualizar. Os dados exibidos são da última consulta.' : 'Não foi possível carregar as análises.'} {state.error}</span><button disabled={waiting} onClick={() => setRefresh(value => value + 1)}>Tentar novamente</button></div>}
    {waiting && <div className="analytics-loading" role="status"><LoaderCircle size={18} className="spin"/> {state.data && state.requestKey === requestKey ? 'Atualizando os indicadores…' : 'Preparando suas análises…'}</div>}
    {state.data && state.requestKey === requestKey && <div aria-busy={waiting}>

    <section className="analytics-card overview-card"><div className="analytics-card-head"><h2>Visão geral</h2><p>Indicadores principais do período selecionado</p></div><div className="analytics-values five"><Value label="Vendas geradas" value={money.format(a.generatedRevenueCents/100)} helper={`${a.generatedOrders} Pix gerados`}/><Value label="Receita confirmada" value={money.format(a.paidRevenueCents/100)} helper={`${data.paidOrders} pagos`}/><Value label="Ticket médio" value={money.format(a.averageTicketCents/100)}/><Value label="Conversão checkout" value={`${data.conversionRate.toLocaleString('pt-BR')}%`} helper={`${a.sessions} criados`}/><Value label="Carrinhos abandonados" value={number.format(a.abandoned)} helper={`${a.abandonmentRate.toLocaleString('pt-BR')}% de abandono`}/></div></section>

    <SectionTitle eyebrow="TENDÊNCIAS" subtitle="Evolução de vendas e receita ao longo do período">Desempenho comercial</SectionTitle>
    <section className="analytics-card trend-card"><div className="analytics-card-head row"><div><h2>Vendas no período</h2><p>Receita de pagamentos confirmados em cada dia</p></div><span className="analytics-pill">Receita</span></div><div className="analytics-values three"><Value label="Total em receita" value={money.format(a.paidRevenueCents/100)}/><Value label="Média nos dias ativos" value={money.format(a.paidRevenueCents/Math.max(1,data.series.filter(item=>item.revenueCents).length)/100)}/><Value label="Melhor dia" value={money.format((bestDay?.revenueCents||0)/100)} helper={bestDay?.date ? `${bestDay.date.slice(8,10)}/${bestDay.date.slice(5,7)}` : 'Sem vendas'}/></div><AreaChart series={data.series}/></section>

    <SectionTitle eyebrow="CONVERSÃO" subtitle="Funil do checkout e carrinhos abandonados">Jornada do comprador</SectionTitle>
    <div className="analytics-grid two"><section className="analytics-card"><div className="analytics-card-head"><h2>Jornada do checkout</h2><p>Etapas do funil e taxa de avanço</p></div><div className="analytics-values three compact"><Value label="Visitantes" value={number.format(a.checkoutSteps.visitors)}/><Value label="Pedidos pagos" value={number.format(a.checkoutSteps.paid)}/><Value label="Conversão" value={`${data.conversionRate.toLocaleString('pt-BR')}%`}/></div><div className="analytics-bars">{[['Dados pessoais',a.checkoutSteps.personal],['Entrega',a.checkoutSteps.shipping],['Pagamento',a.checkoutSteps.payment],['Pago',a.checkoutSteps.paid]].map(([label,value]) => <Bar key={label} label={label} value={value} max={maxStep} detail={`${value} · ${Math.round(value/maxStep*100)}%`}/>)}</div></section><section className="analytics-card"><div className="analytics-card-head"><h2>Status dos carrinhos</h2><p>Distribuição do período</p></div><div className="analytics-status-grid"><Value label="Finalizados" value={a.checkoutSteps.paid}/><Value label="Abandonados" value={a.abandoned}/><Value label="Pendentes" value={a.pending}/><Value label="Cancelados" value={a.cancelled}/></div></section></div>

    <SectionTitle eyebrow="OPERAÇÃO" subtitle="Saúde do checkout e dos pagamentos">Saúde da operação</SectionTitle>
    <section className="analytics-card"><div className="analytics-values five"><Value label="Conversão checkout" value={`${data.conversionRate.toLocaleString('pt-BR')}%`}/><Value label="Conversão pagamento" value={`${a.checkoutSteps.payment ? (a.checkoutSteps.paid/a.checkoutSteps.payment*100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0,0'}%`}/><Value label="Reembolso" value={a.refunded}/><Value label="Cancelamento" value={a.cancelled}/><Value label="Pedidos / visitantes" value={`${a.sessions ? (a.checkoutSteps.payment/a.sessions*100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0,0'}%`}/></div></section>

    <SectionTitle eyebrow="PAGAMENTOS" subtitle="Distribuição e performance dos processadores">Gateways</SectionTitle>
    <section className="analytics-card"><div className="analytics-card-head"><h2>Performance por adquirente</h2><p>Comparação entre os gateways configurados</p></div><div className="analytics-table-wrap"><table><thead><tr><th>Gateway</th><th>Conversão</th><th>Tentativas</th><th>Pagos</th><th>Receita confirmada</th></tr></thead><tbody>{a.gateways.length ? a.gateways.map(item => <tr key={item.provider}><td><b>{item.provider}</b></td><td>{item.conversionRate.toLocaleString('pt-BR')}%</td><td>{item.attempts}</td><td>{item.paid}</td><td>{money.format(item.revenueCents/100)}</td></tr>) : <tr><td colSpan="5" className="analytics-empty">Nenhuma tentativa de pagamento no período.</td></tr>}</tbody></table></div></section>

    <SectionTitle eyebrow="CLIENTES E PRODUTOS" subtitle="Comportamento de compra e performance do catálogo">Catálogo</SectionTitle>
    <div className="analytics-grid two"><section className="analytics-card"><div className="analytics-card-head"><h2>Clientes</h2><p>Comportamento no período</p></div><div className="analytics-values three"><Value label="Clientes identificados" value={a.uniqueCustomers}/><Value label="Ticket médio" value={money.format(a.averageTicketCents/100)}/><Value label="Pedidos pagos" value={a.checkoutSteps.paid}/></div></section><section className="analytics-card"><div className="analytics-card-head"><h2>Produtos</h2><p>Mais vendidos por receita gerada</p></div><div className="analytics-bars products">{a.products.length ? a.products.map(item => <Bar key={item.title} label={item.title} value={item.revenueCents} max={maxProduct} detail={`${item.quantity} itens · ${money.format(item.revenueCents/100)}`}/>) : <div className="analytics-empty">Nenhum produto vendido no período.</div>}</div></section></div>

    <SectionTitle eyebrow="COMPORTAMENTO" subtitle="Vendas adicionais, horários de pico e cupons">Crescimento</SectionTitle>
    <div className="analytics-grid two"><section className="analytics-card"><div className="analytics-card-head"><h2>Vendas adicionais</h2><p>Receita extra de order bumps pagos</p></div><div className="analytics-values two-values"><Value label="Order bumps aceitos" value={a.orderBumps.items}/><Value label="Receita adicional" value={money.format(a.orderBumps.revenueCents/100)}/></div></section><section className="analytics-card"><div className="analytics-card-head"><h2>Melhores momentos</h2><p>Quando seus clientes mais compram</p></div><div className="analytics-values two-values compact"><Value label="Melhor horário" value={a.bestMoments.bestHour === null ? 'Sem vendas' : `${String(a.bestMoments.bestHour).padStart(2,'0')}:00`} helper="Horário de Brasília"/><Value label="Melhor dia" value={a.bestMoments.bestWeekday ? a.bestMoments.bestWeekday.replace(/^./, letter => letter.toUpperCase()) : 'Sem vendas'}/></div><div className="analytics-hour-chart" role="img" aria-label="Pedidos pagos por horário">{a.bestMoments.hourly.map(item => <div key={item.hour} title={`${String(item.hour).padStart(2,'0')}:00 · ${item.orders} pedidos`}><i style={{ height: `${item.orders ? Math.max(8,item.orders/maxHourOrders*100) : 2}%` }}/><span>{item.hour % 3 === 0 ? `${String(item.hour).padStart(2,'0')}:00` : ''}</span></div>)}</div></section></div>

    <section className="analytics-card coupon-card"><div className="analytics-card-head"><h2>Cupons</h2><p>Receita confirmada e descontos em pedidos pagos</p></div><div className="analytics-values three"><Value label="Pedidos com cupom" value={a.coupons.orders}/><Value label="Receita com cupom" value={money.format(a.coupons.revenueCents/100)}/><Value label="Total de desconto" value={money.format(a.coupons.discountCents/100)}/></div><div className="analytics-table-wrap"><table><thead><tr><th>Código</th><th>Pedidos</th><th>Receita</th><th>Desconto</th><th>Ticket médio</th><th>% desconto</th></tr></thead><tbody>{a.coupons.items.length ? a.coupons.items.map(item => <tr key={item.code}><td><span className="analytics-code">{item.code}</span></td><td>{number.format(item.orders)}</td><td>{money.format(item.revenueCents/100)}</td><td className="analytics-negative">-{money.format(item.discountCents/100)}</td><td>{money.format(item.orders ? item.revenueCents/item.orders/100 : 0)}</td><td>{item.revenueCents + item.discountCents ? `${(item.discountCents/(item.revenueCents+item.discountCents)*100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '0,0%'}</td></tr>) : <tr><td colSpan="6" className="analytics-empty">Nenhuma venda paga com cupom no período.</td></tr>}</tbody></table></div></section>

    <SectionTitle eyebrow="GEOGRAFIA" subtitle="Visitantes únicos identificados pela localização anonimizada da Cloudflare">Distribuição geográfica</SectionTitle>
    <div className="analytics-grid two"><section className="analytics-card geo-placeholder"><div className="analytics-card-head"><h2>Mapa de visitantes</h2><p>Posição aproximada por cidade no período</p></div><div className="dot-map world"><React.Suspense fallback={<LoaderCircle className="spin" aria-label="Carregando mapa"/>}><WorldMap locations={a.geography.locations}/></React.Suspense></div><div className="analytics-values three compact"><Value label="Visitantes" value={number.format(a.geography.visitors)}/><Value label="Cidades" value={number.format(a.geography.cities)}/><Value label="Países" value={number.format(a.geography.countries)}/></div></section><section className="analytics-card"><div className="analytics-card-head"><h2>Melhores estados</h2><p>Receita confirmada por estado</p></div><div className="analytics-bars cities">{a.salesGeography.states.length ? a.salesGeography.states.slice(0,15).map(item => <Bar key={item.state} label={item.state} value={item.revenueCents} max={maxStateRevenue} detail={`${item.orders} vendas · ${money.format(item.revenueCents/100)}`}/>) : <div className="analytics-empty">As próximas vendas pagas com localização aparecerão aqui.</div>}</div></section></div>
    <section className="analytics-card"><div className="analytics-card-head"><h2>Top cidades</h2><p>Vendas confirmadas por cidade</p></div><div className="analytics-bars cities">{a.salesGeography.cities.length ? a.salesGeography.cities.slice(0,15).map(item => <Bar key={`${item.state}-${item.city}`} label={item.city} value={item.revenueCents} max={maxSalesCityRevenue} detail={`${item.state} · ${item.orders} vendas · ${money.format(item.revenueCents/100)}`}/>) : <div className="analytics-empty">As próximas vendas pagas com cidade identificada aparecerão aqui.</div>}</div></section>
    </div>}
  </main>;
}
