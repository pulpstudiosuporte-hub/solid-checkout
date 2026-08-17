import { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, Palette, Plus, Rocket } from 'lucide-react';
import { createCheckout, createProduct, getCheckouts, getProducts, publishCheckout, updateCheckoutDraft } from './api';
import CheckoutEditor from './CheckoutEditor';
import './checkouts-page.css';

export default function CheckoutsPage({ csrfToken }) {
  const [data, setData] = useState({ loading: true, checkouts: [], products: [], error: '' });
  const [productId, setProductId] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function load() {
    try {
      const [checkouts, products] = await Promise.all([getCheckouts(), getProducts({ status: 'active' })]);
      setData({ loading: false, checkouts: checkouts.items, products: products.items, error: '' });
      setProductId(current => current || products.items[0]?.publicId || '');
    } catch (error) {
      setData(current => ({ ...current, loading: false, error: error.message }));
    }
  }

  useEffect(() => { void load(); }, []);
  const principal = data.checkouts.find(item => item.slug === 'principal');

  async function create() {
    setBusy(true);
    try { await createCheckout({ name: 'Checkout principal', slug: 'principal', productId }, csrfToken); await load(); }
    catch (error) { setData(current => ({ ...current, error: error.message })); }
    finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true);
    try { await publishCheckout(principal.publicId, csrfToken); await load(); }
    catch (error) { setData(current => ({ ...current, error: error.message })); throw error; }
    finally { setBusy(false); }
  }

  async function saveDraft(config) {
    const result = await updateCheckoutDraft(principal.publicId, config, csrfToken);
    setData(current => ({ ...current, checkouts: current.checkouts.map(item => item.publicId === principal.publicId ? result.checkout : item) }));
  }
  async function createOrderBump(input) {
    const result = await createProduct({ title: input.title, description: input.description || undefined, imageUrl: input.imageUrl || undefined, priceCents: input.priceCents, trackInventory: false, maxPerOrder: 1, active: true }, csrfToken);
    setData(current => ({ ...current, products: [result.product, ...current.products] }));
    return result.product;
  }

  if (editing && principal) return <CheckoutEditor checkout={principal} products={data.products} onCreateOrderBump={createOrderBump} onBack={() => setEditing(false)} onPreview={() => {}} onSaveDraft={saveDraft} onPublish={publish} />;
  if (data.loading) return <main className="page"><section className="card products-state"><LoaderCircle className="spin" /><span>Carregando checkouts...</span></section></main>;

  return <main className="page">
    <section className="page-title"><div><p className="eyebrow">CHECKOUT</p><h1>Checkouts</h1><p>Publique a experiência usada pela sua loja Shopify.</p></div></section>
    <section className="card principal-checkout-card">
      <div><h2>Checkout principal</h2><p>Identificador da extensão: <code>principal</code></p></div>
      {data.error && <p className="public-error" role="alert">{data.error}</p>}
      {!principal ? <div className="principal-create"><label>Produto de referência<select value={productId} onChange={event => setProductId(event.target.value)}>{data.products.map(product => <option key={product.publicId} value={product.publicId}>{product.checkoutTitle}</option>)}</select></label><button className="primary" disabled={busy || !productId} onClick={create}>{busy ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Criar checkout principal</button>{!data.products.length && <small>Sincronize um produto Shopify primeiro.</small>}</div> : <div className="principal-status"><span className={principal.status === 'PUBLISHED' ? 'published' : ''}>{principal.status === 'PUBLISHED' ? <CheckCircle2 size={16} /> : <Rocket size={16} />} {principal.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}</span><button className="secondary" disabled={busy} onClick={() => setEditing(true)}><Palette size={17} /> Personalizar</button>{principal.status !== 'PUBLISHED' && <button className="primary" disabled={busy} onClick={publish}><Rocket size={17} /> Publicar agora</button>}</div>}
    </section>
  </main>;
}
