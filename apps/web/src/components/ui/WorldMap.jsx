import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Map } from 'lucide-react';
import { coordinate } from './world-map-projection';
import './world-map.css';

const Globe3D = lazy(() => import('./3d-globe'));
const FlatWorldMap = lazy(() => import('./FlatWorldMap').then(module => ({ default: module.FlatWorldMap })));

class GlobeBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function WorldMap({ locations = [], lineColor = '#7657ed' }) {
  const container = useRef(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [flat, setFlat] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [ready, setReady] = useState(false);
  const fail = useCallback(() => setUnavailable(true), []);
  const markReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (!window.IntersectionObserver) { setVisible(true); setLoaded(true); return; }
    const observer = new IntersectionObserver(([entry]) => { setVisible(entry.isIntersecting); if (entry.isIntersecting) setLoaded(true); });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const change = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (!loaded || ready || flat || unavailable) return;
    const timer = setTimeout(fail, 25000);
    return () => clearTimeout(timer);
  }, [loaded, ready, flat, unavailable, fail]);
  const markers = useMemo(() => locations.flatMap(location => {
    const lat = coordinate(location.latitude, 90), lng = coordinate(location.longitude, 180);
    if (lat === null || lng === null || (lat === 0 && lng === 0)) return [];
    return [{ lat, lng, label: `${[location.city, location.region, location.country].filter(Boolean).join(' · ')} · ${location.visitors} ${Number(location.visitors) === 1 ? 'visitante' : 'visitantes'}` }];
  }), [locations]);
  const missing = locations.length - markers.length;
  const isFlat = flat || unavailable;
  return <div ref={container} className={`world-map-panel ${isFlat ? 'is-flat' : ''}`}>
    <div className="world-map-caption"><span>{isFlat ? 'ALCANCE GEOGRÁFICO' : 'VISITAS PELO MUNDO'}</span><strong>{markers.length} {markers.length === 1 ? 'localização' : 'localizações'}</strong></div>
    {!unavailable && <button type="button" className="map-mode" onClick={() => { setFlat(value => !value); setReady(false); }} aria-label={flat ? 'Ver globo 3D' : 'Ver mapa plano'}>{flat ? <Globe2 size={14}/> : <Map size={14}/>}<span>{flat ? 'Globo 3D' : 'Mapa plano'}</span></button>}
    <Suspense fallback={<p className="world-map-wait" role="status">Carregando mapa...</p>}>
      {isFlat ? <FlatWorldMap locations={locations} lineColor={lineColor}/> : loaded && <GlobeBoundary onError={fail}>
        <Globe3D markers={markers} active={visible && pageVisible} onUnavailable={fail} onReady={markReady}/>
      </GlobeBoundary>}
    </Suspense>
    {!isFlat && missing > 0 && <span className="globe-missing">{missing} {missing === 1 ? 'localização sem ponto disponível' : 'localizações sem ponto disponível'}</span>}
    {unavailable && <span className="world-map-fallback" role="status">3D indisponível. Exibindo o mapa plano.</span>}
  </div>;
}
