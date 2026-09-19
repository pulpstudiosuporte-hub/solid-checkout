import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCheck, Layers3, LockKeyhole, MousePointer2, Package, Palette, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { HeroAtmosphere, useSiteMotion } from './SiteMotion';
import './pirat-experience.css';
import GlowHorizon from './GlowHorizon';

const scenes = [
  { label: 'Sua identidade', title: 'Cara de sua marca. Jeito de sua loja.', text: 'Escolha um tema, traga suas cores e organize os elementos. No editor ou conversando com a IA, o checkout ganha a sua identidade.', line: 'A marca é sua, capitão.', pose: 'replying', icon: Palette },
  { label: 'Uma boa jornada', title: 'Cada etapa no seu lugar.', text: 'Identificação, entrega e pagamento em uma experiência clara. Produtos, frete e resumo juntos para seu cliente seguir com confiança.', line: 'Tudo pronto para seguir viagem.', pose: 'thinking', icon: Truck },
  { label: 'Tudo conectado', title: 'Do Pix ao pedido. Você no controle.', text: 'Seu cliente paga. O gateway confirma. Você acompanha o pedido no painel e mantém sua operação organizada.', line: 'Agora sim, uma compra de respeito.', pose: 'happy', icon: CheckCheck },
];

function MiniCheckout({ step = 0 }) {
  const Icon = scenes[step].icon;
  return <div className={`voyage-checkout voyage-checkout-${step}`}>
    <div className="voyage-browser"><span><i/><i/><i/></span><LockKeyhole size={12}/> checkout.suamarca.com</div>
    <div className="voyage-checkout-body">
      <div className="voyage-store"><b>sua marca<span>®</span></b><ShieldCheck size={19}/></div>
      <div className="voyage-product"><span><ShoppingIllustration/></span><div><b>Kit essencial</b><small>Feito para o seu dia a dia.</small></div><strong>R$ 149</strong></div>
      <div className="voyage-mini-progress"><span>Identificação</span><i/><span>Entrega</span><i/><span>Pix</span></div>
      <div className="voyage-stage-content" key={step}>
        {step === 0 ? <><div className="voyage-field"><small>Nome completo</small><span>Seu cliente, bem-vindo.</span></div><div className="voyage-field"><small>E-mail</small><span>Uma compra começa aqui.</span></div><div className="voyage-swatches"><i/><i/><i/><span>Sua paleta. Seu estilo.</span></div></> : step === 1 ? <><div className="voyage-field"><small>Endereço de entrega</small><span>Os detalhes, todos no lugar.</span></div><div className="voyage-shipping"><Truck size={21}/><span><b>Entrega selecionada</b><small>Frete calculado no checkout</small></span><Check size={17}/></div><div className="voyage-field"><small>Resumo do pedido</small><span>Produtos + entrega, sem mistério.</span></div></> : <div className="voyage-paid"><span><CheckCheck size={35}/></span><b>Pagamento confirmado</b><p>Seu pedido segue para a próxima etapa.</p><small>Simulação da experiência Pix</small></div>}
      </div>
      <div className="voyage-fake-button"><Icon size={17}/>{step === 2 ? 'Pedido organizado no painel' : 'Continuar com minha compra'}<ArrowRight size={16}/></div>
      <small className="voyage-caption">Sua marca em cada etapa</small>
    </div>
  </div>;
}

function ShoppingIllustration() {
  return <svg viewBox="0 0 68 76" aria-hidden="true"><path d="M13 24h42l5 45H8z" fill="currentColor"/><path d="M24 27V17a10 10 0 0 1 20 0v10" stroke="currentColor" strokeWidth="5" fill="none"/><path d="m26 47 6 6 12-13" stroke="#fffcf8" strokeWidth="3" fill="none"/></svg>;
}

export function PiratHero({ signup }) {
  const running = useSiteMotion();
  const root = useRef(null);
  const timeout = useRef(null);
  const [hello, setHello] = useState(false);
  useEffect(() => () => clearTimeout(timeout.current), []);
  useEffect(() => {
    const element = root.current;
    if (!running) { element.style.setProperty('--hero-shift', '0px'); return; }
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = element.getBoundingClientRect();
        if (rect.bottom > 0) element.style.setProperty('--hero-shift', `${Math.min(60, Math.max(0, -rect.top) * 0.1)}px`);
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => { window.removeEventListener('scroll', update); cancelAnimationFrame(frame); };
  }, [running]);
  const greet = () => { setHello(true); clearTimeout(timeout.current); timeout.current = setTimeout(() => setHello(false), 4500); };
  return <section className="pirat-hero" ref={root} aria-labelledby="hero-title">
    <HeroAtmosphere/><GlowHorizon/><div className="pirat-hero-halo" aria-hidden="true"/><div className="pirat-hero-lines" aria-hidden="true"><i/><i/><i/></div>
    <div className="site-container pirat-hero-grid">
      <div className="pirat-hero-copy"><span className="site-eyebrow"><i/> CHECKOUT COM PERSONALIDADE.</span><h1 id="hero-title"><span className="hero-title-main">Sua marca <br/>no comando.</span><span className="hero-title-accent">Um checkout <br/>à altura.</span></h1><p>Você cuida da próxima grande ideia. <br/>A Pirat conecta o checkout, o Pix e a gestão da sua loja.</p><div className="pirat-hero-actions"><a href={signup} className="site-button light">Criar minha conta <ArrowUpRight size={20}/></a><a href="#demonstracao" className="site-text-link">Ver na prática <ArrowRight size={18}/></a></div><div className="pirat-hero-proof"><span><Check size={15}/> Sua marca</span><span><Check size={15}/> Seu domínio</span><span><Check size={15}/> Seu controle</span></div></div>
      <div className="pirat-hero-art">
        <div className="pirat-stage-label"><span><Sparkles size={15}/> DO SEU JEITO</span><span>01 — CHECKOUT</span></div>
        <div className="pirat-hero-preview"><MiniCheckout/></div>
        <div className="pirat-editor-tag"><Layers3 size={17}/><span>Monte no editor.<br/><b>Ou crie com IA.</b></span></div>
        <div className={`pirat-host ${hello ? 'is-greeting' : ''}`}><div className="pirat-host-speech" role="status">{hello ? 'Aê, marujo! Bora colocar sua marca no mapa?' : 'Pode chegar. O comando é seu.'}</div><button className="pirat-host-button" onClick={greet} aria-label="Cumprimentar o papagaio"><img src={`/brand/assistant/${hello ? 'happy' : 'greeting'}.webp`} width="320" height="320" alt="Papagaio pirata vermelho com chapéu e tapa-olho"/><span>Dê um alô <MousePointer2 size={12}/></span></button></div>
        <div className="pirat-secure-tag"><ShieldCheck size={17}/><span>Personalidade na frente.<br/><b>Controle nos bastidores.</b></span></div>
      </div>
    </div>
    <a className="pirat-scroll-cue" href="#jornada"><ArrowDown size={17}/><span>DESÇA. A IDEIA VAI TOMAR FORMA.</span><span>01 / 03</span></a>
  </section>;
}

export function CheckoutJourney() {
  const root = useRef(null);
  const running = useSiteMotion();
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!running || !window.matchMedia('(min-width: 601px)').matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(Number(entry.target.getAttribute('data-scene')));
    }, { rootMargin: '-30% 0px -45% 0px', threshold: 0 });
    root.current.querySelectorAll('[data-scene]').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [running]);
  return <section className="pirat-journey site-container" id="jornada" ref={root} aria-labelledby="journey-title">
    <div className="section-heading left"><span className="site-eyebrow">DA SUA IDEIA AO ÚLTIMO CLIQUE</span><h2 id="journey-title">Parece simples.<br/><span>E é para ser.</span></h2><p>Role para acompanhar. O papagaio mostra o caminho.</p></div>
    <div className="pirat-journey-grid"><div className="pirat-journey-chapters">{scenes.map((scene, index) => <article key={scene.label} data-scene={index} className={active === index ? 'is-active' : ''}><span className="pirat-chapter-number">0{index + 1}</span><span className="site-eyebrow">{scene.label}</span><h3>{scene.title}</h3><p>{scene.text}</p><button type="button" aria-pressed={active === index} onClick={() => setActive(index)} aria-controls="journey-preview">Ver esta etapa <ArrowUpRight size={18}/></button></article>)}</div><div className="pirat-journey-sticky" id="journey-preview"><div className="pirat-journey-tabs" role="group" aria-label="Etapas da apresentação">{scenes.map((scene, index) => <button key={scene.label} aria-pressed={active === index} onClick={() => setActive(index)}>0{index + 1}<span>{scene.label}</span></button>)}</div><MiniCheckout step={active}/><div className="pirat-journey-host"><img key={scenes[active].pose} src={`/brand/assistant/${scenes[active].pose}.webp`} width="112" height="112" alt="" loading="lazy"/><p>{scenes[active].line}</p></div></div></div>
  </section>;
}

export function MerchantLife() {
  return <section className="pirat-people" id="lojistas" aria-labelledby="people-title"><div className="site-container"><div className="pirat-people-heading"><div><span className="site-eyebrow">POR TRÁS DE CADA LOJA, TEM ALGUÉM.</span><h2 id="people-title">Seu negócio é sério.<br/><span>Sua marca pode ter alma.</span></h2></div><p>Tem quem escolhe cada produto. Quem embala com cuidado. Quem acompanha cada pedido. A Pirat foi feita para fazer parte dessa rotina.</p></div><div className="pirat-people-grid"><figure><img src="/brand/people/merchant-packing.jpg" width="600" height="720" loading="lazy" alt="Lojista sorrindo com uma caixa pronta para envio"/><figcaption><span>PARA QUEM EMPREENDE</span><h3>Uma ideia sua.<br/>Uma experiência inteira.</h3></figcaption></figure><div className="pirat-people-right"><figure><img src="/brand/people/team-packing.jpg" width="900" height="560" loading="lazy" alt="Duas pessoas organizando e embalando pedidos de uma loja"/><figcaption><span>PARA QUEM FAZ ACONTECER</span><h3>Mais clareza para<br/>tocar a operação.</h3></figcaption></figure><div className="pirat-people-note"><Package size={28}/><p>Do cuidado com o produto<br/><b>ao cuidado com a compra.</b></p><ArrowUpRight size={26}/></div></div></div></div></section>;
}
