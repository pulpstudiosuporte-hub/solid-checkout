import { useId, useState } from 'react';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compactMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

export default function RevenueChart({ series }) {
  const gradientId = useId().replace(/:/g, '');
  const [activeIndex, setActiveIndex] = useState(null);
  const [keyboardIndex, setKeyboardIndex] = useState(0);
  const width = 680;
  const top = 18;
  const bottom = 206;
  const max = Math.max(1, ...series.map(item => item.revenueCents));
  const coordinates = series.map((item, index) => ({
    ...item,
    x: series.length === 1 ? width / 2 : index * width / (series.length - 1),
    y: bottom - (item.revenueCents / max) * (bottom - top),
  }));
  const smoothPath = coordinates.length ? coordinates.reduce((path, point, index, list) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = list[index - 1];
    const before = list[index - 2] || previous;
    const after = list[index + 1] || point;
    const controlOneX = previous.x + (point.x - before.x) / 6;
    const controlOneY = previous.y + (point.y - before.y) / 6;
    const controlTwoX = point.x - (after.x - previous.x) / 6;
    const controlTwoY = point.y - (after.y - previous.y) / 6;
    return `${path} C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${point.x} ${point.y}`;
  }, '') : '';
  const area = smoothPath ? `${smoothPath} L ${coordinates.at(-1).x} ${bottom} L ${coordinates[0].x} ${bottom} Z` : '';
  const active = activeIndex === null ? null : coordinates[activeIndex];
  const tickCount = Math.min(7, coordinates.length);
  const ticks = Array.from({ length: tickCount }, (_, index) => coordinates[Math.round(index * (coordinates.length - 1) / Math.max(1, tickCount - 1))]);
  const moveFocus = (event, index) => {
    const next = event.key === 'ArrowRight' ? Math.min(coordinates.length - 1, index + 1) : event.key === 'ArrowLeft' ? Math.max(0, index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? coordinates.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setKeyboardIndex(next);
    event.currentTarget.ownerSVGElement.querySelectorAll('.chart-hit-point')[next]?.focus();
  };
  const selectNearest = event => {
    if (!coordinates.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    setActiveIndex(Math.round((relativeX / bounds.width) * (coordinates.length - 1)));
  };

  return <div className="dashboard-chart-layout">
    <div className="dashboard-y-axis"><span>{compactMoney.format(max / 100)}</span><span>{compactMoney.format(max / 200)}</span><span>R$ 0</span></div>
    <div className="chart dashboard-chart" onPointerMove={selectNearest} onPointerLeave={() => setActiveIndex(null)}>
      <svg viewBox={`0 0 ${width} 230`} preserveAspectRatio="none" role="img" aria-label="Evolução da receita confirmada no período">
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7357e9" stopOpacity=".28"/><stop offset="1" stopColor="#7357e9" stopOpacity="0"/></linearGradient></defs>
        <g className="gridlines dashboard-gridlines">{ticks.map(item => <line key={item.date} x1={item.x} y1={top} x2={item.x} y2={bottom}/>)}</g>
        {area && <path d={area} fill={`url(#${gradientId})`}/>}<path className="line dashboard-smooth-line" d={smoothPath} fill="none"/>
        {active && <g className="chart-active-marker"><line x1={active.x} y1={top} x2={active.x} y2={bottom}/><circle cx={active.x} cy={active.y} r="6"/></g>}
        {coordinates.map((item, index) => <circle key={item.date} className="chart-hit-point" cx={item.x} cy={item.y} r="10" tabIndex={index === Math.min(keyboardIndex, coordinates.length - 1) ? 0 : -1} onKeyDown={event => moveFocus(event, index)} onFocus={() => { setActiveIndex(index); setKeyboardIndex(index); }} onBlur={() => setActiveIndex(null)}><title>{`${item.date}: ${money.format(item.revenueCents / 100)} · ${item.paidOrders} pedidos. Use as setas para explorar.`}</title></circle>)}
      </svg>
      {active && <div className={`dashboard-chart-tooltip ${activeIndex === 0 ? 'edge-left' : activeIndex === coordinates.length - 1 ? 'edge-right' : ''}`} style={{ left: `${(active.x / width) * 100}%`, top: `${(active.y / 230) * 100}%` }} role="status"><b>Dia: {active.date.slice(8, 10)}/{active.date.slice(5, 7)}</b><span>Receita: {money.format(active.revenueCents / 100)}</span><small>{active.paidOrders} {active.paidOrders === 1 ? 'pedido pago' : 'pedidos pagos'}</small></div>}
      <div className="x-labels">{ticks.map((item, index) => <span key={item.date} style={{ position: 'absolute', left: `${item.x / width * 100}%`, transform: index === 0 ? 'none' : index === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{item.date.slice(8, 10)}/{item.date.slice(5, 7)}</span>)}</div>
    </div>
  </div>;
}
