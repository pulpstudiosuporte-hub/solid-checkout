import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Globe2, ScanLine, ShoppingBag } from 'lucide-react';
import { useSiteMotion } from './SiteMotion';
import './analytics-globe.css';

export function AnalyticsGlobe({ signup }) {
  const root = useRef(null), host = useRef(null), canvas = useRef(null), controller = useRef(null);
  const [near, setNear] = useState(false), [visible, setVisible] = useState(false), [ready, setReady] = useState(false);
  const motion = useSiteMotion();
  const active = motion && visible;
  const activeRef = useRef(active); activeRef.current = active;
  useEffect(() => {
    const preload = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setNear(true); preload.disconnect(); } }, { rootMargin: '250px' });
    const view = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .1 });
    preload.observe(root.current); view.observe(root.current);
    return () => { preload.disconnect(); view.disconnect(); };
  }, []);
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    import('./analytics-globe-engine').then(({ mountGlobe }) => {
      if (cancelled) return;
      controller.current = mountGlobe(canvas.current, host.current, activeRef.current);
      setReady(true);
    }).catch(() => { /* The decorative static sphere remains if Canvas cannot load. */ });
    return () => { cancelled = true; controller.current?.dispose(); controller.current = null; };
  }, [near]);
  useEffect(() => { controller.current?.setRunning(active); }, [active]);
  return <section className="analytics-globe-section" id="analise-avancada" ref={root} aria-labelledby="analytics-globe-title">
    <div className="site-container analytics-globe-layout">
      <div className="analytics-globe-copy">
        <span className="site-eyebrow"><ScanLine size={15}/> ANÁLISE AVANÇADA</span>
        <h2 id="analytics-globe-title">Veja o todo.<br/><span>Decida no detalhe.</span></h2>
        <p>Conecte os pontos da sua operação. Acompanhe vendas e pedidos, escolha o período e encontre o contexto por trás de cada resultado.</p>
        <ul className="analytics-globe-features">
          <li><BarChart3 size={21}/><div><strong>Vendas em perspectiva</strong><span>Receita e evolução dos pedidos em um só painel.</span></div></li>
          <li><CalendarDays size={21}/><div><strong>O período que importa</strong><span>Do movimento de hoje ao intervalo que você quer analisar.</span></div></li>
          <li><ShoppingBag size={21}/><div><strong>Do número ao pedido</strong><span>Acompanhe o status dos pagamentos e os detalhes da sua operação.</span></div></li>
        </ul>
        <a href={signup} className="site-button light">Minha operação no comando <ArrowUpRight size={18}/></a>
      </div>
      <div className="analytics-globe-visual">
        <div className="globe-orbit-label"><Globe2 size={14}/><span>VISÃO AMPLA. CONTROLE DE PERTO.</span></div>
        <div className="analytics-globe-canvas" ref={host} data-ready={ready} data-animation={active ? 'running' : 'paused'}>
          {!ready && <div className="globe-fallback" aria-hidden="true"/>}
          <canvas ref={canvas} aria-hidden="true"/>
        </div>
        <div className="globe-focus-tag"><i/><span>Todos os seus indicadores.<br/><strong>Uma visão conectada.</strong></span></div>
        <div className="globe-controls" role="group" aria-label="Girar globo">
          <button type="button" disabled={!ready} aria-label="Girar globo para a esquerda" onClick={() => controller.current?.rotate(-1)}><ArrowLeft size={17}/></button>
          <span>Arraste para explorar</span>
          <button type="button" disabled={!ready} aria-label="Girar globo para a direita" onClick={() => controller.current?.rotate(1)}><ArrowRight size={17}/></button>
        </div>
      </div>
    </div>
  </section>;
}
