import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, LoaderCircle, ShieldCheck, ShoppingBag } from 'lucide-react';
import { createPublicCheckoutSession, getPublicCheckout, getPublicCheckoutSession } from './api';
import './public-session.css';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function safeQuantity(value, maximum) {
  return Math.max(1, Math.min(maximum, Number(value) || 1));
}

function ProductImage({ src, title }) {
  if (!src) return <div className="public-product-placeholder" aria-hidden="true"><ShoppingBag /></div>;
  return <img src={src} alt={`Imagem de ${title}`} loading="lazy" />;
}

export default function PublicCheckout({ storeSlug, checkoutSlug }) {
  const [state, setState] = useState({ loading: true, checkout: null, error: '' });
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getPublicCheckout(storeSlug, checkoutSlug, controller.signal)
      .then(({ checkout }) => {
        setState({ loading: false, checkout, error: '' });
        setVariantId(checkout.product.variants?.[0]?.publicId || '');
      })
      .catch(error => {
        if (error.name !== 'AbortError') setState({ loading: false, checkout: null, error: error.message });
      });
    return () => controller.abort();
  }, [storeSlug, checkoutSlug]);

  const product = state.checkout?.product;
  const variant = product?.variants?.find(item => item.publicId === variantId);
  const unitPrice = variant?.priceCents ?? product?.priceCents ?? 0;
  const total = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);

  async function begin() {
    setBusy(true);
    setState(current => ({ ...current, error: '' }));
    try {
      const result = await createPublicCheckoutSession(storeSlug, checkoutSlug, { quantity, ...(variantId ? { variantId } : {}) });
      sessionStorage.setItem(`solid-checkout-session:${result.session.publicId}`, result.token);
      setSession(result.session);
    } catch (error) {
      setState(current => ({ ...current, error: error.message }));
    } finally {
      setBusy(false);
    }
  }

  if (state.loading) return <div className="public-checkout-state"><LoaderCircle className="spin" /><span>Preparando checkout seguro...</span></div>;
  if (!product) return <div className="public-checkout-state error"><ShoppingBag /><b>Checkout indisponível</b><span>{state.error || 'Confira o endereço e tente novamente.'}</span></div>;

  return <main className="public-checkout">
    <header><b>SOLID</b><span><ShieldCheck size={18} /> Pagamento seguro</span></header>
    <div className="public-checkout-grid">
      <section>
        <p className="eyebrow">FINALIZE SEU PEDIDO</p>
        <h1>{session ? 'Pedido iniciado com segurança.' : 'Revise sua compra'}</h1>
        {session ? <div className="public-session-created"><Check size={28} /><h2>Sessão criada</h2><p>Os valores foram validados pelo servidor e reservados por 30 minutos.</p><strong>{money.format(session.totalCents / 100)}</strong><small>O pagamento pela WestPay será conectado na próxima etapa.</small></div> : <div className="public-form-card">
          {product.variants?.length > 0 && <label>Variação<select value={variantId} onChange={event => setVariantId(event.target.value)}>{product.variants.map(item => <option key={item.publicId} value={item.publicId}>{item.title} — {money.format(item.priceCents / 100)}</option>)}</select></label>}
          <label>Quantidade<input type="number" min="1" max={product.maxPerOrder} value={quantity} onChange={event => setQuantity(safeQuantity(event.target.value, product.maxPerOrder))} /></label>
          {state.error && <p className="public-error" role="alert">{state.error}</p>}
          <button onClick={begin} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />} Continuar para pagamento</button>
        </div>}
      </section>
      <aside><ProductImage src={product.imageUrl} title={product.checkoutTitle} /><h2>{product.checkoutTitle}</h2>{product.checkoutDescription && <p>{product.checkoutDescription}</p>}<div><span>{quantity} × {money.format(unitPrice / 100)}</span><strong>{money.format(total / 100)}</strong></div><small>Preço e disponibilidade confirmados pela SOLID.</small></aside>
    </div>
  </main>;
}

function useExpiry(expiresAt) {
  const calculate = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(calculate);
  useEffect(() => {
    const interval = window.setInterval(() => setRemaining(calculate()), 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  return { remaining, label: `${minutes}:${seconds}` };
}

function SessionContent({ session }) {
  const expiry = useExpiry(session.expiresAt);
  const items = session.items?.length ? session.items : [{
    quantity: session.quantity,
    unitPriceCents: session.unitPriceCents,
    totalCents: session.totalCents,
    titleSnapshot: session.checkout.product.checkoutTitle,
    variantSnapshot: session.variant?.title,
    imageUrlSnapshot: session.variant?.imageUrl || session.checkout.product.imageUrl,
  }];
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const storeName = session.checkout?.store?.name || 'Loja SOLID';

  return <main className="public-checkout session-checkout">
    <header><b>SOLID</b><span><ShieldCheck size={18} /> Pagamento seguro</span></header>
    <div className="session-expiry" role="status"><Clock3 size={17} /><span>{expiry.remaining ? <>Sessão reservada por <strong>{expiry.label}</strong></> : <strong>Sessão expirada</strong>}</span></div>
    <div className="public-checkout-grid">
      <section>
        <p className="eyebrow">CHECKOUT SOLID</p>
        <h1>Finalize sua compra</h1>
        <div className="public-session-created"><ShieldCheck size={28} /><h2>Carrinho validado</h2><p>Produtos, preços e disponibilidade foram confirmados diretamente no servidor.</p><strong>{money.format(session.totalCents / 100)}</strong><small>Vendido por {storeName}. Na próxima etapa adicionaremos identificação, entrega e pagamento.</small></div>
      </section>
      <aside className="session-order-summary">
        <div className="session-summary-title"><div><span>Seu pedido</span><h2>Resumo da compra</h2></div><small>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</small></div>
        <div className="session-items">
          {items.map(item => <article className="public-line-item" key={`${item.titleSnapshot}-${item.variantSnapshot || 'default'}`}>
            <ProductImage src={item.imageUrlSnapshot} title={item.titleSnapshot} />
            <div className="line-item-copy"><b>{item.titleSnapshot}</b>{item.variantSnapshot && item.variantSnapshot !== 'Default Title' && <span>{item.variantSnapshot}</span>}<small>Quantidade: {item.quantity}</small><small>{money.format(item.unitPriceCents / 100)} por unidade</small></div>
            <strong>{money.format(item.totalCents / 100)}</strong>
          </article>)}
        </div>
        <div className="session-totals"><div><span>Subtotal</span><b>{money.format(session.totalCents / 100)}</b></div><div><span>Frete</span><small>Calculado na próxima etapa</small></div><div className="session-grand-total"><span>Total</span><strong>{money.format(session.totalCents / 100)}</strong></div></div>
        <p className="session-security"><ShieldCheck size={16} /> Preços e estoque protegidos contra alterações no navegador.</p>
      </aside>
    </div>
  </main>;
}

export function PublicSessionCheckout({ sessionId, token }) {
  const [state, setState] = useState({ loading: true, session: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    getPublicCheckoutSession(sessionId, token, controller.signal)
      .then(({ session }) => setState({ loading: false, session, error: '' }))
      .catch(error => {
        if (error.name !== 'AbortError') setState({ loading: false, session: null, error: error.message });
      });
    return () => controller.abort();
  }, [sessionId, token]);

  if (state.loading) return <div className="public-checkout-state"><LoaderCircle className="spin" /><span>Validando carrinho...</span></div>;
  if (!state.session) return <div className="public-checkout-state error"><ShoppingBag /><b>Sessão indisponível</b><span>{state.error}</span></div>;
  return <SessionContent session={state.session} />;
}
