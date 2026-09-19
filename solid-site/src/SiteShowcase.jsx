import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play, Quote } from 'lucide-react';
import { useSiteMotion } from './SiteMotion';
import './site-showcase.css';

const models = [
  { id: 'essencial', name: 'Essencial', type: 'Minimalista', text: 'Formulário e resumo lado a lado. Uma base limpa para deixar sua marca aparecer.', detail: 'Layout dividido · Inter · Tons neutros' },
  { id: 'varejo', name: 'Varejo', type: 'Três colunas', text: 'Produtos, dados e resumo com espaços próprios. Uma jornada organizada em etapas.', detail: 'Três colunas · Faixas de etapas · Preto e branco' },
  { id: 'marketplace', name: 'Marketplace', type: 'Cartões', text: 'Informações agrupadas em cartões, com resumo lateral e destaque para a ação principal.', detail: 'Cartões · Resumo lateral · Azul e amarelo' },
  { id: 'atelie', name: 'Ateliê', type: 'Variação do Essencial', text: 'Uma possibilidade de personalização: cores suaves, cantos arredondados e a sua identidade.', detail: 'Base Essencial · Poppins · Paleta rosada' },
  { id: 'botanica', name: 'Botânica', type: 'Variação do Essencial', text: 'Verde, respiro e simplicidade. A mesma estrutura com outra personalidade.', detail: 'Base Essencial · Inter · Paleta natural' },
];
const wrap = index => (index + models.length) % models.length;

export function TemplateShowcase({ signup }) {
  const [active, setActive] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const running = useSiteMotion();
  const root = useRef(null);
  const touch = useRef(null);
  const suppressClick = useRef(false);
  const select = index => { setActive(wrap(index)); setPlaying(false); };
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || !running || !visible || hovered || focused) return;
    const timer = setInterval(() => setActive(index => wrap(index + 1)), 5000);
    return () => clearInterval(timer);
  }, [playing, running, visible, hovered, focused]);
  const selected = models[active];
  return <section className="template-showcase" id="templates" ref={root} aria-labelledby="templates-title">
    <div className="site-container section-heading"><span className="site-eyebrow">UM CHECKOUT. MUITAS PERSONALIDADES.</span><h2 id="templates-title">O próximo visual da sua loja<br/><span>pode começar aqui.</span></h2><p>Explore os modelos e suas possibilidades. Depois, deixe tudo com a sua cara.</p></div>
    <div className="template-gallery" role="group" aria-roledescription="carrossel" aria-label="Modelos de checkout" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="template-stage" onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; suppressClick.current = false; }} onTouchEnd={event => { const start = touch.current; touch.current = null; if (!start) return; const dx = event.changedTouches[0].clientX - start.x; const dy = event.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { suppressClick.current = true; select(active + (dx < 0 ? 1 : -1)); } }}>
        {models.map((model, index) => {
          const offset = ((index - active + models.length + 2) % models.length) - 2;
          return <button type="button" key={model.id} className={`template-slide ${offset === 0 ? 'is-selected' : ''}`} data-offset={offset} style={{ '--offset': offset, '--distance': Math.abs(offset), zIndex: 5 - Math.abs(offset) }} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); select(active + (event.key === 'ArrowRight' ? 1 : -1)); } }} aria-label={`Ver modelo ${model.name}`} aria-pressed={active === index} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } select(index); }}>
            <img src={`/brand/templates/${model.id}-art.webp`} alt={`Composição ilustrativa do checkout ${model.name} no computador e no celular`} width="1536" height="1024" loading={visible || active === index ? 'eager' : 'lazy'}/>
            <span className="template-slide-label">{model.name}<ArrowUpRight size={17}/></span>
          </button>;
        })}
      </div>
      <div className="template-controls"><button type="button" aria-label="Modelo anterior" onClick={() => select(active - 1)}><ArrowLeft size={19}/></button><span aria-live={playing ? 'off' : 'polite'}>{String(active + 1).padStart(2, '0')} <span>/ {String(models.length).padStart(2, '0')}</span></span><button type="button" aria-label="Próximo modelo" onClick={() => select(active + 1)}><ArrowRight size={19}/></button><button type="button" disabled={!running} aria-label={playing ? 'Pausar carrossel' : 'Reproduzir carrossel'} aria-pressed={playing} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button></div>
      <div className="template-description" aria-live={playing ? 'off' : 'polite'} aria-atomic="true"><span>{selected.type}</span><h3>{selected.name}</h3><p>{selected.text}</p><small>{selected.detail}</small></div>
    </div>
    <div className="template-bottom"><a className="site-button light" href={signup}>Criar meu checkout <ArrowUpRight size={18}/></a><p>Composições ilustrativas criadas com IA, inspiradas nas opções de personalização.<br/>Ateliê e Botânica exploram a base Essencial. O resultado depende da configuração no editor.</p></div>
  </section>;
}

const examples = [
  { name: 'Marina Alves', role: 'Moda e acessórios', initials: 'MA', tone: 'ivory', text: 'Escolher as cores e organizar cada detalhe é o que faz a experiência parecer uma continuação da minha loja.', color: 'rose' },
  { name: 'Rafael Costa', role: 'Loja de decoração', initials: 'RC', text: 'Gosto de um checkout direto: o cliente encontra o produto, confere a entrega e entende o próximo passo.', color: 'sage' },
  { name: 'Clara Martins', role: 'Marca independente', initials: 'CM', text: 'Começar por um modelo e deixar tudo com a minha identidade torna a criação muito mais fácil de visualizar.', color: 'gold' },
  { name: 'Lucas Oliveira', role: 'Esporte e lifestyle', initials: 'LO', text: 'Na minha loja, o celular vem primeiro. Quero uma compra que seja simples de acompanhar em cada etapa.', color: 'gold' },
  { name: 'Beatriz Lima', role: 'Beleza e autocuidado', initials: 'BL', tone: 'gold', text: 'O cuidado que eu tenho com a embalagem também precisa aparecer na hora de comprar. Cada detalhe conta.', color: 'rose' },
  { name: 'Pedro Santos', role: 'Produtos para casa', initials: 'PS', text: 'Ter os pedidos organizados e o resumo claro ajuda a pensar na experiência inteira, do produto ao pagamento.', color: 'sage' },
];

export function TestimonialShowcase() {
  return <section className="testimonial-showcase site-container" id="depoimentos" aria-labelledby="testimonials-title">
    <div className="section-heading"><span className="site-eyebrow">LOJAS DIFERENTES. CUIDADO EM COMUM.</span><h2 id="testimonials-title">Tem uma pessoa<br/><span>por trás de cada marca.</span></h2><p>Uma prévia do espaço para as histórias de quem empreende.</p><span className="testimonial-disclaimer">Exemplos ilustrativos · Pessoas e falas fictícias, não são avaliações de clientes.</span></div>
    <div className="testimonial-columns">{[0, 1, 2].map(column => <div className="testimonial-column" key={column}>{[examples[column], examples[column + 3]].map(person => <figure className="testimonial-card" data-card-tone={person.tone} key={person.name}><Quote size={25} aria-hidden="true"/><blockquote>{person.text}</blockquote><figcaption><span className={`testimonial-avatar ${person.color}`} aria-hidden="true">{person.initials}</span><div><strong>{person.name}</strong><span>{person.role}</span></div></figcaption><small>Depoimento de exemplo</small></figure>)}</div>)}</div>
  </section>;
}
