import React, { useEffect, useId, useState } from 'react';
import { ArrowRight, Check, CircleDollarSign, Clock3, FileText, LoaderCircle, ShoppingCart, Sparkles, TrendingUp } from 'lucide-react';
import { getDashboard } from './api';
import { RecentOrders } from './OrdersPage';

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
  const width = 680;
  const top = 18;
  const bottom = 206;
  const max = Math.max(1, ...series.map(item => item.revenueCents));
  const coordinates = series.map((item, index) => ({
    ...item,
    x: series.length === 1 ? width / 2 : index * width / (series.length - 1),
    y: bottom - (item.revenueCents / max) * (bottom - top),
  }));
  const points = coordinates.map(item => `${item.x},${item.y}`).join(' ');
  const area = coordinates.length ? `M ${coordinates[0].x} ${bottom} L ${points.replaceAll(',', ' ')} L ${coordinates.at(-1).x} ${bottom} Z` : '';

  return <div className="dashboard-chart-layout">
    <div className="dashboard-y-axis"><span>{compactMoney.format(max / 100)}</span><span>{compactMoney.format(max / 200)}</span><span>R$ 0</span></div>
    <div className="chart dashboard-chart">
      <svg viewBox={`0 0 ${width} 230`} preserveAspectRatio="none" role="img" aria-label="Evolução da receita confirmada no período">
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7357e9" stopOpacity=".28"/><stop offset="1" stopColor="#7357e9" stopOpacity="0"/></linearGradient></defs>
        <g className="gridlines"><line x1="0" y1={top} x2={width} y2={top}/><line x1="0" y1="112" x2={width} y2="112"/><line x1="0" y1={bottom} x2={width} y2={bottom}/></g>
        {area && <path d={area} fill={`url(#${gradientId})`}/>}<polyline className="line" points={points} fill="none"/>
        {coordinates.map(item => <circle key={item.date} className="chart-point" cx={item.x} cy={item.y} r="4"><title>{`${item.date}: ${money.format(item.revenueCents / 100)} · ${item.paidOrders} pedidos`}</title></circle>)}
      </svg>
      <div className="x-labels">{series.map(item => <span key={item.date}>{item.date.slice(8, 10)}/{item.date.slice(5, 7)}</span>)}</div>
    </div>
  </div>;
}

export default function DashboardPage({ setPage, storeKey }) {
  const [period, setPeriod] = useState('7d');
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
  const tasks = [
    ['Criar sua loja Solid', data.checklist.store, 'Visão geral'], ['Adicionar primeiro produto', data.checklist.product, 'Produtos'],
    ['Criar um checkout', data.checklist.checkout, 'Checkouts'], ['Conectar gateway Pix', data.checklist.gateway, 'Gateways'],
    ['Publicar e testar', data.checklist.published, 'Checkouts'],
  ];
  const completed = tasks.filter(task => task[1]).length;
  const firstName = data.userName?.split(' ')[0] || 'empreendedor';
  const exportCsv = () => {
    const rows = ['Data,Receita (centavos),Pedidos pagos', ...data.series.map(item => `${item.date},${item.revenueCents},${item.paidOrders}`)];
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `solid-${period}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <main className="page dashboard dashboard-v2">
    <section className="dashboard-hero">
      <div><p className="eyebrow">VISÃO GERAL</p><h1>Olá, {firstName}</h1><p>Seu negócio em um só lugar, com os números que importam.</p></div>
      <div className="title-actions"><label className="period-select"><span className="sr-only">Período dos indicadores</span><select value={period} onChange={event => setPeriod(event.target.value)}><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="month">Este mês</option></select></label><button className="secondary" onClick={exportCsv}><FileText size={17}/> Exportar</button></div>
      <Sparkles className="dashboard-hero-spark" aria-hidden="true"/>
    </section>
    <section className="metrics dashboard-metrics" aria-label="Indicadores principais">
      <Metric icon={CircleDollarSign} label="Receita confirmada" value={money.format(data.revenueCents / 100)} tone="purple" helper="Receita líquida confirmada"/>
      <Metric icon={ShoppingCart} label="Pedidos pagos" value={data.paidOrders} tone="blue" helper="Pagamentos aprovados"/>
      <Metric icon={TrendingUp} label="Conversão" value={`${data.conversionRate.toLocaleString('pt-BR')}%`} tone="green" helper="Sessões que viraram venda"/>
      <Metric icon={Clock3} label="Aguardando Pix" value={data.pendingPix} tone="orange" helper="Oportunidades em aberto"/>
    </section>
    <section className="grid-main dashboard-grid">
      <article className="card chart-card dashboard-chart-card"><div className="card-head"><div><p className="eyebrow">DESEMPENHO</p><h2>Receita no período</h2><p>Valores confirmados diretamente pelos gateways</p></div><span className="chart-legend"><i/>Receita</span></div><RevenueChart series={data.series}/></article>
      <aside className="card progress-card dashboard-progress"><div className="card-head"><div><p className="eyebrow">CONFIGURAÇÃO</p><h2>{completed === 5 ? 'Sua operação está pronta' : 'Comece por aqui'}</h2><p>{completed === 5 ? 'Todos os passos essenciais foram concluídos.' : 'Prepare sua loja para começar a vender.'}</p></div><strong className="progress-count">{completed}/5</strong></div><div className="progress" aria-label={`${completed} de 5 passos concluídos`}><span style={{ width: `${completed * 20}%` }}/></div><div className="dashboard-tasks">{tasks.map(([title, done, page], index) => <button key={title} className={`task ${done ? 'done' : ''}`} onClick={() => !done && setPage(page)} disabled={done}><span>{done ? <Check size={15}/> : index + 1}</span><b>{title}</b>{!done && <ArrowRight size={16}/>}</button>)}</div></aside>
    </section>
    <RecentOrders storeKey={storeKey} onViewAll={() => setPage('Pedidos')}/>
  </main>;
}
