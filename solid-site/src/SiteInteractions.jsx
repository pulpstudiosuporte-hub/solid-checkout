import { useId, useRef, useState } from 'react';
import { MiniMovingChart, SuccessBurst } from './SiteMotion';
import { ArrowRight, Check, CheckCheck, Copy, LockKeyhole, Minus, Plus, QrCode, RotateCcw, ShieldCheck, ShoppingBag, SlidersHorizontal } from 'lucide-react';

const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const colors = [['red', 'Vermelho'], ['blue', 'Azul'], ['green', 'Verde']];
const deliveryOptions = [{ id: 'standard', name: 'Entrega padrão', time: '5 a 8 dias úteis', price: 0 }, { id: 'express', name: 'Entrega expressa', time: '2 a 3 dias úteis', price: 19.9 }];

export function CheckoutDemo() {
  const id = useId();
  const heading = useRef(null);
  const [color, setColor] = useState('red');
  const [bump, setBump] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState(0);
  const [delivery, setDelivery] = useState('standard');
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(false);
  const [couponMessage, setCouponMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [customer, setCustomer] = useState({ name: 'Alex Exemplo', email: 'alex@example.com' });
  const shipping = deliveryOptions.find(item => item.id === delivery);
  const subtotal = quantity * 149 + (bump ? 29 : 0);
  const savings = discount ? Math.round(subtotal * 10) / 100 : 0;
  const total = subtotal - savings + shipping.price;
  const titles = ['Monte seu pedido', 'Quem recebe o pedido?', 'Escolha a entrega', 'Revise e experimente o Pix', 'Aguardando pagamento simulado', 'Pedido confirmado na demonstração'];
  const go = next => {
    setStep(next);
    setCopyMessage('');
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  };
  const reset = () => {
    setQuantity(1); setBump(false); setDelivery('standard'); setCoupon(''); setDiscount(false); setCouponMessage('');
    setCustomer({ name: 'Alex Exemplo', email: 'alex@example.com' }); go(0);
  };
  const applyCoupon = event => {
    event.preventDefault();
    if (coupon.trim().toUpperCase() === 'BEMVINDO') {
      setDiscount(true); setCouponMessage('Cupom aplicado: 10% nos produtos, sem incluir o frete.');
    } else {
      setDiscount(false); setCouponMessage('Cupom não encontrado. Use BEMVINDO para testar 10% de desconto.');
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText('PIRAT-DEMONSTRACAO-SEM-VALOR-DE-PAGAMENTO');
      setCopyMessage('Texto de exemplo copiado. Ele não funciona em aplicativos bancários.');
    } catch {
      setCopyMessage('Não foi possível copiar. Selecione e copie o texto de exemplo abaixo.');
    }
  };
  return <div className={`site-demo interactive-demo ${color}`}>
    <div className="demo-toolbar"><span><i/><i/><i/></span><span><LockKeyhole size={11}/> sua-marca.com/checkout</span><ShieldCheck size={13}/></div>
    <div className="demo-content">
      <div className="demo-brand"><span>essentials<span className="accent-dot">.</span></span><span>LOJA DE EXEMPLO</span></div>
      <nav className="demo-step-nav" aria-label="Etapas da demonstração">{['Pedido', 'Dados', 'Entrega', 'Pix'].map((label, index) => <button key={label} aria-current={Math.min(step, 3) === index ? 'step' : undefined} disabled={index > step || step >= 4} onClick={() => go(index)}><span>{index < step ? <Check size={12}/> : index + 1}</span>{label}</button>)}</nav>
      <h2 key={step} className="demo-step-title" ref={heading} tabIndex={-1}>{titles[step]}</h2>
      {step === 0 && <>
        <p className="demo-help">Altere o pedido e veja o total mudar. Todos os valores são ilustrativos.</p>
        <div className="demo-product"><div className="site-product-art small" aria-hidden="true"><ShoppingBag/></div><div><strong>Everyday Kit</strong><span>Cor: areia · {money(149)} por unidade</span></div><div className="demo-quantity"><button aria-label="Diminuir quantidade" disabled={quantity === 1} onClick={() => setQuantity(quantity - 1)}><Minus size={13}/></button><output aria-label="Quantidade">{quantity}</output><button aria-label="Aumentar quantidade" disabled={quantity === 5} onClick={() => setQuantity(quantity + 1)}><Plus size={13}/></button></div></div>
        <label className="demo-bump"><input type="checkbox" aria-label="Adicionar ecobag por 29 reais" checked={bump} onChange={e => setBump(e.target.checked)}/><span><strong>Complete seu kit</strong><small>Uma ecobag por {money(29)} no pedido.</small></span><ShoppingBag size={21}/></label>
        <details className="demo-coupon"><summary>Tenho um cupom de desconto</summary><form onSubmit={applyCoupon}><label htmlFor={`${id}-coupon`}>Teste o cupom BEMVINDO</label><div className="demo-input-row"><input aria-label="Teste o cupom BEMVINDO" id={`${id}-coupon`} value={coupon} maxLength={30} onChange={e => { setCoupon(e.target.value); setCouponMessage(''); }} placeholder="Digite o cupom"/><button type="submit">Aplicar</button></div></form>{discount && <button className="demo-link" onClick={() => { setDiscount(false); setCouponMessage('Cupom removido.'); }}>Remover cupom</button>}<p className="demo-help" role="status">{couponMessage}</p></details>
      </>}
      {step === 1 && <form id={`${id}-customer`} className="demo-form" onSubmit={event => { event.preventDefault(); go(2); }}>
        <p className="demo-help">Use os dados fictícios preenchidos ou invente outros. Nada é enviado ou salvo ao sair da página.</p>
        <label>Nome de exemplo<input aria-label="Nome de exemplo" required maxLength={60} value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} pattern=".*\S.*" autoComplete="off"/></label>
        <label>E-mail de exemplo<input aria-label="E-mail de exemplo" required type="email" maxLength={100} value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} autoComplete="off"/></label>
      </form>}
      {step === 2 && <fieldset className="demo-delivery"><legend>Frete para um endereço de exemplo</legend><p className="demo-help">Os prazos e preços abaixo são fictícios. Na loja, as opções dependem do endereço e da configuração de entrega.</p>{deliveryOptions.map(option => <label key={option.id}><input aria-label={`${option.name}, ${option.time}, ${option.price ? money(option.price) : "Grátis"}`} type="radio" name={`${id}-shipping`} checked={delivery === option.id} onChange={() => setDelivery(option.id)}/><span><strong>{option.name}</strong><small>{option.time}</small></span><b>{option.price ? money(option.price) : 'Grátis'}</b></label>)}</fieldset>}
      {step === 3 && <>
        <p className="demo-help">Confira os dados antes de continuar. Você poderá simular uma confirmação ou voltar para editar.</p>
        <div className="demo-review"><span><strong>{customer.name}</strong><small>{customer.email}</small></span><button onClick={() => go(1)}>Editar dados</button></div>
        <div className="demo-review"><span><strong>{shipping.name}</strong><small>{shipping.time} · Exemplo</small></span><button onClick={() => go(2)}>Editar entrega</button></div>
        <div className="demo-method"><div><QrCode size={23}/><span><strong>Pagamento Pix</strong><small>A próxima tela é apenas uma simulação.</small></span></div><Check size={16}/></div>
      </>}
      {step < 4 && <>
        <dl className="demo-breakdown"><div><dt>Produtos {bump ? '+ ecobag' : ''}</dt><dd>{money(subtotal)}</dd></div>{discount && <div><dt>Cupom BEMVINDO · 10%</dt><dd>− {money(savings)}</dd></div>}<div><dt>Entrega {step < 2 ? 'padrão' : ''}</dt><dd>{shipping.price ? money(shipping.price) : 'Grátis'}</dd></div></dl>
        <div className="demo-total" aria-live="polite"><span>Total do pedido</span><strong key={total}>{money(total)}</strong></div>
        {step === 1 ? <button key="submit-customer" className="demo-pay" type="submit" form={`${id}-customer`}>Continuar para entrega <ArrowRight size={15}/></button> : <button key="next-step" type="button" className="demo-pay" onClick={() => go(step + 1)}>{['Continuar com este pedido', '', 'Revisar pedido', 'Experimentar pagamento'][step]} <ArrowRight size={15}/></button>}
        {step > 0 && <button className="demo-link" onClick={() => go(step - 1)}>Voltar uma etapa</button>}
      </>}
      {step === 4 && <div className="demo-pix"><span className="demo-qr-placeholder"><QrCode size={64}/></span><b>{money(total)}</b><p className="demo-help">Este símbolo representa o QR Code. Não é um código de pagamento. Em uma compra real, o cliente paga no banco e aguarda a confirmação.</p><button className="demo-secondary" onClick={copy}><Copy size={15}/> Copiar texto de exemplo</button><code>PIRAT-DEMONSTRACAO-SEM-VALOR-DE-PAGAMENTO</code><p className="demo-help" role="status">{copyMessage || 'Aguardando sua ação para continuar a demonstração.'}</p><button className="demo-pay" onClick={() => go(5)}>Simular pagamento aprovado <Check size={16}/></button><button className="demo-link" onClick={() => go(3)}>Cancelar simulação e revisar</button></div>}
      {step === 5 && <div className="demo-success" role="status"><SuccessBurst/><span className="demo-success-icon"><CheckCheck size={31}/></span><p>Experiência concluída.</p><span>Pedido de {money(total)} confirmado na demonstração. Nenhuma cobrança ou e-mail foi enviado.</span><button onClick={() => go(0)}><RotateCcw size={13}/> Experimentar de novo</button><button onClick={reset}>Limpar escolhas e recomeçar</button></div>}
      <div className="demo-caption"><ShieldCheck size={12}/> Demonstração interativa. Nenhuma cobrança real.</div>
    </div>
    <div className="demo-customize"><span><SlidersHorizontal size={13}/> Experimente outra cor</span><div role="group" aria-label="Cor da demonstração">{colors.map(([value, label]) => <button key={value} className={`color-swatch ${value}`} aria-label={label} aria-pressed={color === value} onClick={() => setColor(value)}>{color === value && <Check size={12}/>}</button>)}</div></div>
  </div>;
}

export function FeatureVisual({ active }) {
  const [brand, setBrand] = useState('Sua marca');
  const [color, setColor] = useState('red');
  const [offer, setOffer] = useState(true);
  const [period, setPeriod] = useState('7');
  const [flow, setFlow] = useState(0);
  if (active === 'marca') return <div className="feature-sandbox"><span className="site-eyebrow">EXPERIMENTE O EDITOR</span><label>Nome da sua marca<input aria-label="Nome da sua marca" maxLength={24} value={brand} onChange={e => setBrand(e.target.value)}/></label><div className="sandbox-colors" role="group" aria-label="Paleta do editor">{colors.map(([value, label]) => <button key={value} className={`color-swatch ${value}`} aria-label={`Editor ${label}`} aria-pressed={color === value} onClick={() => setColor(value)}>{color === value && <Check size={16}/>}</button>)}</div><div className={`brand-preview ${color}`}><ShoppingBag size={30}/><strong>{brand.trim() || 'Sua marca'}</strong><span>Seu próximo pedido começa aqui.</span><a href="#demonstracao" className="brand-preview-cta">Experimentar o pagamento <ArrowRight size={15}/></a></div><p>O nome e a cor atualizam a prévia na hora. No painel, você configura a identidade do seu checkout.</p></div>;
  if (active === 'ofertas') return <div className="feature-sandbox"><span className="site-eyebrow">VEJA O EFEITO NO PEDIDO</span><h4>Um complemento, uma escolha.</h4><label className="sandbox-check"><input aria-label="Incluir ecobag de R$ 29,00" type="checkbox" checked={offer} onChange={e => setOffer(e.target.checked)}/> Incluir ecobag de R$ 29,00</label><dl className="sandbox-metrics"><div><dt>Produto principal</dt><dd>{money(149)}</dd></div><div><dt>Complemento</dt><dd>{money(offer ? 29 : 0)}</dd></div><div><dt>Total ilustrativo</dt><dd aria-live="polite">{money(149 + (offer ? 29 : 0))}</dd></div></dl><p>Order bump é uma oferta opcional dentro do checkout. O comprador escolhe se quer adicioná-la.</p><a href="#demonstracao" className="site-text-link lavender">Testar também um cupom <ArrowRight size={15}/></a></div>;
  if (active === 'gestao') {
    const sample = period === '7' ? { paid: 12, pending: 3, values: [28, 40, 35, 65, 48, 83, 70] } : { paid: 48, pending: 9, values: [40, 60, 50, 90] };
    return <div className="feature-sandbox"><span className="site-eyebrow">PAINEL COM DADOS FICTÍCIOS</span><label>Período do exemplo<select value={period} onChange={e => setPeriod(e.target.value)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select></label><dl className="sandbox-metrics" aria-live="polite"><div><dt>Pedidos pagos</dt><dd>{sample.paid}</dd></div><div><dt>Aguardando pagamento</dt><dd>{sample.pending}</dd></div></dl><MiniMovingChart values={sample.values}/><p>Mude o período para explorar o resumo. No painel real, os indicadores refletem os pedidos e o status recebido do gateway.</p></div>;
  }
  return <div className="feature-sandbox"><span className="site-eyebrow">EXPLORE A JORNADA</span><div className="sandbox-flow" role="group" aria-label="Conhecer as etapas">{['Identificação', 'Entrega', 'Pagamento'].map((label, index) => <button key={label} aria-pressed={flow === index} onClick={() => setFlow(index)}><span>0{index + 1}</span>{label}<ArrowRight size={16}/></button>)}</div><p aria-live="polite">{['O cliente informa seus dados para identificar o pedido. Campos claros ajudam a entender o que preencher.', 'O cliente escolhe entre as opções disponíveis para o endereço. Preço e prazo aparecem antes do pagamento.', 'O cliente revisa o total e recebe o Pix. O status do pedido acompanha a confirmação do pagamento.'][flow]}</p><a href="#demonstracao" className="site-text-link lavender">Fazer uma compra de exemplo <ArrowRight size={15}/></a></div>;
}

const guideSteps = [
  { title: 'Prepare sua loja', subtitle: 'Conta e catálogo', text: 'Comece pela base da operação. Você pode cadastrar produtos na Pirat ou conectar um catálogo Shopify.', checks: ['Criar a conta e confirmar o e-mail', 'Preencher os dados da loja', 'Cadastrar os produtos ou conectar a Shopify'] },
  { title: 'Faça ser sua', subtitle: 'Marca e ofertas', text: 'Monte a experiência que o cliente vai encontrar. Confira textos, imagens e o resumo do pedido no celular.', checks: ['Personalizar a aparência do checkout', 'Definir ofertas e regras dos cupons', 'Configurar e verificar o domínio, se usar um próprio'] },
  { title: 'Conecte o pagamento', subtitle: 'Gateway Pix', text: 'Escolha um gateway disponível no painel. Consulte suas condições e conclua a configuração da conta de recebimento.', checks: ['Escolher e configurar o gateway', 'Conferir as condições e tarifas', 'Validar a criação do Pix e o retorno do status'] },
  { title: 'Publique e acompanhe', subtitle: 'Revisão e lançamento', text: 'Antes de divulgar, percorra uma compra no seu checkout real. A demonstração deste site não substitui essa validação.', checks: ['Revisar dados, entrega e total em desktop e celular', 'Validar o fluxo de pagamento no ambiente adequado', 'Compartilhar o link e acompanhar os pedidos'] },
];

export function SetupGuide({ signup }) {
  const [active, setActive] = useState(0);
  const [checked, setChecked] = useState([]);
  const step = guideSteps[active];
  return <div className="setup-guide"><p className="guide-intro">Clique em cada etapa para ver o que preparar. Use a lista como um roteiro pessoal nesta visita.</p><div className="guide-tabs" role="group" aria-label="Etapas para começar">{guideSteps.map((item, index) => <button key={item.title} aria-pressed={index === active} aria-controls="guide-detail" onClick={() => setActive(index)}><b>0{index + 1}</b><strong>{item.title}</strong><span>{item.subtitle}</span></button>)}</div><div key={active} className="guide-detail" id="guide-detail"><div><span className="site-eyebrow">ETAPA {active + 1} DE 4</span><h3>{step.title}</h3><p>{step.text}</p></div><fieldset><legend>O que conferir nesta etapa</legend>{step.checks.map((check, index) => { const key = `${active}-${index}`; return <label key={key}><input aria-label={check} type="checkbox" checked={checked.includes(key)} onChange={e => setChecked(e.target.checked ? [...checked, key] : checked.filter(item => item !== key))}/>{check}</label>; })}</fieldset></div><div className="guide-bottom"><div><span role="status">{checked.length} de 12 itens marcados</span><progress value={checked.length} max={12} aria-label="Progresso do roteiro"/><small>Lista de planejamento. Não configura sua conta e é reiniciada ao recarregar.</small></div><div className="guide-actions"><button className="site-outline-button" onClick={() => setChecked([])} disabled={!checked.length}>Limpar lista</button>{active < 3 ? <button className="site-button" onClick={() => setActive(active + 1)}>Próxima etapa <ArrowRight size={16}/></button> : <a className="site-button" href={signup}>Ir para o cadastro <ArrowRight size={16}/></a>}</div></div></div>;
}

export const integrations = [
  { name: 'Shopify', detail: 'Catálogo e pedidos', description: 'Conecte sua loja Shopify para integrar o catálogo e a sincronização dos pedidos.', steps: ['Tenha acesso à administração da loja Shopify.', 'Inicie a conexão da loja no painel Pirat.', 'Confira os produtos importados e valide a sincronização dos pedidos.'] },
  { name: 'UTMify', detail: 'Acompanhamento', description: 'Relacione os pedidos ao acompanhamento de campanhas da sua operação.', steps: ['Tenha uma conta e os dados de integração da UTMify.', 'Configure a integração no painel da sua loja.', 'Valide o recebimento de um evento e os dados da campanha.'] },
  { name: 'Meta', detail: 'Eventos de conversão', description: 'Configure o acompanhamento de eventos para entender a jornada das suas campanhas.', steps: ['Separe os dados de configuração da sua conta Meta.', 'Preencha as opções disponíveis no painel Pirat.', 'Confira os eventos na ferramenta de diagnóstico da Meta.'] },
  { name: 'Roas · WestPay', detail: 'Pagamentos Pix', description: 'Escolha um gateway disponível para gerar o Pix e acompanhar o retorno do pagamento.', steps: ['Tenha uma conta aprovada no gateway escolhido.', 'Consulte tarifas e configure a conexão no painel.', 'Valide a geração do Pix e a atualização do pedido.'] },
  { name: 'Webhooks', detail: 'Sua operação', description: 'Envie os eventos disponíveis para um sistema da sua operação por meio de um endereço de recebimento.', steps: ['Prepare o endereço de recebimento no seu sistema.', 'Configure os eventos e a autenticação disponíveis no painel.', 'Teste o recebimento e o tratamento de eventos repetidos.'] },
];

export function IntegrationDetail({ index, signup }) {
  const item = integrations[index];
  return <div className="integration-detail" id="integration-detail" aria-live="polite"><span className="site-eyebrow">COMO CONECTAR</span><h3>{item.name}</h3><p>{item.description}</p><ol>{item.steps.map(step => <li key={step}>{step}</li>)}</ol><a className="site-text-link lavender" href={signup}>Configurar no painel <ArrowRight size={16}/></a><small>As etapas exatas e a disponibilidade dependem da integração e da sua conta. Nenhuma conexão é feita por esta demonstração.</small></div>;
}

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function SearchableFaq({ faqs }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState([faqs[0][0]]);
  const matches = faqs.filter(item => normalize(item.join(' ')).includes(normalize(query.trim())));
  return <div className="faq-list"><label className="faq-search" htmlFor={id}>Busque sua dúvida<input aria-label="Busque sua dúvida" id={id} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex.: Pix, Shopify, domínio..."/></label><div className="faq-tools"><span role="status">{matches.length} {matches.length === 1 ? 'resposta encontrada' : 'respostas encontradas'}</span><button onClick={() => setOpened(matches.every(([question]) => opened.includes(question)) ? [] : matches.map(([question]) => question))} disabled={!matches.length}>{matches.length > 0 && matches.every(([question]) => opened.includes(question)) ? 'Recolher respostas' : 'Expandir respostas'}</button></div>{matches.map(([question, answer]) => <details key={question} open={opened.includes(question)}><summary onClick={event => { event.preventDefault(); setOpened(opened.includes(question) ? opened.filter(item => item !== question) : [...opened, question]); }}>{question}<Plus size={18}/></summary><p>{answer}</p></details>)}{!matches.length && <div className="faq-empty"><p>Nenhuma resposta para “{query}”. Tente buscar por pagamento, loja ou conta.</p><button className="site-outline-button" onClick={() => setQuery('')}>Limpar busca</button></div>}</div>;
}
