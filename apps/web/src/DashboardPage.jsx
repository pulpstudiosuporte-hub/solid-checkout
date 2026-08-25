import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, CircleDollarSign, Clock3, FileText, LoaderCircle, ShoppingCart, TrendingUp } from 'lucide-react';
import { getDashboard } from './api';
import { RecentOrders } from './OrdersPage';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function Metric({ icon: Icon, label, value, tone }) {
  return <div className="metric card"><div className={`metric-icon ${tone}`}><Icon size={20}/></div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>Dados reais do período</small></div></div>;
}

export default function DashboardPage({ setPage, storeKey }) {
  const [period, setPeriod] = useState('7d');
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, data: null, error: '' });
    getDashboard(period, controller.signal)
      .then(data => setState({ loading: false, data, error: '' }))
      .catch(error => {
        if (error.name !== 'AbortError') setState({ loading: false, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [period, storeKey]);

  if (state.loading) return <main className="page"><div className="products-state"><LoaderCircle className="spin"/><b>Carregando indicadores...</b></div></main>;
  if (!state.data) return <main className="page"><div className="products-state error"><b>Não foi possível carregar a visão geral</b><span>{state.error}</span></div></main>;

  const data = state.data;
  const tasks = [
    ['Criar sua loja Solid', data.checklist.store, 'Visão geral'],
    ['Adicionar primeiro produto', data.checklist.product, 'Produtos'],
    ['Criar um checkout', data.checklist.checkout, 'Checkouts'],
    ['Conectar gateway Pix', data.checklist.gateway, 'Gateways'],
    ['Publicar e testar', data.checklist.published, 'Checkouts'],
  ];
  const completed = tasks.filter(task => task[1]).length;
  const max = Math.max(1, ...data.series.map(item => item.revenueCents));
  const points = data.series.map((item, index) => `${data.series.length === 1 ? 340 : index * 680 / (data.series.length - 1)},${215 - item.revenueCents / max * 185}`).join(' ');

  const exportCsv = () => {
    const rows = ['Data,Receita (centavos),Pedidos pagos', ...data.series.map(item => `${item.date},${item.revenueCents},${item.paidOrders}`)];
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `solid-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <main className="page dashboard">
    <section className="page-title"><div><p className="eyebrow">VISÃO GERAL</p><h1>Olá, {data.userName?.split(' ')[0] || 'empreendedor'} <span>👋</span></h1><p>Acompanhe o desempenho real da sua operação.</p></div><div className="title-actions"><select value={period} onChange={event => setPeriod(event.target.value)}><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="month">Este mês</option></select><button className="secondary" onClick={exportCsv}><FileText size={17}/> Exportar</button></div></section>
    <section className="metrics"><Metric icon={CircleDollarSign} label="Receita confirmada" value={money.format(data.revenueCents / 100)} tone="purple"/><Metric icon={ShoppingCart} label="Pedidos pagos" value={data.paidOrders} tone="blue"/><Metric icon={TrendingUp} label="Conversão" value={`${data.conversionRate.toLocaleString('pt-BR')}%`} tone="green"/><Metric icon={Clock3} label="Aguardando Pix" value={data.pendingPix} tone="orange"/></section>
    <section className="grid-main"><div className="card chart-card"><div className="card-head"><div><h2>Receita e pedidos</h2><p>Valores confirmados no período</p></div></div><div className="chart-wrap"><div className="chart"><svg viewBox="0 0 680 230" preserveAspectRatio="none" aria-label="Gráfico de receita real"><g className="gridlines"><line x1="0" y1="15" x2="680" y2="15"/><line x1="0" y1="115" x2="680" y2="115"/><line x1="0" y1="215" x2="680" y2="215"/></g><polyline className="line" points={points} fill="none"/></svg><div className="x-labels">{data.series.map(item => <span key={item.date}>{item.date.slice(8, 10)}/{item.date.slice(5, 7)}</span>)}</div></div></div></div><div className="card progress-card"><div className="card-head"><div><h2>Comece por aqui</h2><p>Prepare sua loja para vender</p></div><span>{completed} de 5</span></div><div className="progress"><span style={{ width: `${completed * 20}%` }}/></div>{tasks.map(([title, done, page], index) => <button key={title} className={`task ${done ? 'done' : ''}`} onClick={() => !done && setPage(page)}><span>{done ? <Check size={15}/> : index + 1}</span><b>{title}</b>{!done && <ArrowRight size={16}/>}</button>)}</div></section>
    <RecentOrders storeKey={storeKey} onViewAll={() => setPage('Pedidos')}/>
  </main>;
}
