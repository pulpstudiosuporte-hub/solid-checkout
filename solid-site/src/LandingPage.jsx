import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight, CircleCheck, Code2, Globe2, Layers3, LockKeyhole, Menu, MousePointer2, Package, Palette, ShieldCheck, ShoppingBag, Sparkles, Users, X, Zap } from 'lucide-react';
import './landing.css';
import './interactions.css';
import { CheckoutDemo, FeatureVisual, SetupGuide, integrations, IntegrationDetail, SearchableFaq } from './SiteInteractions';
import { MotionScene, LiveAnalytics } from './SiteMotion';
import { marketingAccountUrl } from './site-route';
import './section-lights.css';
import './pirat-site.css';
import './color-surfaces.css';
import { PiratHero, CheckoutJourney, MerchantLife } from './PiratExperience';
import { TemplateShowcase, TestimonialShowcase } from './SiteShowcase';

const signup = marketingAccountUrl('cadastro');
const login = marketingAccountUrl('login');
const features = [
  { id: 'checkout', icon: ShoppingBag, name: 'Checkout', title: 'Uma boa compra termina com uma boa experiência.', text: 'Organize identificação, entrega e pagamento em uma jornada clara. Seu cliente encontra o que precisa para concluir o pedido, no computador ou no celular.', points: ['Pagamento Pix com QR Code e código copia e cola', 'Produtos físicos e digitais no mesmo ecossistema', 'Resumo do pedido e acompanhamento do pagamento'] },
  { id: 'marca', icon: Palette, name: 'Sua marca', title: 'O checkout é seu. A identidade também.', text: 'Ajuste cores, elementos e conteúdo no editor visual. Construa uma experiência consistente com sua loja, do primeiro contato à hora de pagar.', points: ['Editor para personalizar a apresentação', 'Domínio próprio para o checkout', 'Configurações de aparência por checkout'] },
  { id: 'ofertas', icon: Sparkles, name: 'Ofertas', title: 'Dê um próximo passo a cada oportunidade.', text: 'Apresente um complemento relevante com order bumps, crie cupons para suas campanhas e configure o desconto Pix conforme a estratégia da sua operação.', points: ['Ofertas complementares no checkout', 'Cupons com regras de uso', 'Desconto Pix com percentual e limite configuráveis'] },
  { id: 'gestao', icon: BarChart3, name: 'Gestão', title: 'Menos abas. Mais visão da sua operação.', text: 'Acompanhe pedidos, pagamentos e resultados em um painel. Encontre o contexto de cada venda e mantenha sua equipe trabalhando com a mesma informação.', points: ['Pedidos e status de pagamento centralizados', 'Análises de vendas, cupons e canais', 'Lojas e acessos organizados por função'] },
];
const faqs = [
  ['A demonstração faz uma cobrança de verdade?', 'Não. O pedido, o frete, o desconto e o pagamento são exemplos locais. Você pode avançar e voltar nas etapas, editar o pedido, copiar um texto fictício e simular a aprovação. Nenhum Pix é gerado e nenhum dado é enviado.'],
  ['O que é order bump?', 'É um complemento opcional oferecido dentro do checkout. Na demonstração, marque a ecobag para ver o valor somado ao pedido. Desmarque para removê-la.'],
  ['Como testo o cupom e o frete?', 'Na demonstração, abra Tenho um cupom de desconto e aplique BEMVINDO: ele retira 10% do valor dos produtos. Na etapa Entrega, alterne entre o frete padrão grátis e o expresso de R$ 19,90. São condições fictícias para explorar a experiência.'],
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

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('checkout');
  const [integration, setIntegration] = useState(0);
  const feature = features.find(item => item.id === active);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Pirat Checkout — Sua marca. Seu checkout. Sua próxima venda.';
    document.body.classList.add('solid-marketing-body');
    const escape = event => { if (event.key === 'Escape') { setMenuOpen(false); if (document.activeElement?.closest('#site-navigation')) document.querySelector('.site-menu-toggle')?.focus(); } };
    window.addEventListener('keydown', escape);
    return () => { document.title = previous; document.body.classList.remove('solid-marketing-body'); window.removeEventListener('keydown', escape); };
  }, []);
  return <MotionScene><div className="solid-site" id="inicio">
    <a className="site-skip" href="#conteudo">Pular para o conteúdo</a>
    <header className="site-header"><div className="site-container header-inner"><Brand/><nav aria-label="Navegação principal" className={menuOpen ? 'site-nav open' : 'site-nav'} id="site-navigation">{[['Gráficos', '#em-movimento'], ['Recursos', '#recursos'], ['Como funciona', '#como-funciona'], ['Integrações', '#integracoes'], ['Dúvidas', '#duvidas'], ['Documentação', 'https://docs.apirat.io/']].map(([label, href]) => <a href={href} key={href} onClick={() => setMenuOpen(false)}>{label}</a>)}<a className="mobile-panel-link" href={login}>Acessar painel <ArrowUpRight size={14}/></a></nav><div className="header-actions"><a href={login} className="site-login">Entrar <ArrowUpRight size={14}/></a><a href={signup} className="site-button small">Começar agora <ArrowRight size={14}/></a><button className="site-menu-toggle" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22}/> : <Menu size={22}/>}</button></div></div></header>
    <main id="conteudo">
      <PiratHero signup={signup}/>
      <section className="integration-strip" aria-label="Ecossistema de integrações"><div className="site-container"><p>Conectado às ferramentas<br/><strong>que movem sua operação.</strong></p><div><span><ShoppingBag/> Shopify</span><span className="wordmark-meta">∞ <b>Meta</b></span><span className="wordmark-utm"><BarChart3/> utmify</span><span className="wordmark-roas">roas<span>pay</span></span><span className="wordmark-west"><Zap/> westpay</span></div></div></section>
      <CheckoutJourney/>
      <TemplateShowcase signup={signup}/>
      <section className="pirat-demo-section site-container" id="demonstracao" aria-labelledby="demo-title"><div className="section-heading"><span className="site-eyebrow">CHEGA DE SÓ OLHAR.</span><h2 id="demo-title">Pode clicar.<br/><span>O checkout é seu.</span></h2><p>Troque a cor, adicione uma oferta e experimente a jornada. Aqui é uma demonstração: você explora, sem gerar uma cobrança.</p><a href="#jornada" className="site-text-link lavender">Rever a apresentação <ArrowRight size={17}/></a></div><div className="hero-stage"><CheckoutDemo/><span className="try-hint"><MousePointer2 size={15}/> Explore a demonstração.</span></div></section>
      <MerchantLife/>
      <TestimonialShowcase/>


      <LiveAnalytics/>
      <section className="site-section site-container" id="recursos"><div className="section-heading"><span className="site-eyebrow">PENSADO PARA A SUA OPERAÇÃO</span><h2>Uma experiência completa.<br/><span>Do seu jeito.</span></h2><p>O que seu cliente vê precisa ser simples.<br/>O que você gerencia precisa estar conectado.</p></div>
        <div className="feature-tabs" role="group" aria-label="Explorar recursos">{features.map(({ id, name, icon: Icon }) => <button key={id} aria-pressed={active === id} aria-controls="feature-detail" onClick={() => setActive(id)} className={active === id ? 'active' : ''}><Icon size={18}/>{name}<ChevronRight size={14}/></button>)}</div>
        <div className="feature-panel" id="feature-detail"><div className="feature-copy" key={feature.id}><span className="feature-number">0{features.findIndex(item => item.id === active) + 1} / RECURSOS PIRAT</span><h3>{feature.title}</h3><p>{feature.text}</p><ul>{feature.points.map(point => <li key={point}><CircleCheck size={17}/>{point}</li>)}</ul><a href="#demonstracao" className="site-text-link lavender">Experimentar o checkout <ArrowRight size={17}/></a></div><FeatureVisual active={active}/></div>
      </section>

      <section className="site-section foundation-section"><div className="site-container"><div className="section-heading left"><span className="site-eyebrow">BONITO É BOM. FUNCIONAR É ESSENCIAL.</span><h2>Bonito para quem compra.<br/><span>Completo para quem vende.</span></h2></div><div className="foundation-grid"><article className="foundation-card domain-card" data-card-tone="ivory"><span className="feature-icon"><Globe2 size={23}/></span><h3>Sua marca, de ponta a ponta.</h3><p>Cores, conteúdo e domínio próprio. Uma experiência que continua a história da sua loja.</p><div className="domain-address"><LockKeyhole size={14}/><span>checkout.<b>suamarca</b>.com</span><Check size={16}/></div><details className="foundation-help"><summary>Como usar meu domínio?</summary><p>Adicione o domínio no painel, configure os registros DNS indicados e aguarde a verificação. Esta prévia não registra nem ativa um domínio.</p></details><div className="domain-echo" aria-hidden="true">suamarca<span>®</span></div></article><article className="foundation-card" data-card-tone="gold"><span className="feature-icon"><Package size={23}/></span><h3>Seu catálogo encontra seu fluxo.</h3><p>Venda produtos físicos e digitais, configure a entrega e organize as ofertas de cada checkout.</p><div className="catalog-items"><details className="foundation-help"><summary><ShoppingBag size={19}/> Produtos físicos</summary><p>Organize preço, estoque e entrega. Confira as opções de frete disponíveis para cada checkout antes de publicar.</p></details><details className="foundation-help"><summary><Layers3 size={19}/> Produtos digitais</summary><p>Cadastre a oferta digital e explique como o comprador receberá o conteúdo. Confira a configuração de entrega do produto no painel.</p></details></div></article><article className="foundation-card"><span className="feature-icon"><ShieldCheck size={23}/></span><h3>Mais contexto. Mais controle.</h3><p>Acompanhe pagamentos e organize os acessos da equipe por função, com informações centralizadas.</p><details className="foundation-help"><summary>Entender os acessos da equipe</summary><p>Distribua os acessos pelas funções disponíveis no painel. Revise as permissões de cada pessoa de acordo com o trabalho que ela precisa realizar.</p></details><div className="access-row"><span>LM</span><div><b>Sua equipe conectada</b><small>Acessos por função</small></div><LockKeyhole size={17}/></div></article></div></div></section>

      <section className="site-section site-container how-section" id="como-funciona"><div className="section-heading"><span className="site-eyebrow">DA IDEIA À PRIMEIRA COMPRA</span><h2>Seu próximo capítulo<br/><span>começa em poucos passos.</span></h2></div><SetupGuide signup={signup}/></section>

      <section className="site-section integrations-section" id="integracoes"><div className="site-container integrations-layout"><div><span className="site-eyebrow">CADA FERRAMENTA NO SEU LUGAR</span><h2>A Pirat no centro.<br/><span>Sua operação conectada.</span></h2><p>Conecte catálogo, pagamentos e acompanhamento de campanhas. Continue usando as ferramentas que fazem sentido para o seu negócio.</p><p className="integration-instruction">Selecione uma ferramenta ao lado para entender o que ela conecta e como preparar a configuração.</p><small>A configuração e a disponibilidade dependem de cada integração.</small></div><div className="integration-network"><div className="network-lines" aria-hidden="true"/><div className="network-center"><img src="/brand/pirat-mascot.png" alt="Pirat" width="60" height="60"/></div>{integrations.map(({ name, detail }, index) => { const Icon = [ShoppingBag, BarChart3, Users, Zap, Code2][index]; return <button type="button" aria-pressed={integration === index} aria-controls="integration-detail" className={`network-node node-${index}`} key={name} onClick={() => setIntegration(index)}><Icon size={22}/><span><strong>{name}</strong><small>{detail}</small></span></button>; })}</div><IntegrationDetail key={integration} index={integration} signup={signup}/></div></section>

      <section className="site-section site-container faq-section" id="duvidas"><div><span className="site-eyebrow">SEM PAPO DE PAPAGAIO.</span><h2>Boas perguntas.<br/><span>Respostas diretas.</span></h2><p>Entenda como a Pirat se encaixa<br/>na sua operação.</p><div className="faq-decoration" aria-hidden="true"><span>?</span><i/><i/></div></div><SearchableFaq faqs={faqs}/></section>

      <section className="site-container final-section"><div className="final-cta"><div className="final-lines" aria-hidden="true"/><img className="pirat-cta-mascot" src="/brand/pirat-mascot.png" width="100" height="100" alt="" loading="lazy"/><span className="site-eyebrow">BORA TIRAR ESSA LOJA DO CAIS?</span><h2>Sua marca no comando.<br/>A Pirat vai junto.</h2><p>Crie uma experiência de compra à altura do que você vende.</p><a className="site-button light" href={signup}>Bora de Pirat <ArrowUpRight size={19}/></a><span className="final-note">Crie sua conta e conheça os recursos e planos disponíveis.</span></div></section>
    </main>
    <footer className="site-footer site-container"><div className="footer-top"><div><Brand footer/><p>Sua marca no comando.<br/>Sua próxima venda à vista.</p></div><div className="footer-links"><div><strong>Plataforma</strong><a href="#recursos">Recursos</a><a href="#como-funciona">Como funciona</a><a href="#integracoes">Integrações</a></div><div><strong>Comece aqui</strong><a href={signup}>Criar conta</a><a href={login}>Acessar painel</a><a href="#duvidas">Perguntas frequentes</a><a href="https://docs.apirat.io/">Documentação</a></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Pirat Checkout. Todos os direitos reservados.</span><a href="#inicio">Feito para seguir em frente. <ArrowUpRight size={14}/></a></div></footer>
  </div></MotionScene>;
}
