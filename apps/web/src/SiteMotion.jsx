import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, BarChart3, Check, MousePointer2, Pause, Play, Plus, Sparkles, TrendingUp } from 'lucide-react';
import './motion.css';

const MotionContext = createContext(false);
export const useSiteMotion = () => useContext(MotionContext);
const currency = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function MotionScene({ children }) {
  const root = useRef(null);
  const progress = useRef(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => !document.hidden);
  const running = !paused && !reduced && visible;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => setReduced(media.matches);
    const visibility = () => setVisible(!document.hidden);
    media.addEventListener('change', preference);
    document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', preference); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    const scene = root.current;
    let scrollFrame = 0;
    const updateProgress = () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        const height = document.documentElement.scrollHeight - window.innerHeight;
        progress.current?.style.setProperty('transform', `scaleX(${height > 0 ? window.scrollY / height : 0})`);
      });
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('motion-enter'); reveal.unobserve(entry.target); }
    }), { threshold: 0.12 });
    scene.querySelectorAll('.section-heading, .feature-panel, .foundation-card, .setup-guide, .integration-detail, .faq-list, .final-cta, .motion-dashboard, .pirat-people-heading, .pirat-people figure').forEach((element, index) => {
      element.style.setProperty('--reveal-delay', `${(index % 3) * 70}ms`);
      reveal.observe(element);
    });
    const ambience = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('motion-offscreen', !entry.isIntersecting)));
    scene.querySelectorAll('.hero-stage, .integration-network, .final-cta, .feature-sandbox, .pirat-hero-art').forEach(element => ambience.observe(element));
    return () => {
      reveal.disconnect(); ambience.disconnect(); cancelAnimationFrame(scrollFrame);
      window.removeEventListener('scroll', updateProgress); window.removeEventListener('resize', updateProgress);
    };
  }, []);

  useEffect(() => {
    if (!running || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const scene = root.current;
    let frame = 0;
    let previous;
    const clear = () => {
      if (!previous) return;
      previous.style.removeProperty('--tilt-x'); previous.style.removeProperty('--tilt-y');
      previous.style.removeProperty('--spot-opacity'); previous = null;
    };
    const move = event => {
      const target = event.target.closest('.foundation-card, .motion-dashboard, .final-cta, .feature-sandbox');
      if (target !== previous) clear();
      cancelAnimationFrame(frame);
      if (!target) return;
      previous = target;
      const { clientX, clientY } = event;
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        target.style.setProperty('--spot-x', `${x}px`); target.style.setProperty('--spot-y', `${y}px`);
        target.style.setProperty('--spot-opacity', '1');
        target.style.setProperty('--tilt-x', `${(0.5 - y / rect.height) * 4}deg`);
        target.style.setProperty('--tilt-y', `${(x / rect.width - 0.5) * 4}deg`);
      });
    };
    const leave = () => { cancelAnimationFrame(frame); clear(); };
    scene.addEventListener('pointermove', move, { passive: true });
    scene.addEventListener('pointerleave', leave);
    return () => { cancelAnimationFrame(frame); clear(); scene.removeEventListener('pointermove', move); scene.removeEventListener('pointerleave', leave); };
  }, [running]);

  return <MotionContext.Provider value={running}><div className="motion-scene" data-motion={running ? 'running' : 'paused'} ref={root}>
    <div className="reading-progress" aria-hidden="true"><i ref={progress}/></div>
    {children}
    <button className="motion-toggle" type="button" aria-pressed={paused || reduced} disabled={reduced} onClick={() => setPaused(!paused)}>{running ? <Pause size={14}/> : <Play size={14}/>}<span>{reduced ? 'Movimento reduzido' : paused ? 'Ativar efeitos' : 'Pausar efeitos'}</span></button>
  </div></MotionContext.Provider>;
}

export function HeroAtmosphere() {
  return <div className="hero-atmosphere" aria-hidden="true"><div className="aurora aurora-one"/><div className="aurora aurora-two"/>{Array.from({ length: 12 }, (_, index) => <i key={index} className="light-particle" style={{ '--particle-x': `${(index * 31 + 7) % 100}%`, '--particle-y': `${(index * 19 + 11) % 100}%`, '--particle-delay': `${index * -1.3}s`, '--particle-duration': `${7 + index % 5}s` }}/>)}</div>;
}

export function SuccessBurst() {
  return <div className="success-burst" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--burst-x': `${Math.cos(index * 2.4) * (65 + index * 4)}px`, '--burst-y': `${Math.sin(index * 2.4) * 90 - 70}px`, '--burst-angle': `${index * 47}deg`, '--burst-delay': `${index % 4 * 45}ms`, '--burst-color': ['#ea827b', '#68c9ab', '#ecd187'][index % 3] }}/>)}</div>;
}

export function AnimatedNumber({ value, money = false }) {
  const running = useSiteMotion();
  const ref = useRef(null);
  const previous = useRef(value);
  const format = number => money ? currency(number) : Math.round(number).toLocaleString('pt-BR');
  useEffect(() => {
    const element = ref.current;
    const from = previous.current;
    previous.current = value;
    if (!running || from === value) return;
    let frame;
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / 800);
      const current = from + (value - from) * (1 - (1 - t) ** 3);
      element.textContent = money ? currency(current) : Math.round(current).toLocaleString('pt-BR');
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); element.textContent = money ? currency(value) : Math.round(value).toLocaleString('pt-BR'); };
  }, [value, running, money]);
  return <span className="animated-number"><span ref={ref} aria-hidden="true">{format(value)}</span><span className="motion-sr-only">{format(value)}</span></span>;
}

const makeSamples = count => Array.from({ length: count }, (_, index) => 10 + ((index * 7 + 3) % 15) + Math.round(index * 1.8));
function smoothLine(points) {
  return points.map(([x, y], index) => {
    if (!index) return `M ${x},${y}`;
    const [px, py] = points[index - 1];
    const mid = (px + x) / 2;
    return `C ${mid},${py} ${mid},${y} ${x},${y}`;
  }).join(' ');
}

export function LiveAnalytics() {
  const gradient = useId().replace(/:/g, '');
  const root = useRef(null);
  const running = useSiteMotion();
  const [inView, setInView] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const refresh = useRef(0);
  const [period, setPeriod] = useState(7);
  const [metric, setMetric] = useState('revenue');
  const [samples, setSamples] = useState(() => makeSamples(7));
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const orders = samples.reduce((sum, value) => sum + value, 0);
  const selectedIndex = selected ?? samples.length - 1;
  const unit = metric === 'revenue' ? 149 : 1;
  const values = samples.map(value => value * unit);
  const maximum = Math.max(...values) * 1.2;
  const points = values.map((value, index) => [20 + index / (values.length - 1) * 680, 205 - value / maximum * 170]);
  const line = smoothLine(points);
  const [pointX, pointY] = points[selectedIndex];
  const label = index => period === 7 ? `Dia ${index + 1}` : `Dias ${index * 3 + 1}–${Math.min(30, index * 3 + 3)}`;
  const format = value => metric === 'revenue' ? currency(value) : `${value} pedidos`;

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!running || !inView || inspecting || focused || tableOpen) return;
    const timer = window.setInterval(() => {
      refresh.current += 1;
      const phase = refresh.current;
      setSamples(current => current.map((value, index) => Math.max(5, Math.min(65, value + Math.round(Math.sin(phase + index * 1.4) * 5)))));
      setRevision(value => value + 1);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [running, inView, inspecting, focused, tableOpen]);

  const changePeriod = next => { setPeriod(next); setSamples(makeSamples(next === 7 ? 7 : 10)); setSelected(null); setRevision(value => value + 1); setNotice(''); };
  const simulate = () => {
    setSamples(current => current.map((value, index) => index === current.length - 1 ? value + 1 : value));
    setSelected(null); setRevision(value => value + 1); setNotice('Pedido fictício adicionado: + R$ 149 na receita do exemplo.');
  };
  return <section className="site-section site-container analytics-section" id="em-movimento" ref={root}>
    <div className="section-heading"><span className="site-eyebrow"><Activity size={14}/> VEJA A EXPERIÊNCIA GANHAR VIDA</span><h2>Sua operação.<br/><span>Em movimento.</span></h2><p>Explore o gráfico, altere o período e simule uma nova venda.<br/>Aqui, cada interação conta uma parte da história.</p></div>
    <div className="motion-dashboard" data-revision={revision}>
      <div className="dashboard-toolbar"><div className="dashboard-title"><span className="dashboard-symbol"><BarChart3 size={22}/></span><div><strong>Visão da operação</strong><span><i className="live-dot"/> Demonstração animada · dados fictícios</span></div></div><div className="chart-period" role="group" aria-label="Período do gráfico">{[7, 30].map(days => <button type="button" key={days} aria-pressed={period === days} onClick={() => changePeriod(days)}>{days} dias</button>)}</div></div>
      <div className="dashboard-metrics"><div><span>Receita simulada <TrendingUp size={16}/></span><strong><AnimatedNumber value={orders * 149} money/></strong><small>Total dos pedidos do exemplo</small></div><div><span>Pedidos simulados <ShoppingBagIcon/></span><strong><AnimatedNumber value={orders}/></strong><small>Explore os pontos para ver o detalhe</small></div><div className="metric-action"><span className="simulation-orbit" aria-hidden="true"><Sparkles size={24}/></span><button className="site-button" type="button" onClick={simulate}><Plus size={16}/> Simular nova venda</button></div></div>
      <div className="dashboard-body"><div className="main-chart"><div className="chart-heading"><div role="group" aria-label="Métrica do gráfico" className="chart-metrics">{[['revenue', 'Receita'], ['orders', 'Pedidos']].map(([value, title]) => <button type="button" key={value} aria-pressed={metric === value} onClick={() => setMetric(value)}>{title}</button>)}</div><span className="chart-hint"><MousePointer2 size={13}/> Toque ou passe o mouse</span></div>
        <div className="chart-inspector" onPointerEnter={() => setInspecting(true)} onPointerLeave={() => setInspecting(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
          <div className="chart-readout"><span>{label(selectedIndex)}</span><strong>{format(values[selectedIndex])}</strong><small>{period === 7 ? 'Resumo diário' : 'Resumo a cada 3 dias'}</small></div>
          <div className="chart-plot"><svg viewBox="0 0 720 230" preserveAspectRatio="none" className="sales-curve" aria-hidden="true"><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f98981" stopOpacity=".36"/><stop offset="100%" stopColor="#f98981" stopOpacity="0"/></linearGradient></defs>{[40, 95, 150, 205].map(y => <line key={y} x1="20" x2="700" y1={y} y2={y} className="chart-grid-line"/>)}<path className="chart-area" d={`${line} L 700,220 L 20,220 Z`} fill={`url(#${gradient})`}/><path className="chart-line chart-line-glow" d={line}/><path className="chart-line" d={line} pathLength="1000"/><line className="chart-crosshair" x1={pointX} x2={pointX} y1="20" y2="220"/>{points.map(([x, y], index) => <circle key={index} className={`chart-point ${index === selectedIndex ? 'selected' : ''}`} cx={x} cy={y} r={index === selectedIndex ? 6 : 3}/>)}<circle className="chart-point-halo" cx={pointX} cy={pointY} r="13"/></svg><div className="chart-hit-zones" role="group" aria-label="Explorar pontos do gráfico">{values.map((value, index) => <button type="button" key={index} aria-label={`${label(index)}: ${format(value)}`} aria-pressed={selectedIndex === index} onPointerEnter={() => setSelected(index)} onFocus={() => setSelected(index)} onClick={() => setSelected(index)}><span>{period === 7 ? String(index + 1).padStart(2, '0') : (index + 1) * 3}</span></button>)}</div></div>
        </div>
        <div className="chart-bottom"><span><i/>{metric === 'revenue' ? 'Receita' : 'Pedidos'} no período ilustrativo</span><small>{!running ? 'Animação pausada' : inspecting || focused || tableOpen ? 'Pausado para explorar' : 'Atualiza a cada 3 segundos'}</small></div>
      </div><aside className="volume-chart"><div><span className="site-eyebrow">RITMO DOS PEDIDOS</span><TrendingUp size={19}/></div><h3>Cada barra,<br/>uma nova perspectiva.</h3><div className="volume-bars" aria-hidden="true">{samples.map((value, index) => <i key={index}><span style={{ transform: `scaleY(${value / Math.max(...samples)})`, '--bar-delay': `${index * 65}ms` }}/></i>)}</div><p>O volume acompanha o gráfico. Troque o período ou adicione um pedido para ver tudo se transformar.</p><a href="#demonstracao" className="site-text-link lavender">Experimentar o checkout <ArrowRight size={15}/></a></aside></div>
      <div className="dashboard-footnote"><span role="status">{notice || 'Uma prévia para explorar. Estes números não representam resultados de clientes.'}</span><span><Check size={13}/> Nenhuma venda real é criada</span></div>
      <details className="chart-data" onToggle={event => setTableOpen(event.currentTarget.open)}><summary>Ver os dados do gráfico em tabela</summary><div><table><caption>Dados fictícios · {period} dias</caption><thead><tr><th scope="col">Período</th><th scope="col">Pedidos</th><th scope="col">Receita</th></tr></thead><tbody>{samples.map((value, index) => <tr key={index}><th scope="row">{label(index)}</th><td>{value}</td><td>{currency(value * 149)}</td></tr>)}</tbody></table></div></details>
    </div>
  </section>;
}

function ShoppingBagIcon() { return <ArrowUpRight size={16}/>; }

export function MiniMovingChart({ values }) {
  const running = useSiteMotion();
  return <div className={`analytics-bars animated-mini-chart ${running ? 'playing' : ''}`} aria-hidden="true">{values.map((height, index) => <i key={index} style={{ '--bar-height': `${height}%`, '--bar-delay': `${index * -0.37}s` }}/>)}</div>;
}
