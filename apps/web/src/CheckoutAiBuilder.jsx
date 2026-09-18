import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Monitor, Smartphone, Maximize2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { generateCheckoutPreview, uploadProductImage, resolveMediaUrl } from './api';
import { defaultCheckoutConfig } from './checkout-config';
import './checkout-ai.css';
import { structuralCheckoutTemplates } from './checkout-template-catalog';

const Preview = lazy(() => import('./CheckoutEditor').then(module => ({ default: module.CheckoutAnalyticsPreview })));
const examples = ['Uma marca de café, com tons quentes e visual acolhedor.', 'Um curso online com visual limpo, azul escuro e foco no formulário.', 'Uma loja de acessórios com fundo claro e detalhes em vermelho.'];
const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 65);
const initialBrief = { template: 'auto', brand: '', logoUrl: '', heroImageUrl: '', heroMobileImageUrl: '', summaryBannerUrl: '', fidelity: 'close', layout: 'auto', progressStyle: 'auto', showProgress: true, showCoupon: true, showSummary: true, socialProofEnabled: false };
const steps = ['Sua marca', 'Logo e banners', 'Recursos e geração'];

function DesignPreview({ config, product, device }) {
  const container = useRef(null);
  const [width, setWidth] = useState(500);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(container.current); return () => observer.disconnect();
  }, []);
  return <div className="checkout-ai-preview" ref={container} tabIndex={0} role="region" aria-label="Prévia visual ilustrativa">
    <div className={`checkout-ai-canvas device-${device}`} style={device === 'desktop' ? { width: 1120, zoom: Math.min(1, width / 1120) } : undefined}>
      <Suspense fallback={<p role="status">Preparando prévia…</p>}><Preview config={config} product={product} device={device}/></Suspense>
    </div>
  </div>;
}

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
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState(initialBrief);
  const [assetChoices, setAssetChoices] = useState({ logo: 'text', banner: 'none', summary: 'none' });
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState(() => window.innerWidth < 700 ? 'mobile' : 'desktop');
  const [expanded, setExpanded] = useState(false);
  const changeBrief = (key, value) => { setBrief(current => ({ ...current, [key]: value })); setDirty(true); };
  const request = useRef(null);
  const fileInput = useRef(null);
  const fileReader = useRef(null);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); return () => { request.current?.abort(); fileReader.current?.abort(); }; }, []);
  function clearReference() { fileReader.current?.abort(); fileReader.current = null; setReference(null); if (fileInput.current) fileInput.current.value = ''; }
  function leave() { request.current?.abort(); clearReference(); onBack(); }
  async function uploadAsset(key, file) {
    if (!file || uploading) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Use uma imagem PNG, JPEG ou WebP de até 5 MB para a marca.'); return; }
    setUploading(true); setError('');
    try { const result = await uploadProductImage(file, csrfToken); if (!result.imageUrl) throw new Error('Não foi possível obter a imagem.'); changeBrief(key, result.imageUrl); }
    catch (cause) { setError(cause.message); }
    finally { setUploading(false); }
  }
  function assetField(key, label) {
    return <div className="checkout-ai-asset"><label>{label}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { void uploadAsset(key, event.target.files?.[0]); event.target.value = ''; }}/></label>{brief[key] && <div className="checkout-ai-reference"><img src={resolveMediaUrl(brief[key])} alt={label}/><span>Imagem pronta para o checkout</span><button type="button" className="secondary" aria-label={`Remover ${label.toLowerCase()}`} onClick={() => changeBrief(key, '')}><Trash2 size={16}/></button></div>}</div>;
  }
  function validateStage(stage) {
    if (stage === 0 && (!brief.brand.trim() || !prompt.trim() || !name.trim() || mode === 'DIRECT_LINK' && !productId)) { setError('Informe a marca, a ideia e o nome do checkout. Para link direto, escolha um produto.'); setStep(0); return false; }
    if (stage === 1 && (assetChoices.logo === 'image' && !brief.logoUrl || assetChoices.banner === 'image' && !brief.heroImageUrl || assetChoices.summary === 'image' && !brief.summaryBannerUrl)) { setError('Envie as imagens escolhidas ou selecione a opção sem imagem para continuar.'); setStep(1); return false; }
    return true;
  }
  function nextStage() { if (validateStage(step)) { setError(''); setStep(current => Math.min(2, current + 1)); } }
  function readFile(file) {
    clearReference(); setError(''); setDirty(true);
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Escolha uma imagem PNG, JPEG ou WebP de até 2 MB.'); return; }
    const reader = new FileReader(); fileReader.current = reader;
    reader.onload = () => { if (fileReader.current === reader) setReference({ name: file.name, data: reader.result }); };
    reader.onerror = () => setError('Não consegui abrir a imagem. Tente outro arquivo.');
    reader.readAsDataURL(file);
  }
  async function generate(event) {
    event.preventDefault();
    if (request.current || saving || uploading) return;
    if (step < 2) { nextStage(); return; }
    if (!validateStage(0) || !validateStage(1)) return;
    if (!prompt.trim() || mode === 'DIRECT_LINK' && !productId) { setError('Descreva sua ideia e selecione o produto para o link direto.'); return; }
    const testimonials = reviews.filter(item => item.name.trim() || item.text.trim());
    if (testimonials.some(item => !item.name.trim() || !item.text.trim())) { setError('Preencha o nome e a avaliação real, ou remova o depoimento incompleto.'); return; }
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try {
      const selectedBrief = { ...brief, brand: brief.brand.trim(), logoUrl: assetChoices.logo === 'image' ? brief.logoUrl : '', heroImageUrl: assetChoices.banner === 'image' ? brief.heroImageUrl : '', heroMobileImageUrl: assetChoices.banner === 'image' ? brief.heroMobileImageUrl : '', summaryBannerUrl: assetChoices.summary === 'image' && brief.showSummary ? brief.summaryBannerUrl : '' };
      const result = await generateCheckoutPreview({ prompt: prompt.trim(), brief: selectedBrief, ...(mode === 'DIRECT_LINK' ? { productId } : {}), ...(reference ? { reference: reference.data } : {}), ...(config ? { current: config } : {}), testimonials }, csrfToken, controller.signal);
      if (!controller.signal.aborted) { setConfig({ ...defaultCheckoutConfig, ...result.config }); setDirty(false); }
    } catch (cause) { if (!controller.signal.aborted) setError(cause.status === 429 ? 'Você chegou ao limite de 10 criações por hora. Tente mais tarde.' : cause.message); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  async function save() {
    if (!config || saving || busy || dirty || uploading) return;
    if (!name.trim() || !slug(name)) { setError('Informe um nome para o checkout.'); return; }
    setSaving(true); setError('');
    try {
      await onCreate({ mode, name: name.trim(), slug: `${slug(name)}-${crypto.randomUUID().slice(0, 8)}`, ...(mode === 'DIRECT_LINK' ? { productId } : {}), draftConfig: config });
      clearReference();
    } catch (cause) { setError(cause.message); setSaving(false); }
  }
  const updateReview = (index, key, value) => { setReviews(items => items.map((item, position) => position === index ? { ...item, [key]: value } : item)); setDirty(true); };
  const previewProduct = mode === 'DIRECT_LINK' ? products.find(product => product.publicId === productId) : null;
  return <main className={`page checkout-ai ${expanded ? "is-expanded" : ""}`}>
    <header className="page-title"><div><p className="eyebrow">ESTÚDIO PIRAT · CRIAR COM IA</p><h1 ref={heading} tabIndex={-1}>Dê a ideia. Eu monto o mapa.</h1><p>Descreva seu checkout, confira a prévia e deixe do seu jeito no editor.</p></div><button type="button" className="secondary" onClick={leave} disabled={saving || uploading}><ArrowLeft size={17}/> Voltar aos checkouts</button></header>
    <div className="checkout-ai-grid"><form className="card checkout-ai-form" onSubmit={generate}>
      <nav className="checkout-ai-stages" aria-label="Etapas da criação">{steps.map((label, index) => <button key={label} type="button" aria-current={step === index ? 'step' : undefined} disabled={busy || saving || uploading || index > step} onClick={() => { setStep(index); setError(''); }}><b>{index + 1}</b><span>{label}</span></button>)}</nav>
      <fieldset hidden={step !== 0} disabled={busy || saving || uploading}><legend>1. Vamos conhecer sua marca</legend><p>O que a referência tem de bom? Conte o que você quer manter e o que prefere mudar.</p>
        <label>Qual é o nome da marca?<input value={brief.brand} onChange={event => changeBrief('brand', event.target.value)} maxLength={24} placeholder="Nome que aparece para o comprador"/></label>
        <label>Nome do checkout<input value={name} onChange={event => setName(event.target.value)} maxLength={120}/></label>
        <label>Tipo de checkout<select value={mode} onChange={event => { setMode(event.target.value); setConfig(null); }}><option value="SHOPIFY_CART">Loja Shopify · carrinho automático</option><option value="DIRECT_LINK">Link direto · produto específico</option></select></label>
        {mode === 'DIRECT_LINK' && <label>Produto<select value={productId} onChange={event => { setProductId(event.target.value); setConfig(null); }}><option value="">Selecione um produto</option>{products.map(product => <option key={product.publicId} value={product.publicId}>{product.checkoutTitle}</option>)}</select></label>}
        <label htmlFor="checkout-ai-idea">Como você imagina o checkout?</label><textarea id="checkout-ai-idea" value={prompt} onChange={event => { setPrompt(event.target.value); setDirty(true); }} maxLength={2000} rows={4} placeholder="Conte a marca, as cores e o estilo que você quer…"/>
        {!config && <div className="checkout-ai-examples">{examples.map(example => <button type="button" key={example} onClick={() => setPrompt(example)}>{example}</button>)}</div>}
        <label>Qual estrutura quer usar?<select value={brief.template} onChange={event => changeBrief('template', event.target.value)}><option value="auto">IA escolhe pela referência</option>{Object.entries(structuralCheckoutTemplates).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}<option value="minimal">Clássico · duas colunas</option><option value="compact">Compacto · centralizado</option></select></label>
        {structuralCheckoutTemplates[brief.template] && <p className="checkout-ai-model-help">{structuralCheckoutTemplates[brief.template].description}</p>}
        <label>Como usar a referência?<select value={brief.fidelity} onChange={event => changeBrief('fidelity', event.target.value)}><option value="close">Aproximar cores, proporções e estilo</option><option value="inspired">Usar como inspiração e explorar</option></select></label>
        <label className="checkout-ai-upload"><ImagePlus size={19}/> Referência visual opcional<input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => readFile(event.target.files?.[0])}/></label>
        {reference && <div className="checkout-ai-reference"><img src={reference.data} alt="Referência temporária do visual"/><span>{reference.name}</span><button type="button" className="secondary" onClick={() => { clearReference(); setDirty(true); }} aria-label="Remover referência"><Trash2 size={16}/></button></div>}
        <small>A referência inspira cores e organização. Não vira banner nem entra na biblioteca; é descartada ao sair ou salvar o rascunho.</small>
      </fieldset>
      <fieldset hidden={step !== 1} disabled={busy || saving || uploading}><legend>2. Sua logo e suas imagens</legend><p>A referência mostra o estilo. Aqui entram as imagens que vão aparecer de verdade no checkout.</p>
        <label>Você tem uma logo?<select value={assetChoices.logo} onChange={event => { setAssetChoices(value => ({ ...value, logo: event.target.value })); setDirty(true); }}><option value="text">Usar o nome da marca</option><option value="image">Sim, vou enviar minha logo</option></select></label>
        {assetChoices.logo === 'image' && assetField('logoUrl', 'Logo da marca')}
        <label>Quer um banner no topo?<select value={assetChoices.banner} onChange={event => { setAssetChoices(value => ({ ...value, banner: event.target.value })); setDirty(true); }}><option value="none">Sem banner, visual mais limpo</option><option value="image">Sim, vou enviar um banner</option></select></label>
        {assetChoices.banner === 'image' && <>{assetField('heroImageUrl', 'Banner principal')}{assetField('heroMobileImageUrl', 'Banner para celular (opcional)')}</>}
        <label>Quer uma imagem junto ao resumo?<select value={assetChoices.summary} onChange={event => { setAssetChoices(value => ({ ...value, summary: event.target.value })); setDirty(true); }}><option value="none">Sem imagem adicional</option><option value="image">Sim, adicionar imagem ao resumo</option></select></label>
        {assetChoices.summary === 'image' && assetField('summaryBannerUrl', 'Imagem do resumo')}
        {uploading && <p role="status">Enviando imagem para a biblioteca…</p>}
        <small>Logos e banners enviados ficam na biblioteca da loja para continuar aparecendo. A imagem de referência permanece temporária. Você pode remover imagens não utilizadas pela biblioteca.</small>
      </fieldset>
      <fieldset hidden={step !== 2} disabled={busy || saving || uploading}><legend>3. O que seu checkout precisa ter?</legend>
        <label>Como organizar o checkout no computador?<select disabled={Boolean(structuralCheckoutTemplates[brief.template])} value={structuralCheckoutTemplates[brief.template] ? "split" : brief.layout} onChange={event => changeBrief('layout', event.target.value)}><option value="auto">IA escolhe pela referência</option><option value="split">Formulário e resumo lado a lado</option><option value="centered">Conteúdo centralizado</option></select></label>
        <label>Qual estilo de etapas você prefere?<select value={brief.progressStyle} onChange={event => changeBrief('progressStyle', event.target.value)}><option value="auto">IA escolhe pela referência</option><option value="chevrons">Faixas com setas</option><option value="icons">Ícones</option><option value="outline">Círculos com contorno</option><option value="solid">Círculos preenchidos</option></select></label>
        <div className="checkout-ai-options">{[['showProgress', 'Mostrar as etapas do checkout', 'Identificação, entrega quando necessária e pagamento.'], ['showSummary', 'Mostrar o resumo da compra', 'Produtos e valores vêm do carrinho real.'], ['showCoupon', 'Permitir inserir cupom', 'Usa os cupons cadastrados na loja.'], ['socialProofEnabled', 'Ativar avisos de compras recentes', 'Os pop-ups aparecem quando houver vendas reais elegíveis na loja. Não inventamos compradores.']].map(([key, label, help]) => <label className="checkout-ai-option" key={key}><input type="checkbox" checked={brief[key]} onChange={event => changeBrief(key, event.target.checked)}/><span><b>{label}</b><small>{help}</small></span></label>)}</div>
        <h3>E os depoimentos?</h3><p>Deixo os cartões prontos com as avaliações que você fornecer. Sem avaliações, a seção fica desativada no rascunho.</p>
        {reviews.map((review, index) => <div className="checkout-ai-review" key={index}><label>Nome do cliente {index + 1}<input value={review.name} maxLength={80} onChange={event => updateReview(index, 'name', event.target.value)}/></label><label>Avaliação real<textarea value={review.text} maxLength={240} rows={2} onChange={event => updateReview(index, 'text', event.target.value)}/></label><label>Nota<select value={review.rating} onChange={event => updateReview(index, 'rating', Number(event.target.value))}>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} de 5</option>)}</select></label><button type="button" className="secondary" onClick={() => { setReviews(items => items.filter((_, i) => i !== index)); setDirty(true); }}><Trash2 size={15}/> Remover depoimento {index + 1}</button></div>)}
        <button type="button" className="secondary" disabled={reviews.length >= 6} onClick={() => { setReviews(items => [...items, { name: '', text: '', rating: 5 }]); setDirty(true); }}><Plus size={17}/> Adicionar depoimento</button>
      </fieldset>
      <p className="checkout-ai-privacy" hidden={step !== 2}>Enviamos sua ideia e a referência ao Gemini. Evite dados pessoais nas imagens. As avaliações são inseridas sem alteração pela Pirat e não são enviadas à IA. O processamento no Google segue os termos do serviço.</p>
      {error && <p role="alert" className="public-error">{error}</p>}
      <div className="checkout-ai-actions">
        {step > 0 && <button type="button" className="secondary" disabled={busy || saving || uploading} onClick={() => { setStep(value => value - 1); setError(''); }}><ArrowLeft size={17}/> Anterior</button>}
        {step < 2 ? <button type="submit" className="primary" disabled={busy || saving || uploading}>Continuar <ArrowRight size={17}/></button> : <button type="submit" className="primary" disabled={busy || saving || uploading || !prompt.trim()}>{busy ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>} {busy ? 'Montando sua prévia…' : config ? 'Ajustar com IA' : 'Gerar prévia'}</button>}
        {busy && <button type="button" className="secondary" onClick={() => { request.current?.abort(); request.current = null; setBusy(false); }}>Cancelar geração</button>}
      </div>
      {step === 2 && config && <div className="checkout-ai-refine"><label htmlFor="checkout-ai-adjust">O que quer ajustar?</label><textarea id="checkout-ai-adjust" disabled={busy || saving} value={prompt} onChange={event => { setPrompt(event.target.value); setDirty(true); }} rows={3} maxLength={2000}/><small>Para mudar marca, imagens ou recursos, volte às etapas anteriores. Depois clique em Ajustar com IA.</small></div>}
    </form><section className="card checkout-ai-result" aria-label="Prévia do checkout"><div className="checkout-ai-result-head"><span className="eyebrow">SEU CHECKOUT, DO SEU JEITO</span><h2>{config ? 'Seu checkout tomou forma.' : 'Um bom checkout começa aqui.'}</h2><p>{config ? 'Prévia ilustrativa. Os produtos e preços publicados vêm da sua loja. Amplie para conferir os detalhes.' : 'Primeiro a marca. Depois as imagens e os recursos. A IA combina suas escolhas com a referência.'}</p></div>
      {config ? <>
        <div className="checkout-ai-toolbar" role="group" aria-label="Dispositivo da prévia"><button type="button" className="secondary" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={17}/> Computador</button><button type="button" className="secondary" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={17}/> Celular</button><button type="button" className="secondary" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><Maximize2 size={17}/> {expanded ? 'Voltar à criação' : 'Ampliar prévia'}</button></div>
        <DesignPreview config={config} product={previewProduct ? { ...previewProduct, title: previewProduct.checkoutTitle } : undefined} device={device}/>
        <div className="checkout-ai-design-summary"><b>{config.logoText}</b><span>{config.layout === 'split' ? 'Formulário e resumo lado a lado' : 'Composição centralizada'} · {config.font}</span><span>{config.heroEnabled ? 'Com banner' : 'Sem banner'} · {config.socialProofEnabled ? 'Avisos de vendas reais ativados' : 'Sem avisos de compras'}</span></div>
        {config.socialProofEnabled && <p className="checkout-ai-proof-note">As notificações aparecem no checkout publicado quando há compras reais disponíveis. Esta prévia não simula clientes.</p>}
        <div className="checkout-ai-result-foot">{dirty && <p role="status">Suas escolhas mudaram. Gere uma nova prévia antes de salvar.</p>}<button type="button" className="primary" onClick={save} disabled={saving || busy || dirty || uploading}>{saving ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>} Salvar rascunho e abrir editor</button><small>Tudo continua editável. Confira os textos e publique pelo editor quando estiver pronto.</small></div>
      </> : <div className="checkout-ai-empty"><img src="/brand/assistant/thinking.webp" alt="Papagaio da Pirat pensando no próximo checkout" width="180" height="180"/><h3>Vamos dar cara à sua loja.</h3><p>A referência guia a composição, as cores e as etapas. Sua logo, seus banners e seus depoimentos completam o visual.</p><div className="checkout-ai-review-placeholder"><b>Você escolhe. A IA organiza.</b><small>Marca · Imagens · Etapas · Resumo · Compras recentes</small></div></div>}
    </section></div>
  </main>;
}
