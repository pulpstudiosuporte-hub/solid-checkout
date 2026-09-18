import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ImagePlus, LoaderCircle, Plus, Sparkles, Trash2 } from 'lucide-react';
import { generateCheckoutPreview } from './api';
import { defaultCheckoutConfig } from './checkout-config';
import './checkout-ai.css';

const Preview = lazy(() => import('./CheckoutEditor').then(module => ({ default: module.CheckoutAnalyticsPreview })));
const examples = ['Uma marca de café, com tons quentes e visual acolhedor.', 'Um curso online com visual limpo, azul escuro e foco no formulário.', 'Uma loja de acessórios com fundo claro e detalhes em vermelho.'];
const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 65);

export default function CheckoutAiBuilder({ products, csrfToken, onBack, onCreate }) {
  const [mode, setMode] = useState('SHOPIFY_CART');
  const [productId, setProductId] = useState(products[0]?.publicId || '');
  const [name, setName] = useState('Meu checkout com IA');
  const [prompt, setPrompt] = useState('');
  const [reference, setReference] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const request = useRef(null);
  const fileInput = useRef(null);
  const fileReader = useRef(null);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); return () => { request.current?.abort(); fileReader.current?.abort(); }; }, []);
  function clearReference() { fileReader.current?.abort(); fileReader.current = null; setReference(null); if (fileInput.current) fileInput.current.value = ''; }
  function leave() { request.current?.abort(); clearReference(); onBack(); }
  function readFile(file) {
    clearReference(); setError('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Escolha uma imagem PNG, JPEG ou WebP de até 2 MB.'); return; }
    const reader = new FileReader(); fileReader.current = reader;
    reader.onload = () => { if (fileReader.current === reader) setReference({ name: file.name, data: reader.result }); };
    reader.onerror = () => setError('Não consegui abrir a imagem. Tente outro arquivo.');
    reader.readAsDataURL(file);
  }
  async function generate(event) {
    event.preventDefault();
    if (request.current || saving) return;
    if (!prompt.trim() || mode === 'DIRECT_LINK' && !productId) { setError('Descreva sua ideia e selecione o produto para o link direto.'); return; }
    const testimonials = reviews.filter(item => item.name.trim() || item.text.trim());
    if (testimonials.some(item => !item.name.trim() || !item.text.trim())) { setError('Preencha o nome e a avaliação real, ou remova o depoimento incompleto.'); return; }
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try {
      const result = await generateCheckoutPreview({ prompt: prompt.trim(), ...(mode === 'DIRECT_LINK' ? { productId } : {}), ...(reference ? { reference: reference.data } : {}), ...(config ? { current: config } : {}), testimonials }, csrfToken, controller.signal);
      if (!controller.signal.aborted) setConfig({ ...defaultCheckoutConfig, ...result.config });
    } catch (cause) { if (!controller.signal.aborted) setError(cause.status === 429 ? 'Você chegou ao limite de 10 criações por hora. Tente mais tarde.' : cause.message); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  async function save() {
    if (!config || saving || busy) return;
    if (!name.trim() || !slug(name)) { setError('Informe um nome para o checkout.'); return; }
    setSaving(true); setError('');
    try {
      await onCreate({ mode, name: name.trim(), slug: `${slug(name)}-${crypto.randomUUID().slice(0, 8)}`, ...(mode === 'DIRECT_LINK' ? { productId } : {}), draftConfig: config });
      clearReference();
    } catch (cause) { setError(cause.message); setSaving(false); }
  }
  const updateReview = (index, key, value) => { setReviews(items => items.map((item, position) => position === index ? { ...item, [key]: value } : item)); setConfig(null); };
  const previewProduct = mode === 'DIRECT_LINK' ? products.find(product => product.publicId === productId) : null;
  return <main className="page checkout-ai">
    <header className="page-title"><div><p className="eyebrow">ESTÚDIO PIRAT · CRIAR COM IA</p><h1 ref={heading} tabIndex={-1}>Dê a ideia. Eu monto o mapa.</h1><p>Descreva seu checkout, confira a prévia e deixe do seu jeito no editor.</p></div><button type="button" className="secondary" onClick={leave} disabled={saving}><ArrowLeft size={17}/> Voltar aos checkouts</button></header>
    <div className="checkout-ai-grid"><form className="card checkout-ai-form" onSubmit={generate}>
      <fieldset disabled={busy || saving}><legend>1. Sua loja, seu estilo</legend>
        <label>Nome do checkout<input value={name} onChange={event => setName(event.target.value)} maxLength={120}/></label>
        <label>Tipo de checkout<select value={mode} onChange={event => { setMode(event.target.value); setConfig(null); }}><option value="SHOPIFY_CART">Loja Shopify · carrinho automático</option><option value="DIRECT_LINK">Link direto · produto específico</option></select></label>
        {mode === 'DIRECT_LINK' && <label>Produto<select value={productId} onChange={event => { setProductId(event.target.value); setConfig(null); }}><option value="">Selecione um produto</option>{products.map(product => <option key={product.publicId} value={product.publicId}>{product.checkoutTitle}</option>)}</select></label>}
        <label htmlFor="checkout-ai-idea">{config ? 'O que quer ajustar?' : 'Como você imagina o checkout?'}</label><textarea id="checkout-ai-idea" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={2000} rows={4} placeholder="Conte a marca, as cores e o estilo que você quer…" required/>
        {!config && <div className="checkout-ai-examples">{examples.map(example => <button type="button" key={example} onClick={() => setPrompt(example)}>{example}</button>)}</div>}
        <label className="checkout-ai-upload"><ImagePlus size={19}/> Referência visual opcional<input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => readFile(event.target.files?.[0])}/></label>
        {reference && <div className="checkout-ai-reference"><img src={reference.data} alt="Referência temporária do visual"/><span>{reference.name}</span><button type="button" className="secondary" onClick={clearReference} aria-label="Remover referência"><Trash2 size={16}/></button></div>}
        <small>A referência inspira cores e organização. Não vira banner nem entra na biblioteca; é descartada ao sair ou salvar o rascunho.</small>
      </fieldset>
      <fieldset disabled={busy || saving}><legend>2. Depoimentos reais</legend><p>Deixo os cartões prontos com as avaliações que você fornecer. Sem avaliações, a seção fica desativada no rascunho.</p>
        {reviews.map((review, index) => <div className="checkout-ai-review" key={index}><label>Nome do cliente {index + 1}<input value={review.name} maxLength={80} onChange={event => updateReview(index, 'name', event.target.value)}/></label><label>Avaliação real<textarea value={review.text} maxLength={240} rows={2} onChange={event => updateReview(index, 'text', event.target.value)}/></label><label>Nota<select value={review.rating} onChange={event => updateReview(index, 'rating', Number(event.target.value))}>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} de 5</option>)}</select></label><button type="button" className="secondary" onClick={() => { setReviews(items => items.filter((_, i) => i !== index)); setConfig(null); }}><Trash2 size={15}/> Remover depoimento {index + 1}</button></div>)}
        <button type="button" className="secondary" disabled={reviews.length >= 6} onClick={() => setReviews(items => [...items, { name: '', text: '', rating: 5 }])}><Plus size={17}/> Adicionar depoimento</button>
      </fieldset>
      <p className="checkout-ai-privacy">Enviamos sua ideia e a referência ao Gemini. Evite dados pessoais nas imagens. As avaliações são inseridas sem alteração pela Pirat e não são enviadas à IA. O processamento no Google segue os termos do serviço.</p>
      {error && <p role="alert" className="public-error">{error}</p>}
      <div className="checkout-ai-actions"><button className="primary" disabled={busy || saving || !prompt.trim()}>{busy ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>} {busy ? 'Montando sua prévia…' : config ? 'Ajustar com IA' : 'Gerar prévia'}</button>{busy && <button type="button" className="secondary" onClick={() => { request.current?.abort(); request.current = null; setBusy(false); }}>Cancelar geração</button>}</div>
    </form><section className="card checkout-ai-result" aria-label="Prévia do checkout"><div className="checkout-ai-result-head"><span className="eyebrow">3. CONFIRA ANTES DE SALVAR</span><h2>{config ? 'Seu checkout tomou forma.' : 'Um bom checkout começa aqui.'}</h2><p>{config ? 'Prévia ilustrativa. Preços e produtos vêm do catálogo ou carrinho real. Revise todos os textos no editor.' : 'O papagaio organiza cores, fontes e textos nos modelos da Pirat. Você continua no comando.'}</p></div>
      {config ? <><div className="checkout-ai-preview" tabIndex={0} role="region" aria-label="Prévia visual ilustrativa"><Suspense fallback={<p role="status">Preparando prévia…</p>}><Preview config={config} product={previewProduct ? { ...previewProduct, title: previewProduct.checkoutTitle } : undefined}/></Suspense></div><div className="checkout-ai-result-foot"><button type="button" className="primary" onClick={save} disabled={saving || busy}>{saving ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>} Salvar rascunho e abrir editor</button><small>A publicação continua manual. Logos, banners, ofertas e blocos adicionais podem ser ajustados no editor.</small></div></> : <div className="checkout-ai-empty"><img src="/brand/assistant/thinking.webp" alt="Papagaio da Pirat pensando no próximo checkout" width="180" height="180"/><h3>Capricha na ideia, marujo.</h3><p>Uma referência ajuda. Uma descrição bem feita também. Depois é só revisar e ajustar.</p><div className="checkout-ai-review-placeholder">Espaço para seus depoimentos reais<br/><small>Nome, avaliação e nota em cartões editáveis.</small></div></div>}
    </section></div>
  </main>;
}
