import React, { useId, useMemo } from 'react';
import DottedMap from 'dotted-map';
import './world-map.css';

const projectPoint = (latitude, longitude) => ({
  x: (Number(longitude) + 180) * (800 / 360),
  y: (90 - Number(latitude)) * (400 / 180),
});

const curvedPath = (start, end) => {
  const middleX = (start.x + end.x) / 2;
  const middleY = Math.min(start.y, end.y) - Math.min(65, Math.abs(end.x - start.x) * 0.16 + 24);
  return `M ${start.x} ${start.y} Q ${middleX} ${middleY} ${end.x} ${end.y}`;
};

export function WorldMap({ locations = [], lineColor = '#7657ed' }) {
  const gradientId = useId().replace(/:/g, '');
  const mapSource = useMemo(() => {
    const map = new DottedMap({ height: 100, grid: 'diagonal' });
    const svg = map.getSVG({ radius: 0.22, color: '#a9bfd6', shape: 'circle', backgroundColor: '#eef4fa' });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, []);
  const detailedLocations = locations.some(location => location.city) ? locations.filter(location => location.city) : locations;
  const points = detailedLocations
    .filter(location => Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)))
    .map(location => ({ ...location, point: projectPoint(location.latitude, location.longitude) }));
  const origin = points[0];

  return <div className="world-map-visual" role="img" aria-label={points.length ? `Mapa com ${points.length} localizações de visitantes` : 'Mapa-múndi sem visitas no período'}>
    <img src={mapSource} alt="" draggable="false"/>
    <svg viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden="true">
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
        <circle cx={location.point.x} cy={location.point.y} r="4" fill={lineColor} stroke="#fff" strokeWidth="2"/>
        <circle className="world-map-pulse" cx={location.point.x} cy={location.point.y} r="4" fill="none" stroke={lineColor} strokeWidth="1.5" style={{ animationDelay: `${index * .15}s` }}/>
      </g>)}
    </svg>
  </div>;
}
