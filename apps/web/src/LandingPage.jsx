import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Check, CheckCheck, ChevronRight, CircleCheck, Code2, Globe2, Layers3, LockKeyhole, Menu, MousePointer2, Package, Palette, Plus, QrCode, RotateCcw, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Store, Truck, Users, X, Zap } from 'lucide-react';
import './landing.css';
import './pirat-site.css';
import './color-surfaces.css';
import { MotionScene } from './SiteMotion';
import { PiratHero, CheckoutJourney, MerchantLife } from './PiratExperience';
import { TemplateShowcase, TestimonialShowcase } from './SiteShowcase';
import { AnalyticsGlobe } from './AnalyticsGlobe';
import { marketingAccountUrl } from './site-route';

const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const signup = marketingAccountUrl(window.location.hostname, 'cadastro');
const login = marketingAccountUrl(window.location.hostname, 'login');
const features = [
  { id: 'checkout', icon: ShoppingBag, name: 'Checkout', title: 'Uma boa compra termina com uma boa experiência.', text: 'Organize identificação, entrega e pagamento em uma jornada clara. Seu cliente encontra o que precisa para concluir o pedido, no computador ou no celular.', points: ['Pagamento Pix com QR Code e código copia e cola', 'Produtos físicos e digitais no mesmo ecossistema', 'Resumo do pedido e acompanhamento do pagamento'] },
  { id: 'marca', icon: Palette, name: 'Sua marca', title: 'O checkout é seu. A identidade também.', text: 'Ajuste cores, elementos e conteúdo no editor visual. Construa uma experiência consistente com sua loja, do primeiro contato à hora de pagar.', points: ['Editor para personalizar a apresentação', 'Domínio próprio para o checkout', 'Configurações de aparência por checkout'] },
  { id: 'ofertas', icon: Sparkles, name: 'Ofertas', title: 'Dê um próximo passo a cada oportunidade.', text: 'Apresente um complemento relevante com order bumps, crie cupons para suas campanhas e configure o desconto Pix conforme a estratégia da sua operação.', points: ['Ofertas complementares no checkout', 'Cupons com regras de uso', 'Desconto Pix com percentual e limite configuráveis'] },
  { id: 'gestao', icon: BarChart3, name: 'Gestão', title: 'Menos abas. Mais visão da sua operação.', text: 'Acompanhe pedidos, pagamentos e resultados em um painel. Encontre o contexto de cada venda e mantenha sua equipe trabalhando com a mesma informação.', points: ['Pedidos e status de pagamento centralizados', 'Análises de vendas, cupons e canais', 'Lojas e acessos organizados por função'] },
];
const faqs = [
  ['O que é a Pirat Checkout?', 'É uma plataforma para criar e gerenciar checkouts com pagamento Pix. Você reúne a experiência de compra, a personalização da marca, as ofertas e o acompanhamento dos pedidos em uma operação conectada.'],
  ['Preciso usar Shopify?', 'Não. A Pirat tem catálogo e checkouts próprios. Se sua operação usa Shopify, você também pode conectar a loja para integrar o catálogo e a sincronização dos pedidos.'],
  ['Quais pagamentos posso receber?', 'O checkout recebe pagamentos Pix por gateways integrados, como Roas e WestPay. A disponibilidade e as condições dependem da conexão e do contrato com o gateway escolhido.'],
  ['Posso usar meu domínio e as cores da minha marca?', 'Sim. Você pode configurar um domínio próprio para o checkout e personalizar a experiência no editor. A ativação do domínio depende da configuração de DNS e da verificação dentro do painel.'],
  ['Como funcionam os planos e as tarifas?', 'As opções e condições vigentes ficam disponíveis na área de planos do painel. Consulte os limites e as tarifas da Pirat e do gateway antes de ativar sua operação.'],
  ['O que acontece depois de criar minha conta?', 'Você confirma seu e-mail, configura a loja, adiciona os produtos ou conecta a Shopify e escolhe o gateway Pix. Depois, personalize o checkout e valide a jornada antes de compartilhar seu link.'],
];

function Brand({ footer = false }) {
  return <a href="#inicio" className={`solid-site-brand ${footer ? 'footer-brand' : ''}`} aria-label="Pirat Checkout, início"><img src="/brand/pirat-logo-on-dark.png" width="100" height="90" alt="Pirat"/></a>;
}

function ProductArt({ small = false }) {
  return <div className={`site-product-art ${small ? 'small' : ''}`} aria-hidden="true"><div className="product-ring"/><ShoppingBag strokeWidth={1.15}/><span>essentials.</span></div>;
}

function CheckoutDemo({ compact = false }) {
  const [color, setColor] = useState('red');
  const [bump, setBump] = useState(false);
  const [step, setStep] = useState(0);
  const total = 149 + (bump ? 29 : 0);
  return <div className={`site-demo ${color} ${compact ? 'compact' : ''}`}>
    <div className="demo-toolbar"><span><i/><i/><i/></span><span><LockKeyhole size={11}/> sua-marca.com/checkout</span><ShieldCheck size={13}/></div>
    <div className="demo-content">
      <div className="demo-brand"><span>essentials<span className="accent-dot">.</span></span><span><LockKeyhole size={11}/> Compra segura</span></div>
      <div className="demo-progress"><span className="complete"><Check size={10}/> Identificação</span><i/><span className="complete"><Check size={10}/> Entrega</span><i/><span><b>3</b> Pagamento</span></div>
      {step === 0 ? <>
        <div className="demo-product"><ProductArt small/><div><strong>Everyday Kit</strong><span>Uma escolha para todos os dias.</span><small>Cor: areia · Quantidade: 1</small></div><b>{money(149)}</b></div>
        <div className="demo-method"><div><QrCode size={21}/><span><strong>Pague com Pix</strong><small>Simples, direto, do seu jeito.</small></span></div><span className="demo-selected"><Check size={10}/></span></div>
        <label className="demo-bump"><input type="checkbox" aria-label="Adicionar ecobag por 29 reais" checked={bump} onChange={e => setBump(e.target.checked)}/><span><strong>Complete seu kit</strong><small>Adicione uma ecobag por {money(29)}</small></span><ShoppingBag size={21}/></label>
        <div className="demo-total"><span>Total do pedido</span><strong>{money(total)}</strong></div>
        <button className="demo-pay" onClick={() => setStep(1)}>Experimentar pagamento <ArrowRight size={15}/></button>
      </> : <div className="demo-success" role="status"><span className="demo-success-icon"><CheckCheck size={31}/></span><p>É assim que uma boa<br/>experiência termina.</p><span>Você percorreu um pedido de {money(total)}.</span><button onClick={() => setStep(0)}><RotateCcw size={13}/> Experimentar de novo</button></div>}
      <div className="demo-caption"><ShieldCheck size={12}/> Ambiente interativo · Sem cobranças.</div>
    </div>
    <div className="demo-customize"><span><SlidersHorizontal size={13}/> Deixe com a sua cara</span><div role="group" aria-label="Cor do checkout">{[['red', 'Vermelho'], ['blue', 'Azul'], ['green', 'Verde']].map(([value, label]) => <button key={value} className={`color-swatch ${value}`} aria-label={label} aria-pressed={color === value} onClick={() => setColor(value)}>{color === value && <Check size={12}/>}</button>)}</div></div>
  </div>;
}

function FeatureVisual({ active }) {
  if (active === 'marca') return <div className="feature-visual brand-visual"><div className="mini-editor"><div><Palette size={17}/><strong>Identidade da loja</strong></div><span>Paleta da marca</span><div className="editor-swatches"><i/><i/><i/><i/></div><span>Seu domínio</span><p><LockKeyhole size={13}/> checkout.suamarca.com <CircleCheck size={15}/></p><div className="editor-save"><Check size={13}/> Uma experiência com a sua identidade</div></div><div className="brand-orbit"><img src="/brand/pirat-mascot.png" alt="" width="64" height="64"/></div></div>;
  if (active === 'ofertas') return <div className="feature-visual offers-visual"><div className="offer-ticket"><span><Sparkles size={16}/> UMA OFERTA QUE FAZ SENTIDO</span><ProductArt small/><h4>Uma combinação melhor.</h4><p>Seu produto + o complemento ideal.</p><div><span>Oferta complementar</span><strong>Order bump <Plus size={14}/></strong></div></div><div className="offer-coupon"><span>CUPOM</span><strong>BEMVINDO</strong><div className="ticket-dots"/></div></div>;
  if (active === 'gestao') return <div className="feature-visual analytics-visual"><div className="mini-analytics"><div><span>Visão geral</span><span>Vendas, pedidos e canais</span></div><strong>Sua operação,<br/>em perspectiva.</strong><div className="analytics-bars" aria-hidden="true">{[24, 36, 31, 49, 43, 64, 57, 74, 70, 91, 84, 100].map((height, i) => <i key={i} style={{ '--bar-height': `${height}%` }}/>)}</div><div className="analytics-legend"><span><i/> Vendas</span><span>Pedidos · Canais · Cupons</span></div></div></div>;
  return <div className="feature-visual flow-visual"><div className="flow-line"/>{[[UserIcon, 'Identificação', 'Dados do cliente'], [Truck, 'Entrega', 'Opções para cada pedido'], [QrCode, 'Pagamento', 'Pix com status acompanhado']].map(([Icon, title, text], i) => <div className="flow-node" key={title}><span><Icon size={21}/></span><div><strong>{title}</strong><small>{text}</small></div><b>{i < 2 ? <Check size={16}/> : <ArrowRight size={16}/>}</b></div>)}<small className="flow-caption">Cada etapa tem seu lugar.</small></div>;
}
const UserIcon = Users;

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('checkout');
  const feature = features.find(item => item.id === active);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Pirat Checkout — Sua marca. Seu checkout. Sua próxima venda.';
    document.body.classList.add('solid-marketing-body');
    const escape = event => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', escape);
    return () => { document.title = previous; document.body.classList.remove('solid-marketing-body'); window.removeEventListener('keydown', escape); };
  }, []);
  return <MotionScene><div className="solid-site" id="inicio">
    <a className="site-skip" href="#conteudo">Pular para o conteúdo</a>
    <header className="site-header"><div className="site-container header-inner"><Brand/><nav aria-label="Navegação principal" className={menuOpen ? 'site-nav open' : 'site-nav'} id="site-navigation">{[['Recursos', '#recursos'], ['Como funciona', '#como-funciona'], ['Integrações', '#integracoes'], ['Dúvidas', '#duvidas'], ['Documentação', 'https://docs.apirat.io/']].map(([label, href]) => <a href={href} key={href} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav><div className="header-actions"><a href={login} className="site-login">Entrar <ArrowUpRight size={14}/></a><a href={signup} className="site-button small">Começar agora <ArrowRight size={14}/></a><button className="site-menu-toggle" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22}/> : <Menu size={22}/>}</button></div></div></header>
    <main id="conteudo">
      <PiratHero signup={signup}/>
      <section className="integration-strip" aria-label="Ecossistema de integrações"><div className="site-container"><p>Conectado às ferramentas<br/><strong>que movem sua operação.</strong></p><div><span><ShoppingBag/> Shopify</span><span className="wordmark-meta">∞ <b>Meta</b></span><span className="wordmark-utm"><BarChart3/> utmify</span><span className="wordmark-roas">roas<span>pay</span></span><span className="wordmark-west"><Zap/> westpay</span></div></div></section>
      <CheckoutJourney/>
      <TemplateShowcase signup={signup}/>
      <section className="pirat-demo-section site-container" id="demonstracao" aria-labelledby="demo-title"><div className="section-heading"><span className="site-eyebrow">CHEGA DE SÓ OLHAR.</span><h2 id="demo-title">Pode clicar.<br/><span>O checkout é seu.</span></h2><p>Troque a cor, adicione uma oferta e percorra cada etapa da jornada de compra.</p><a href="#jornada" className="site-text-link lavender">Rever a apresentação <ArrowRight size={17}/></a></div><div className="hero-stage"><CheckoutDemo/><span className="try-hint"><MousePointer2 size={15}/> Experimente do seu jeito.</span></div></section>
      <MerchantLife/>
      <TestimonialShowcase/>
      <AnalyticsGlobe signup={signup}/>


      <section className="site-section site-container" id="recursos"><div className="section-heading"><span className="site-eyebrow">PENSADO PARA A SUA OPERAÇÃO</span><h2>Uma experiência completa.<br/><span>Do seu jeito.</span></h2><p>O que seu cliente vê precisa ser simples.<br/>O que você gerencia precisa estar conectado.</p></div>
        <div className="feature-tabs" role="group" aria-label="Explorar recursos">{features.map(({ id, name, icon: Icon }) => <button key={id} aria-pressed={active === id} aria-controls="feature-detail" onClick={() => setActive(id)} className={active === id ? 'active' : ''}><Icon size={18}/>{name}<ChevronRight size={14}/></button>)}</div>
        <div className="feature-panel" id="feature-detail"><div className="feature-copy" key={feature.id}><span className="feature-number">0{features.findIndex(item => item.id === active) + 1} / RECURSOS PIRAT</span><h3>{feature.title}</h3><p>{feature.text}</p><ul>{feature.points.map(point => <li key={point}><CircleCheck size={17}/>{point}</li>)}</ul><a href={signup} className="site-text-link lavender">Conhecer a Pirat <ArrowUpRight size={17}/></a></div><FeatureVisual active={active}/></div>
      </section>

      <section className="site-section foundation-section"><div className="site-container"><div className="section-heading left"><span className="site-eyebrow">BONITO É BOM. FUNCIONAR É ESSENCIAL.</span><h2>Bonito para quem compra.<br/><span>Completo para quem vende.</span></h2></div><div className="foundation-grid"><article className="foundation-card domain-card" data-card-tone="ivory"><span className="feature-icon"><Globe2 size={23}/></span><h3>Sua marca, de ponta a ponta.</h3><p>Cores, conteúdo e domínio próprio. Uma experiência que continua a história da sua loja.</p><div className="domain-address"><LockKeyhole size={14}/><span>checkout.<b>suamarca</b>.com</span><Check size={16}/></div><div className="domain-echo" aria-hidden="true">suamarca<span>®</span></div></article><article className="foundation-card" data-card-tone="gold"><span className="feature-icon"><Package size={23}/></span><h3>Seu catálogo encontra seu fluxo.</h3><p>Venda produtos físicos e digitais, configure a entrega e organize as ofertas de cada checkout.</p><div className="catalog-items"><span><ShoppingBag size={19}/> Produtos físicos <ArrowUpRight size={13}/></span><span><Layers3 size={19}/> Produtos digitais <ArrowUpRight size={13}/></span></div></article><article className="foundation-card"><span className="feature-icon"><ShieldCheck size={23}/></span><h3>Mais contexto. Mais controle.</h3><p>Acompanhe pagamentos e organize os acessos da equipe por função, com informações centralizadas.</p><div className="access-row"><span>LM</span><div><b>Sua equipe conectada</b><small>Acessos por função</small></div><LockKeyhole size={17}/></div></article></div></div></section>

      <section className="site-section site-container how-section" id="como-funciona"><div className="section-heading"><span className="site-eyebrow">DA IDEIA À PRIMEIRA COMPRA</span><h2>Seu próximo capítulo<br/><span>começa em poucos passos.</span></h2></div><div className="steps-grid">{[[Store, '01', 'Prepare sua loja', 'Crie sua conta, cadastre seus produtos ou conecte o catálogo da Shopify.'], [Palette, '02', 'Faça ser sua', 'Personalize o checkout, organize as ofertas e configure seu domínio.'], [QrCode, '03', 'Conecte o pagamento', 'Ative seu gateway Pix e confira as condições da sua operação.'], [ArrowUpRight, '04', 'Publique e acompanhe', 'Valide a jornada, compartilhe o link e acompanhe os pedidos no painel.']].map(([Icon, number, title, text]) => <article key={number}><div className="step-top"><span><Icon size={22}/></span><b>{number}</b></div><h3>{title}</h3><p>{text}</p></article>)}</div><a href={signup} className="site-button">Dar o primeiro passo <ArrowRight size={17}/></a></section>

      <section className="site-section integrations-section" id="integracoes"><div className="site-container integrations-layout"><div><span className="site-eyebrow">CADA FERRAMENTA NO SEU LUGAR</span><h2>A Pirat no centro.<br/><span>Sua operação conectada.</span></h2><p>Conecte catálogo, pagamentos e acompanhamento de campanhas. Continue usando as ferramentas que fazem sentido para o seu negócio.</p><a href={signup} className="site-text-link lavender">Explorar as integrações <ArrowUpRight size={17}/></a><small>A configuração e a disponibilidade dependem de cada integração.</small></div><div className="integration-network"><div className="network-lines" aria-hidden="true"/><div className="network-center"><img src="/brand/pirat-mascot.png" alt="Pirat" width="60" height="60"/></div>{[[ShoppingBag, 'Shopify', 'Catálogo e pedidos'], [BarChart3, 'UTMify', 'Acompanhamento'], [Users, 'Meta', 'Eventos de conversão'], [Zap, 'Roas · WestPay', 'Pagamentos Pix'], [Code2, 'Webhooks', 'Sua operação']].map(([Icon, name, detail], index) => <div className={`network-node node-${index}`} key={name}><Icon size={22}/><div><strong>{name}</strong><small>{detail}</small></div></div>)}</div></div></section>

      <section className="site-section site-container faq-section" id="duvidas"><div><span className="site-eyebrow">SEM PAPO DE PAPAGAIO.</span><h2>Boas perguntas.<br/><span>Respostas diretas.</span></h2><p>Entenda como a Pirat se encaixa<br/>na sua operação.</p><div className="faq-decoration" aria-hidden="true"><span>?</span><i/><i/></div></div><div className="faq-list">{faqs.map(([question, answer], index) => <details key={question} name="solid-faq" open={index === 0 ? true : undefined}><summary>{question}<Plus size={18}/></summary><p>{answer}</p></details>)}</div></section>

      <section className="site-container final-section"><div className="final-cta"><div className="final-lines" aria-hidden="true"/><img className="pirat-cta-mascot" src="/brand/pirat-mascot.png" width="100" height="100" alt="" loading="lazy"/><span className="site-eyebrow">BORA TIRAR ESSA LOJA DO CAIS?</span><h2>Sua marca no comando.<br/>A Pirat vai junto.</h2><p>Crie uma experiência de compra à altura do que você vende.</p><a className="site-button light" href={signup}>Bora de Pirat <ArrowUpRight size={19}/></a><span className="final-note">Crie sua conta e conheça os recursos e planos disponíveis.</span></div></section>
    </main>
    <footer className="site-footer site-container"><div className="footer-top"><div><Brand footer/><p>Sua marca no comando.<br/>Sua próxima venda à vista.</p></div><div className="footer-links"><div><strong>Plataforma</strong><a href="#recursos">Recursos</a><a href="#como-funciona">Como funciona</a><a href="#integracoes">Integrações</a></div><div><strong>Comece aqui</strong><a href={signup}>Criar conta</a><a href={login}>Acessar painel</a><a href="#duvidas">Perguntas frequentes</a><a href="https://docs.apirat.io/">Documentação</a></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Pirat Checkout. Todos os direitos reservados.</span><a href="#inicio">Feito para seguir em frente. <ArrowUpRight size={14}/></a></div></footer>
  </div></MotionScene>;
}
