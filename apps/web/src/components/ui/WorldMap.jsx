import { useEffect, useId, useRef, useState } from 'react';
import './world-map.css';
import { projectPoint } from './world-map-projection';

const curvedPath = (start, end) => {
  const middleX = (start.x + end.x) / 2;
  const middleY = Math.min(start.y, end.y) - Math.min(65, Math.abs(end.x - start.x) * 0.16 + 24);
  return `M ${start.x} ${start.y} Q ${middleX} ${middleY} ${end.x} ${end.y}`;
};

export function WorldMap({ locations = [], lineColor = '#7657ed' }) {
  const gradientId = useId().replace(/:/g, '');
  const container = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const mapSource = '/illustrations/world-map.svg';
  const points = locations.map(location => ({ ...location, point: projectPoint(location.latitude, location.longitude) })).filter(location => location.point);
  const origin = points[0];

  return <div ref={container} data-paused={!visible} className="world-map-visual">
    <svg viewBox="0 0 800 400" preserveAspectRatio="none" role="img" aria-label={points.length ? `Mapa com ${points.length} localizações aproximadas por IP` : 'Mapa sem coordenadas disponíveis'}>
      <image className="world-map-base" href={mapSource} x="0" y="0" width="800" height="400" preserveAspectRatio="none"/>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0"/>
          <stop offset="8%" stopColor={lineColor} stopOpacity=".75"/>
          <stop offset="92%" stopColor={lineColor} stopOpacity=".75"/>
          <stop offset="100%" stopColor={lineColor} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {origin && points.slice(1).map((location, index) => <path
        key={`route-${location.country}-${location.region}-${location.city}-${index}`}
        className="world-map-route"
        d={curvedPath(origin.point, location.point)}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.4"
        pathLength="1"
        style={{ animationDelay: `${index * .12}s` }}
      />)}
      {points.map((location, index) => <g key={`point-${location.country}-${location.region}-${location.city}-${index}`}>
        <title>{[location.city, location.region, location.country].filter(Boolean).join(' · ')}: {location.visitors} visitantes · Aproximado por IP</title>
        <circle cx={location.point.x} cy={location.point.y} r="4" fill={lineColor} stroke="#fff" strokeWidth="2"/>
        <circle className="world-map-pulse" cx={location.point.x} cy={location.point.y} r="4" fill="none" stroke={lineColor} strokeWidth="1.5" style={{ animationDelay: `${index * .15}s` }}/>
      </g>)}
    </svg>
    {locations.length > points.length && <span className="world-map-missing">{locations.length - points.length} {locations.length - points.length === 1 ? 'localização sem ponto disponível' : 'localizações sem ponto disponível'}</span>}
  </div>;
}
