import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Package, RefreshCw, ShoppingBag } from 'lucide-react';
import { getOrders } from './api';
import './orders-page.css';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const statusLabels = { PAID: 'Pago', PENDING: 'Aguardando Pix', FAILED: 'Falhou', CANCELLED: 'Cancelado', EXPIRED: 'Expirado', REFUNDED: 'Reembolsado' };
const statusTones = { PAID: 'paid', PENDING: 'pending', FAILED: 'failed', CANCELLED: 'neutral', EXPIRED: 'neutral', REFUNDED: 'refunded' };

function relativeDate(value) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return relative.format(seconds, 'second');
  const minutes = Math.round(seconds / 60); if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60); if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}
const initials = name => (name || 'Cliente').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const orderCode = publicId => `#SLD-${publicId.slice(-6).toUpperCase()}`;

export function OrdersTable({ items, loading, error, onRetry }) {
  if (loading) return <div className="orders-state" role="status"><RefreshCw className="orders-spinner"/><span>Carregando pedidos...</span></div>;
  if (error) return <div className="orders-state error" role="alert"><ShoppingBag/><b>Não foi possível carregar os pedidos</b><span>{error}</span><button className="secondary" onClick={onRetry}><RefreshCw size={16}/> Tentar novamente</button></div>;
  if (!items.length) return <div className="orders-state"><ShoppingBag/><b>Nenhum pedido ainda</b><span>Quando um cliente gerar um Pix, o pedido aparecerá aqui automaticamente.</span></div>;
  return <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Produto</th><th>Valor</th><th>Pagamento</th><th>Criado</th></tr></thead><tbody>{items.map(order => { const product = order.items[0]; const extra = order.items.length > 1 ? ` +${order.items.length - 1}` : ''; return <tr key={order.publicId}><td><strong>{orderCode(order.publicId)}</strong><small>{order.paymentProvider || 'WestPay'}</small></td><td><div className="order-customer"><span>{initials(order.customer?.name)}</span><div><strong>{order.customer?.name || 'Cliente não identificado'}</strong><small>{order.customer?.email || 'E-mail indisponível'}</small></div></div></td><td><div className="order-product"><span>{product?.imageUrlSnapshot ? <img src={product.imageUrlSnapshot} alt="" loading="lazy"/> : <Package size={18}/>}</span><div><strong>{product?.titleSnapshot || 'Produto'}</strong><small>{product?.quantity || 1} un.{extra}</small></div></div></td><td><strong>{currency.format(order.totalCents / 100)}</strong>{order.shippingPriceCents > 0 && <small>inclui frete</small>}</td><td><span className={`payment-status ${statusTones[order.status] || 'neutral'}`}><i/>{statusLabels[order.status] || order.status}</span></td><td><time dateTime={order.createdAt} title={new Date(order.createdAt).toLocaleString('pt-BR')}>{relativeDate(order.createdAt)}</time></td></tr>; })}</tbody></table></div>;
}

function useOrders(storeKey, page, pageSize) {
  const [state, setState] = useState({ loading: true, error: '', items: [], total: 0, pages: 1 });
  const load = () => { setState(current => ({ ...current, loading: true, error: '' })); getOrders({ page, pageSize }).then(result => setState({ loading: false, error: '', items: result.items, total: result.total, pages: result.pages })).catch(error => setState({ loading: false, error: error.message, items: [], total: 0, pages: 1 })); };
  useEffect(() => { load(); }, [page, pageSize, storeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return [state, load];
}

export function RecentOrders({ storeKey, onViewAll }) { const [state, load] = useOrders(storeKey, 1, 5); return <section className="card orders-card"><div className="card-head"><div><h2>Pedidos recentes</h2><p>Últimas movimentações reais do checkout</p></div><button className="ghost" onClick={onViewAll}>Ver todos</button></div><OrdersTable {...state} onRetry={load}/></section>; }

export default function OrdersPage({ storeKey }) {
  const [page, setPage] = useState(1); const [state, load] = useOrders(storeKey, page, 20);
  return <main className="page orders-page"><section className="page-title"><div><p className="eyebrow">GESTÃO</p><h1>Pedidos</h1><p>Acompanhe pagamentos Pix e vendas da loja selecionada.</p></div></section><section className="card orders-list"><div className="orders-list-head"><div><b>{state.total} {state.total === 1 ? 'pedido' : 'pedidos'}</b><span>Os status são confirmados diretamente pela WestPay.</span></div><button className="secondary" onClick={load} disabled={state.loading}><RefreshCw size={16}/> Atualizar</button></div><OrdersTable {...state} onRetry={load}/>{!state.loading && !state.error && state.total > 0 && <div className="orders-pagination"><span>Página {page} de {state.pages}</span><div><button aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17}/></button><button aria-label="Próxima página" disabled={page >= state.pages} onClick={() => setPage(value => value + 1)}><ChevronRight size={17}/></button></div></div>}</section></main>;
}
