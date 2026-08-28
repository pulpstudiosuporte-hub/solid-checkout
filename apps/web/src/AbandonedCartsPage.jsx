import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, MessageCircle, Package, RefreshCw, ShoppingCart, TimerOff, WalletCards } from 'lucide-react';
import { getAbandonedCarts } from './api';
import './abandoned-carts-page.css';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const stages = { IDENTIFICATION: 'Identificação', SHIPPING: 'Entrega', PAYMENT: 'Pagamento' };

function relativeDate(value) { const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000); if (Math.abs(seconds) < 60) return relative.format(seconds, 'second'); const minutes = Math.round(seconds / 60); if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute'); const hours = Math.round(minutes / 60); return Math.abs(hours) < 24 ? relative.format(hours, 'hour') : relative.format(Math.round(hours / 24), 'day'); }
function phoneNumber(value) { let digits = String(value || '').replace(/\D/g, '').replace(/^0+/, ''); if (digits.length === 10 || digits.length === 11) digits = `55${digits}`; return /^\d{12,15}$/.test(digits) ? digits : null; }
function whatsappUrl(cart) { const number = phoneNumber(cart.customer?.phone); if (!number) return null; const name = cart.customer?.name?.trim().split(/\s+/)[0]; const product = cart.items?.[0]?.titleSnapshot || 'produto'; const message = `${name ? `Olá, ${name}!` : 'Olá!'} Vi que você iniciou a compra de ${product}, mas não concluiu. Posso ajudar com alguma dúvida?`; return `https://wa.me/${number}?text=${encodeURIComponent(message)}`; }

function Metric({ icon: Icon, label, value, tone }) { return <article className="card abandoned-metric"><span className={tone}><Icon size={20}/></span><div><small>{label}</small><strong>{value}</strong></div></article>; }

export default function AbandonedCartsPage({ storeKey }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [state, setState] = useState({ loading: true, error: '', items: [], total: 0, pages: 1, retentionDays: 30, metrics: { totalCents: 0, pendingCents: 0, abandonedCount: 0, pendingCount: 0 } });
  const load = () => { const controller = new AbortController(); setState(current => ({ ...current, loading: true, error: '' })); getAbandonedCarts({ page, pageSize: 20, status: filter }, controller.signal).then(result => setState({ loading: false, error: '', ...result })).catch(error => { if (error.name !== 'AbortError') setState(current => ({ ...current, loading: false, error: error.message })); }); return controller; };
  useEffect(() => { const controller = load(); return () => controller.abort(); }, [page, filter, storeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [filter, storeKey]);
  const visibleTotal = useMemo(() => currency.format(state.metrics.totalCents / 100), [state.metrics.totalCents]);

  return <main className="page abandoned-page">
    <section className="page-title"><div><p className="eyebrow">RECUPERAÇÃO</p><h1>Carrinhos abandonados</h1><p>Veja quem parou antes de pagar e recupere vendas pelo WhatsApp.</p></div><button className="secondary" onClick={load} disabled={state.loading}><RefreshCw size={17}/> Atualizar</button></section>
    <section className="abandoned-metrics">
      <Metric icon={TimerOff} label="Carrinhos abandonados" value={state.metrics.abandonedCount} tone="danger"/>
      <Metric icon={Clock3} label="Pix aguardando" value={state.metrics.pendingCount} tone="pending"/>
      <Metric icon={WalletCards} label="Valor em recuperação" value={visibleTotal} tone="purple"/>
    </section>
    <section className="card abandoned-list-card">
      <header className="abandoned-toolbar"><div><b>{state.total} {state.total === 1 ? 'oportunidade' : 'oportunidades'}</b><small>Histórico disponível por {state.retentionDays} dias no seu plano.</small></div><div className="abandoned-filters" aria-label="Filtrar carrinhos">{[['', 'Todos'], ['ABANDONED', 'Abandonados'], ['PIX_PENDING', 'Pix pendentes']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div></header>
      {state.loading ? <div className="abandoned-state" role="status"><RefreshCw className="abandoned-spinner"/><span>Carregando carrinhos...</span></div> : state.error ? <div className="abandoned-state error" role="alert"><TimerOff/><b>Não foi possível carregar os carrinhos</b><span>{state.error}</span><button className="secondary" onClick={load}>Tentar novamente</button></div> : !state.items.length ? <div className="abandoned-state"><ShoppingCart/><b>Nenhum carrinho neste filtro</b><span>Novos abandonos e Pix pendentes aparecerão aqui automaticamente.</span></div> : <div className="abandoned-list">{state.items.map(cart => { const product = cart.items[0]; const whatsapp = whatsappUrl(cart); return <article key={cart.publicId} className="abandoned-row">
        <div className="abandoned-product"><span>{product?.imageUrlSnapshot ? <img src={product.imageUrlSnapshot} alt="" loading="lazy"/> : <Package size={19}/>}</span><div><b>{product?.titleSnapshot || 'Produto'}</b><small>{cart.items.length > 1 ? `${cart.items.length} itens` : `${product?.quantity || 1} unidade`}</small></div></div>
        <div className="abandoned-customer"><b>{cart.customer?.name || 'Cliente não identificado'}</b><small>{cart.customer?.email || 'E-mail não informado'}</small></div>
        <div className="abandoned-value"><b>{currency.format(cart.totalCents / 100)}</b>{cart.couponCode && <small>Cupom {cart.couponCode}</small>}</div>
        <div className="abandoned-stage"><small>Parou em</small><b>{stages[cart.lastStage] || cart.lastStage}</b></div>
        <div className="abandoned-time"><small>Última atividade</small><time dateTime={cart.lastActivityAt} title={new Date(cart.lastActivityAt).toLocaleString('pt-BR')}>{relativeDate(cart.lastActivityAt)}</time></div>
        <span className={`abandoned-status ${cart.status === 'PIX_PENDING' ? 'pending' : 'lost'}`}>{cart.status === 'PIX_PENDING' ? 'Aguardando Pix' : 'Abandonado'}</span>
        {whatsapp ? <a className="abandoned-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/> Chamar</a> : <span className="abandoned-no-phone">Sem WhatsApp</span>}
      </article>; })}</div>}
      {!state.loading && !state.error && state.total > 0 && <footer className="abandoned-pagination"><span>Página {page} de {state.pages}</span><div><button aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17}/></button><button aria-label="Próxima página" disabled={page >= state.pages} onClick={() => setPage(value => value + 1)}><ChevronRight size={17}/></button></div></footer>}
    </section>
  </main>;
}
