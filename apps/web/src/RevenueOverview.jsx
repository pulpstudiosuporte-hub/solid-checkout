import { useEffect, useState } from 'react';
import { ArrowUpRight, BarChart3, CircleDollarSign, Clock3, LoaderCircle, RefreshCw } from 'lucide-react';
import { getDashboard } from './api';
import RevenueChart from './RevenueChart';

const money = value => (Number(value || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function RevenueOverview({ storeKey, onOrders }) {
  const [period, setPeriod] = useState('7d');
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: '', storeKey: null, period: null });
  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: '' }));
    getDashboard(period, controller.signal).then(data => setState({ data, loading: false, error: '', storeKey, period })).catch(error => {
      if (error.name !== 'AbortError') setState({ data: null, loading: false, error: error.message, storeKey, period });
    });
    return () => controller.abort();
  }, [storeKey, period, revision]);
  const data = state.storeKey === storeKey && state.period === period ? state.data : null;
  const series = Array.isArray(data?.series) ? data.series : [];
  const average = data?.analytics?.averageTicketCents ?? (data?.paidOrders ? data.revenueCents / data.paidOrders : 0);
  return <section className="admin-revenue-layout" aria-label="Evolução das vendas">
    <article className="card admin-revenue-card" aria-busy={state.loading}>
      <header className="admin-section-head"><div><span className="admin-section-icon"><BarChart3 size={19}/></span><div><h2>Suas vendas, em perspectiva</h2><p>Receita confirmada no período selecionado.</p></div></div><select aria-label="Período da receita" value={period} onChange={event => setPeriod(event.target.value)}><option value="7d">Últimos 7 dias</option><option value="month">Este mês</option><option value="year">Este ano</option></select></header>
      {state.loading && !data ? <div className="admin-chart-state" role="status"><LoaderCircle className="spin" size={22}/><span>Carregando suas vendas...</span></div> : state.error ? <div className="admin-chart-state" role="alert"><BarChart3 size={27}/><strong>Não foi possível atualizar o gráfico</strong><p>{state.error}</p><button className="secondary" onClick={() => setRevision(revision + 1)}><RefreshCw size={15}/> Tentar novamente</button></div> : <><div className="admin-chart-summary"><strong>{money(data?.revenueCents)}</strong><span><i/>{Number(data?.paidOrders || 0)} pedidos pagos</span></div>{series.length ? <RevenueChart series={series}/> : <div className="admin-chart-state"><BarChart3 size={25}/><p>Suas vendas aparecerão aqui assim que houver pagamentos confirmados.</p></div>}</>}
    </article>
    <aside className="admin-finance-card"><span className="admin-finance-eyebrow"><CircleDollarSign size={17}/> RESUMO DO PERÍODO</span><h2>Cada venda.<br/> Mais clareza.</h2><dl><div><dt>Ticket médio</dt><dd>{state.loading ? '—' : state.error ? 'Indisponível' : money(average)}</dd></div><div><dt><Clock3 size={13}/> Aguardando Pix</dt><dd>{state.loading ? '—' : state.error ? '—' : Number(data?.pendingPix || 0)} <small>pedidos</small></dd></div></dl><button onClick={onOrders}>Acompanhar pedidos <ArrowUpRight size={17}/></button><span className="admin-finance-note">Valores dos pagamentos registrados na sua loja.</span></aside>
  </section>;
}
