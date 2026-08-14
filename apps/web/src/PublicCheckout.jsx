import { useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, ShieldCheck, ShoppingBag } from 'lucide-react';
import { createPublicCheckoutSession, getPublicCheckout, getPublicCheckoutSession } from './api';
import './public-session.css';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PublicCheckout({ storeSlug, checkoutSlug }) {
  const [state, setState] = useState({ loading: true, checkout: null, error: '' });
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); getPublicCheckout(storeSlug, checkoutSlug, controller.signal).then(({ checkout }) => { setState({ loading: false, checkout, error: '' }); setVariantId(checkout.product.variants?.[0]?.publicId || ''); }).catch(error => { if (error.name !== 'AbortError') setState({ loading: false, checkout: null, error: error.message }); }); return () => controller.abort(); }, [storeSlug, checkoutSlug]);
  const product = state.checkout?.product;
  const variant = product?.variants?.find(item => item.publicId === variantId);
  const unitPrice = variant?.priceCents ?? product?.priceCents ?? 0;
  const total = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);
  async function begin() { setBusy(true); setState(current => ({ ...current, error: '' })); try { const result = await createPublicCheckoutSession(storeSlug, checkoutSlug, { quantity, ...(variantId ? { variantId } : {}) }); sessionStorage.setItem(`solid-checkout-session:${result.session.publicId}`, result.token); setSession(result.session); } catch (error) { setState(current => ({ ...current, error: error.message })); } finally { setBusy(false); } }
  if (state.loading) return <div className="public-checkout-state"><LoaderCircle className="spin"/><span>Preparando checkout seguro...</span></div>;
  if (!product) return <div className="public-checkout-state error"><ShoppingBag/><b>Checkout indisponível</b><span>{state.error || 'Confira o endereço e tente novamente.'}</span></div>;
  return <main className="public-checkout"><header><b>SOLID</b><span><ShieldCheck size={18}/> Pagamento seguro</span></header><div className="public-checkout-grid"><section><p className="eyebrow">FINALIZE SEU PEDIDO</p><h1>{session ? 'Pedido iniciado com segurança.' : 'Revise sua compra'}</h1>{session ? <div className="public-session-created"><Check size={28}/><h2>Sessão criada</h2><p>Os valores foram validados pelo servidor e reservados por 30 minutos.</p><strong>{money.format(session.totalCents / 100)}</strong><small>O pagamento pela WestPay será conectado na próxima etapa.</small></div> : <div className="public-form-card">{product.variants?.length > 0 && <label>Variação<select value={variantId} onChange={event => setVariantId(event.target.value)}>{product.variants.map(item => <option key={item.publicId} value={item.publicId}>{item.title} — {money.format(item.priceCents / 100)}</option>)}</select></label>}<label>Quantidade<input type="number" min="1" max={product.maxPerOrder} value={quantity} onChange={event => setQuantity(Math.max(1, Math.min(product.maxPerOrder, Number(event.target.value) || 1)))}/></label>{state.error && <p className="public-error">{state.error}</p>}<button onClick={begin} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <ShieldCheck size={18}/>} Continuar para pagamento</button></div>}</section><aside>{product.imageUrl ? <img src={product.imageUrl} alt=""/> : <div className="public-product-placeholder"><ShoppingBag/></div>}<h2>{product.checkoutTitle}</h2>{product.checkoutDescription && <p>{product.checkoutDescription}</p>}<div><span>{quantity} × {money.format(unitPrice / 100)}</span><strong>{money.format(total / 100)}</strong></div><small>Preço e disponibilidade confirmados pela SOLID.</small></aside></div></main>;
}

export function PublicSessionCheckout({ sessionId, token }) {
  const [state, setState] = useState({ loading: true, session: null, error: '' });
  useEffect(() => { const controller = new AbortController(); getPublicCheckoutSession(sessionId, token, controller.signal).then(({ session }) => setState({ loading: false, session, error: '' })).catch(error => { if (error.name !== 'AbortError') setState({ loading: false, session: null, error: error.message }); }); return () => controller.abort(); }, [sessionId, token]);
  if (state.loading) return <div className="public-checkout-state"><LoaderCircle className="spin"/><span>Validando carrinho...</span></div>;
  if (!state.session) return <div className="public-checkout-state error"><ShoppingBag/><b>Sessão indisponível</b><span>{state.error}</span></div>;
  const items = state.session.items?.length ? state.session.items : [{ quantity: state.session.quantity, totalCents: state.session.totalCents, titleSnapshot: state.session.checkout.product.checkoutTitle, variantSnapshot: state.session.variant?.title, imageUrlSnapshot: state.session.variant?.imageUrl || state.session.checkout.product.imageUrl }];
  return <main className="public-checkout"><header><b>SOLID</b><span><ShieldCheck size={18}/> Pagamento seguro</span></header><div className="public-checkout-grid"><section><p className="eyebrow">CHECKOUT SOLID</p><h1>Finalize sua compra</h1><div className="public-session-created"><ShieldCheck size={28}/><h2>Carrinho validado</h2><p>Produtos, preços e estoque foram confirmados pelo servidor.</p><strong>{money.format(state.session.totalCents / 100)}</strong><small>A próxima etapa conectará identificação, entrega e o gateway escolhido pela loja.</small></div></section><aside><h2>Resumo do pedido</h2>{items.map((item, index) => <div className="public-line-item" key={`${item.titleSnapshot}-${index}`}>{item.imageUrlSnapshot ? <img src={item.imageUrlSnapshot} alt=""/> : <ShoppingBag/>}<span><b>{item.titleSnapshot}</b><small>{item.variantSnapshot || 'Padrão'} · {item.quantity} un.</small></span><strong>{money.format(item.totalCents / 100)}</strong></div>)}<div><span>Total</span><strong>{money.format(state.session.totalCents / 100)}</strong></div></aside></div></main>;
}
