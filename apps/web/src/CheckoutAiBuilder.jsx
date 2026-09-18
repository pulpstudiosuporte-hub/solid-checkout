import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, Check, Pencil, ImagePlus, LoaderCircle, Monitor, Smartphone, Maximize2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { generateCheckoutPreview, uploadProductImage, resolveMediaUrl } from './api';
import { defaultCheckoutConfig } from './checkout-config';
import './checkout-ai.css';
import { structuralCheckoutTemplates } from './checkout-template-catalog';

const Preview = lazy(() => import('./CheckoutEditor').then(module => ({ default: module.CheckoutAnalyticsPreview })));
const examples = ['Uma marca de café, com tons quentes e visual acolhedor.', 'Um curso online com visual limpo, azul escuro e foco no formulário.', 'Uma loja de acessórios com fundo claro e detalhes em vermelho.'];
const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 65);
const initialBrief = { template: 'auto', brand: '', logoUrl: '', heroImageUrl: '', heroMobileImageUrl: '', summaryBannerUrl: '', fidelity: 'close', layout: 'auto', progressStyle: 'auto', showProgress: true, showCoupon: true, showSummary: true, socialProofEnabled: false };
const questionOrder = ['brand', 'idea', 'colors', 'mode', 'product', 'template', 'reference', 'logo', 'banner', 'summaryImage', 'layout', 'progress', 'coupon', 'summary', 'socialProof', 'reviews', 'name'];
const questionText = {
  brand: 'Fala, marujo! Vamos dar cara ao seu checkout. Qual é o nome da sua marca?',
  idea: 'Boa! O que sua loja vende e que estilo você imagina para ela?',
  colors: 'E as cores da sua marca? Pode me contar os nomes ou os códigos.',
  mode: 'Esse checkout vai receber o carrinho da Shopify ou vender um produto específico?',
  product: 'Qual produto vamos colocar nesse checkout?',
  template: 'Como você quer organizar o checkout? Posso escolher ou seguir um destes modelos.',
  reference: 'Tem algum visual que você curte? Me mande uma referência, se quiser.',
  logo: 'Sua marca tem logo? Manda aqui ou eu uso o nome dela no cabeçalho.',
  banner: 'Quer um banner para receber o comprador ou prefere um topo mais limpo?',
  summaryImage: 'Quer colocar uma imagem junto ao resumo da compra?',
  layout: 'No computador, você prefere tudo centralizado ou o resumo ao lado?',
  progress: 'Como vamos mostrar o caminho até o pagamento?',
  coupon: 'Vamos deixar um espaço para o comprador inserir cupom?',
  summary: 'Quer mostrar o resumo com os produtos e valores da compra?',
  socialProof: 'E aqueles avisos de compras recentes? Quer ativar?',
  reviews: 'Tem depoimentos reais para incluir? Pode mandar os nomes e as avaliações.',
  name: 'Último detalhe, capitão: como vamos chamar esse checkout no seu painel?',
};

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
  const [question, setQuestion] = useState('brand');
  const [answered, setAnswered] = useState([]);
  const [colors, setColors] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [messages, setMessages] = useState([]);
  const activeQuestion = useRef(null);
  const conversation = useRef(null);
  const [brief, setBrief] = useState(initialBrief);
  const [assetChoices, setAssetChoices] = useState({ logo: 'text', banner: 'none', summary: 'none' });
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState(() => window.innerWidth < 700 ? 'mobile' : 'desktop');
  const [expanded, setExpanded] = useState(false);
  const changeBrief = (key, value) => { setBrief(current => ({ ...current, [key]: value })); setDirty(true); };
  const request = useRef(null);
  const fileInput = useRef(null);
  const fileReader = useRef(null);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); return () => { request.current?.abort(); fileReader.current?.abort(); }; }, []);
  function clearReference() { setReading(false); fileReader.current?.abort(); fileReader.current = null; setReference(null); if (fileInput.current) fileInput.current.value = ''; }
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
  const visibleQuestions = questionOrder.filter(id => (id !== 'product' || mode === 'DIRECT_LINK') && (id !== 'layout' || !structuralCheckoutTemplates[brief.template]));
  const locked = busy || saving || uploading || reading;
  useEffect(() => {
    activeQuestion.current?.focus({ preventScroll: true });
    if (conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight;
  }, [question, messages.length]);
  function questionError(id) {
    if (id === 'brand' && !brief.brand.trim()) return 'Me diga o nome da marca para começarmos.';
    if (id === 'idea' && !prompt.trim()) return 'Conte um pouco sobre a loja e o estilo que você quer.';
    if (id === 'product' && !products.some(product => product.publicId === productId)) return 'Escolha um produto cadastrado para continuar.';
    if (id === 'name' && (!name.trim() || !slug(name))) return 'Dê um nome ao checkout usando letras ou números.';
    const assets = { logo: ['logo', 'logoUrl'], banner: ['banner', 'heroImageUrl'], summaryImage: ['summary', 'summaryBannerUrl'] };
    if (assets[id] && assetChoices[assets[id][0]] === 'image' && !brief[assets[id][1]]) return 'Envie a imagem ou escolha continuar sem ela.';
    if (id === 'reviews' && reviews.some(item => !item.name.trim() || !item.text.trim())) return 'Preencha o nome e a avaliação real, ou remova o depoimento incompleto.';
    return '';
  }
  function answer(event) {
    event.preventDefault();
    if (locked) return;
    if (question === 'ready') { void generate(); return; }
    const problem = questionError(question);
    if (problem) { setError(problem); return; }
    const completed = [...new Set([...answered, question])];
    setAnswered(completed); setError('');
    setQuestion(visibleQuestions.find(id => !completed.includes(id)) || 'ready');
  }
  function editAnswer(id) { setQuestion(id); setError(''); }
  function answerSummary(id) {
    const yesNo = value => value ? 'Sim' : 'Não';
    return ({
      brand: brief.brand, idea: prompt, colors: colors.trim() || 'Pode escolher as cores para mim',
      mode: mode === 'SHOPIFY_CART' ? 'Carrinho da Shopify' : 'Produto específico',
      product: products.find(item => item.publicId === productId)?.checkoutTitle || 'Produto não selecionado',
      template: structuralCheckoutTemplates[brief.template]?.name || ({ auto: 'Pode escolher o modelo', minimal: 'Clássico · duas colunas', compact: 'Compacto · centralizado' })[brief.template],
      reference: reference ? `${reference.name} · ${brief.fidelity === 'close' ? 'Seguir de perto' : 'Usar como inspiração'}` : 'Sem referência visual',
      logo: assetChoices.logo === 'image' ? 'Usar minha logo' : 'Usar o nome da marca',
      banner: assetChoices.banner === 'image' ? `Com banner${brief.heroMobileImageUrl ? ' e versão para celular' : ''}` : 'Sem banner',
      summaryImage: assetChoices.summary === 'image' ? 'Com imagem no resumo' : 'Sem imagem no resumo',
      layout: ({ auto: 'Pode escolher a organização', split: 'Resumo ao lado', centered: 'Tudo centralizado' })[brief.layout],
      progress: brief.showProgress ? ({ auto: 'Pode escolher as etapas', icons: 'Etapas com ícones', outline: 'Círculos com contorno', solid: 'Círculos preenchidos', chevrons: 'Faixas com setas' })[brief.progressStyle] : 'Sem indicador de etapas',
      coupon: `${yesNo(brief.showCoupon)}, ${brief.showCoupon ? 'permitir' : 'ocultar'} cupom`,
      summary: `${yesNo(brief.showSummary)}, ${brief.showSummary ? 'mostrar' : 'ocultar'} resumo`,
      socialProof: brief.socialProofEnabled ? 'Ativar avisos de compras reais' : 'Sem avisos de compras',
      reviews: reviews.length ? `${reviews.length} depoimento(s) fornecido(s)` : 'Sem depoimentos por enquanto',
      name,
    })[id];
  }
  function readFile(file) {
    clearReference(); setError(''); setDirty(true);
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Escolha uma imagem PNG, JPEG ou WebP de até 2 MB.'); return; }
    setReading(true); const reader = new FileReader(); fileReader.current = reader;
    reader.onload = () => { if (fileReader.current === reader) { setReference({ name: file.name, data: reader.result }); setReading(false); } };
    reader.onerror = () => { setReading(false); setError('Não consegui abrir a imagem. Tente outro arquivo.'); };
    reader.readAsDataURL(file);
  }
  async function generate() {
    if (request.current || locked || config && !dirty) return;
    const invalid = visibleQuestions.find(id => questionError(id));
    if (invalid) { setQuestion(invalid); setError(questionError(invalid)); return; }
    const missing = visibleQuestions.find(id => !answered.includes(id));
    if (missing) { setQuestion(missing); return; }
    const testimonials = reviews.filter(item => item.name.trim() && item.text.trim());
    const sentAdjustment = adjustment.trim();
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try {
      const selectedBrief = { ...brief, brand: brief.brand.trim(), logoUrl: assetChoices.logo === 'image' ? brief.logoUrl : '', heroImageUrl: assetChoices.banner === 'image' ? brief.heroImageUrl : '', heroMobileImageUrl: assetChoices.banner === 'image' ? brief.heroMobileImageUrl : '', summaryBannerUrl: assetChoices.summary === 'image' && brief.showSummary ? brief.summaryBannerUrl : '' };
      const result = await generateCheckoutPreview({ prompt: [prompt.trim(), colors.trim() ? `Cores da marca: ${colors.trim()}` : '', sentAdjustment ? `Ajuste solicitado: ${sentAdjustment}` : ''].filter(Boolean).join('\n'), brief: selectedBrief, ...(mode === 'DIRECT_LINK' ? { productId } : {}), ...(reference ? { reference: reference.data } : {}), ...(config ? { current: config } : {}), testimonials }, csrfToken, controller.signal);
      if (!controller.signal.aborted) { setConfig({ ...defaultCheckoutConfig, ...result.config }); setDirty(false); setAdjustment(''); setMessages(items => [...items, ...(sentAdjustment ? [{ role: 'user', text: sentAdjustment }] : []), { role: 'assistant', text: config ? 'Ajuste pronto, capitão. Confira a nova prévia e me diga se quer mudar mais alguma coisa.' : 'Pronto, seu checkout tomou forma! Confira a prévia. Quer mudar algo? Me conta aqui.' }]); }
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
  function options(label, value, items, onChange) {
    return <div className="checkout-ai-choices" role="group" aria-label={label}>{items.map(([id, title, help]) => <button type="button" key={String(id)} aria-pressed={value === id} onClick={() => onChange(id)}><span>{title}</span>{help && <small>{help}</small>}{value === id && <Check size={16} aria-hidden="true"/>}</button>)}</div>;
  }
  const inputKeyDown = event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
  };
  function questionControl() {
    switch (question) {
      case 'brand': return <label>Nome da marca<input value={brief.brand} onChange={event => { changeBrief('brand', event.target.value); if (!answered.includes('name')) setName(`Checkout ${event.target.value}`); }} maxLength={24} placeholder="Ex.: Aurora" autoComplete="organization"/></label>;
      case 'idea': return <><label>Sua ideia<textarea value={prompt} onChange={event => { setPrompt(event.target.value); setDirty(true); }} onKeyDown={inputKeyDown} maxLength={1200} rows={3} placeholder="Uma loja de tênis com um visual minimalista…"/></label><div className="checkout-ai-examples">{examples.map(example => <button type="button" key={example} onClick={() => { setPrompt(example); setDirty(true); }}>{example}</button>)}</div></>;
      case 'colors': return <><label>Cores da marca<input value={colors} onChange={event => { setColors(event.target.value); setDirty(true); }} maxLength={160} placeholder="Ex.: preto e branco, detalhes em vermelho"/></label><small>Se ainda não definiu, deixe em branco e eu escolho com base na sua ideia.</small></>;
      case 'mode': return options('Tipo de checkout', mode, [['SHOPIFY_CART', 'Carrinho da Shopify', 'Recebe os produtos da sua loja.'], ['DIRECT_LINK', 'Produto específico', 'Um link para um produto cadastrado.']], value => { setMode(value); setConfig(null); setDirty(true); });
      case 'product': return <><label>Produto<select value={productId} onChange={event => { setProductId(event.target.value); setConfig(null); setDirty(true); }}><option value="">Selecione um produto</option>{products.map(product => <option key={product.publicId} value={product.publicId}>{product.checkoutTitle}</option>)}</select></label>{!products.length && <p>Você precisa cadastrar um produto primeiro. Pode voltar e escolher o carrinho da Shopify ou sair para cadastrar.</p>}</>;
      case 'template': return options('Estrutura do checkout', brief.template, [['auto', 'Escolha para mim'], ...Object.entries(structuralCheckoutTemplates).map(([id, item]) => [id, item.name, item.description]), ['minimal', 'Clássico · duas colunas'], ['compact', 'Compacto · centralizado']], value => changeBrief('template', value));
      case 'reference': return <><label className="checkout-ai-upload"><ImagePlus size={19}/> Referência visual opcional<input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => readFile(event.target.files?.[0])}/></label>{reference && <><div className="checkout-ai-reference"><img src={reference.data} alt="Referência temporária do visual"/><span>{reference.name}</span><button type="button" className="secondary" onClick={() => { clearReference(); setDirty(true); }} aria-label="Remover referência"><Trash2 size={16}/></button></div>{options('Uso da referência', brief.fidelity, [['close', 'Seguir de perto'], ['inspired', 'Só inspiração']], value => changeBrief('fidelity', value))}</>}<small>A referência é temporária: sai ao fechar ou salvar. Ela não vira logo nem banner.</small></>;
      case 'logo': return <>{options('Logo da marca', assetChoices.logo, [['text', 'Usar o nome da marca'], ['image', 'Enviar minha logo']], value => { setAssetChoices(current => ({ ...current, logo: value })); setDirty(true); })}{assetChoices.logo === 'image' && assetField('logoUrl', 'Logo da marca')}</>;
      case 'banner': return <>{options('Banner no topo', assetChoices.banner, [['none', 'Prefiro sem banner'], ['image', 'Quero enviar um banner']], value => { setAssetChoices(current => ({ ...current, banner: value })); setDirty(true); })}{assetChoices.banner === 'image' && <>{assetField('heroImageUrl', 'Banner principal')}{assetField('heroMobileImageUrl', 'Banner para celular (opcional)')}</>}</>;
      case 'summaryImage': return <>{options('Imagem do resumo', assetChoices.summary, [['none', 'Sem imagem adicional'], ['image', 'Enviar imagem do resumo']], value => { setAssetChoices(current => ({ ...current, summary: value })); setDirty(true); })}{assetChoices.summary === 'image' && assetField('summaryBannerUrl', 'Imagem do resumo')}</>;
      case 'layout': return options('Organização no computador', brief.layout, [['auto', 'Escolha para mim'], ['split', 'Resumo ao lado'], ['centered', 'Tudo centralizado']], value => changeBrief('layout', value));
      case 'progress': return options('Indicador de etapas', brief.showProgress ? brief.progressStyle : 'hidden', [['auto', 'Escolha para mim'], ['chevrons', 'Faixas com setas'], ['icons', 'Ícones'], ['outline', 'Círculos com contorno'], ['solid', 'Círculos preenchidos'], ['hidden', 'Não mostrar etapas']], value => { changeBrief('showProgress', value !== 'hidden'); if (value !== 'hidden') changeBrief('progressStyle', value); });
      case 'coupon': return <>{options('Cupom', brief.showCoupon, [[true, 'Sim, permitir cupom'], [false, 'Não preciso de cupom']], value => changeBrief('showCoupon', value))}<small>Usa os cupons que você cadastrar na loja.</small></>;
      case 'summary': return <>{options('Resumo da compra', brief.showSummary, [[true, 'Sim, mostrar resumo'], [false, 'Ocultar resumo']], value => changeBrief('showSummary', value))}{!brief.showSummary && assetChoices.summary === 'image' && <small>A imagem do resumo também ficará oculta.</small>}</>;
      case 'socialProof': return <>{options('Avisos de compras recentes', brief.socialProofEnabled, [[true, 'Sim, ativar avisos'], [false, 'Sem avisos de compras']], value => changeBrief('socialProofEnabled', value))}<small>Só aparecem compras reais elegíveis da loja. Sem vendas inventadas, marujo.</small></>;
      case 'reviews': return <><p>Sem avaliações agora? Pode seguir e adicionar depois no editor.</p>{reviews.map((review, index) => <div className="checkout-ai-review" key={index}><label>Nome do cliente {index + 1}<input value={review.name} maxLength={80} onChange={event => updateReview(index, 'name', event.target.value)}/></label><label>Avaliação real {index + 1}<textarea value={review.text} maxLength={240} rows={2} onChange={event => updateReview(index, 'text', event.target.value)}/></label><label>Nota {index + 1}<select value={review.rating} onChange={event => updateReview(index, 'rating', Number(event.target.value))}>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} de 5</option>)}</select></label><button type="button" className="secondary" onClick={() => { setReviews(items => items.filter((_, i) => i !== index)); setDirty(true); }}><Trash2 size={15}/> Remover depoimento {index + 1}</button></div>)}<button type="button" className="secondary" disabled={reviews.length >= 6} onClick={() => { setReviews(items => [...items, { name: '', text: '', rating: 5 }]); setDirty(true); }}><Plus size={17}/> Adicionar depoimento</button></>;
      case 'name': return <label>Nome do checkout<input value={name} onChange={event => setName(event.target.value)} maxLength={120}/></label>;
      default: return config ? <label>O que quer ajustar?<textarea value={adjustment} disabled={busy || saving} onChange={event => { setAdjustment(event.target.value); setDirty(true); }} onKeyDown={inputKeyDown} maxLength={500} rows={3} placeholder="Ex.: deixa os botões mais arredondados…"/></label> : <p>As respostas estão na conversa. Pode alterar qualquer uma antes de gerar.</p>;
    }
  }
  const completedQuestions = visibleQuestions.filter(id => answered.includes(id));
  return <main className={`page checkout-ai ${expanded ? "is-expanded" : ""}`}>
    <header className="page-title"><div><p className="eyebrow">ESTÚDIO PIRAT · CRIAR COM IA</p><h1 ref={heading} tabIndex={-1}>Seu checkout começa numa conversa.</h1><p>Um papo com o papagaio. Uma ideia de cada vez. Tudo com a sua cara.</p></div><button type="button" className="secondary" onClick={leave} disabled={saving || uploading}><ArrowLeft size={17}/> Voltar aos checkouts</button></header>
    <div className="checkout-ai-grid"><form className="card checkout-ai-form checkout-ai-chat" onSubmit={answer}>
      <div className="checkout-ai-chat-head"><img src={busy ? "/brand/assistant/thinking.webp" : config ? "/brand/assistant/happy.webp" : "/brand/assistant/greeting.webp"} alt="" width="56" height="56"/><div><b>Papagaio da Pirat</b><span>Seu parceiro de criação</span></div><span className="checkout-ai-chat-count">{completedQuestions.length}/{visibleQuestions.length}</span></div>
      <div className="checkout-ai-chat-progress" role="progressbar" aria-label="Respostas da criação" aria-valuemin={0} aria-valuemax={visibleQuestions.length} aria-valuenow={completedQuestions.length}><span style={{ width: `${completedQuestions.length / visibleQuestions.length * 100}%` }}/></div>
      <div className="checkout-ai-conversation" ref={conversation} role="region" aria-label="Conversa de criação" tabIndex={0}>
        {completedQuestions.length > 0 && <ol className="checkout-ai-messages" aria-label="Respostas anteriores">{completedQuestions.map(id => <li key={id}><p className="checkout-ai-bubble from-parrot">{questionText[id]}</p><div className="checkout-ai-bubble from-merchant"><span>{answerSummary(id)}</span><button type="button" disabled={locked} onClick={() => editAnswer(id)} aria-label={`Alterar resposta: ${id === 'idea' ? 'ideia' : answerSummary(id)}`}><Pencil size={15}/></button></div></li>)}</ol>}
        {messages.map((message, index) => <p key={index} className={`checkout-ai-bubble ${message.role === 'user' ? 'from-merchant' : 'from-parrot'}`}>{message.text}</p>)}
        <div className="checkout-ai-current"><span className="eyebrow">PAPAGAIO DA PIRAT</span><h2 ref={activeQuestion} tabIndex={-1}>{question === 'ready' ? config ? 'O que mais vamos deixar do seu jeito?' : `Fechou, ${brief.brand}! Vamos montar sua prévia?` : questionText[question]}</h2></div>
      </div>
      <fieldset className="checkout-ai-composer" disabled={locked}><legend className="sr-only">Sua resposta</legend>{questionControl()}</fieldset>
      {['logo', 'banner', 'summaryImage'].includes(question) && <small className="checkout-ai-asset-note">Logo e banners ficam na biblioteca para aparecer no checkout. A referência visual é temporária.</small>}
      {uploading && <p role="status">Enviando imagem para a biblioteca…</p>}{reading && <p role="status">Preparando a referência…</p>}
      {question === 'ready' && <p className="checkout-ai-privacy">Sua ideia e referência são enviadas ao Gemini. Evite dados pessoais nas imagens. Os depoimentos são aplicados pela Pirat sem alteração e não são enviados à IA.</p>}
      {error && <p role="alert" className="public-error">{error}</p>}
      <div className="checkout-ai-actions">{question !== 'ready' && completedQuestions.length > 0 && <button type="button" className="secondary" disabled={locked} onClick={() => editAnswer(visibleQuestions[Math.max(0, visibleQuestions.indexOf(question) - 1)])}><ArrowLeft size={17}/> Voltar</button>}<button type="submit" className="primary" disabled={locked || question === 'ready' && Boolean(config) && !dirty}>{busy ? <LoaderCircle className="spin" size={18}/> : question === 'ready' ? <Sparkles size={18}/> : <ArrowUp size={18}/>} {busy ? 'Montando sua prévia…' : question === 'ready' ? config ? 'Enviar ajuste' : 'Gerar prévia' : 'Enviar resposta'}</button>{busy && <button type="button" className="secondary" onClick={() => { request.current?.abort(); request.current = null; setBusy(false); }}>Cancelar geração</button>}</div>
    </form><section className="card checkout-ai-result" aria-label="Prévia do checkout"><div className="checkout-ai-result-head"><span className="eyebrow">SEU CHECKOUT, DO SEU JEITO</span><h2>{config ? 'Seu checkout tomou forma.' : 'Um bom checkout começa aqui.'}</h2><p>{config ? 'Prévia ilustrativa. Os produtos e preços publicados vêm da sua loja. Amplie para conferir os detalhes.' : 'Enquanto a gente conversa, suas escolhas ficam guardadas aqui. A prévia aparece quando você pedir para gerar.'}</p></div>
      {config ? <>
        <div className="checkout-ai-toolbar" role="group" aria-label="Dispositivo da prévia"><button type="button" className="secondary" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={17}/> Computador</button><button type="button" className="secondary" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={17}/> Celular</button><button type="button" className="secondary" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><Maximize2 size={17}/> {expanded ? 'Voltar à criação' : 'Ampliar prévia'}</button></div>
        <DesignPreview config={config} product={previewProduct ? { ...previewProduct, title: previewProduct.checkoutTitle } : undefined} device={device}/>
        <div className="checkout-ai-design-summary"><b>{config.logoText}</b><span>{config.layout === 'split' ? 'Formulário e resumo lado a lado' : 'Composição centralizada'} · {config.font}</span><span>{config.heroEnabled ? 'Com banner' : 'Sem banner'} · {config.socialProofEnabled ? 'Avisos de vendas reais ativados' : 'Sem avisos de compras'}</span></div>
        {config.socialProofEnabled && <p className="checkout-ai-proof-note">As notificações aparecem no checkout publicado quando há compras reais disponíveis. Esta prévia não simula clientes.</p>}
        <div className="checkout-ai-result-foot">{dirty && <p role="status">Suas escolhas mudaram. Gere uma nova prévia antes de salvar.</p>}<button type="button" className="primary" onClick={save} disabled={saving || busy || dirty || uploading}>{saving ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>} Salvar rascunho e abrir editor</button><small>Tudo continua editável. Confira os textos e publique pelo editor quando estiver pronto.</small></div>
      </> : <div className="checkout-ai-empty"><img src="/brand/assistant/thinking.webp" alt="Papagaio da Pirat pensando no próximo checkout" width="180" height="180"/><h3>{brief.brand ? `A próxima parada é ${brief.brand}.` : 'Puxa uma cadeira, marujo.'}</h3><p>Me conte sua ideia. Eu pergunto o que falta e monto o checkout com você.</p>{completedQuestions.length > 0 && <dl className="checkout-ai-brief-summary">{completedQuestions.map(id => <div key={id}><dt>{({brand:'Marca',idea:'Ideia',colors:'Cores',mode:'Tipo',product:'Produto',template:'Modelo',reference:'Referência',logo:'Logo',banner:'Banner',summaryImage:'Imagem',layout:'Organização',progress:'Etapas',coupon:'Cupom',summary:'Resumo',socialProof:'Compras recentes',reviews:'Depoimentos',name:'Nome'})[id]}</dt><dd>{answerSummary(id)}</dd></div>)}</dl>}</div>}
    </section></div>
  </main>;
}
