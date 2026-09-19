import land from './globe-land';

const TAU = Math.PI * 2;
const point = (lat, lng) => {
  const a = lat * Math.PI / 180, b = lng * Math.PI / 180;
  return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
};
// Decorative routes; these do not represent customer locations or live orders.
const locations = [[-23.5, -46.6], [40.7, -74], [38.7, -9.1], [6.5, 3.4], [25.2, 55.3], [1.3, 103.8], [-33.9, 151.2]].map(([a, b]) => point(a, b));
const routes = [[0, 1], [0, 2], [0, 3], [2, 4], [4, 5], [5, 6]];
const arcs = routes.map(([a, b]) => {
  const start = locations[a], end = locations[b];
  const angle = Math.acos(Math.min(1, start.reduce((sum, v, i) => sum + v * end[i], 0)));
  return Array.from({ length: 65 }, (_, i) => {
    const t = i / 64, radius = 1.015 + Math.sin(t * Math.PI) * .27;
    return start.map((v, j) => (v * Math.sin((1 - t) * angle) + end[j] * Math.sin(t * angle)) / Math.sin(angle) * radius);
  });
});

export function mountGlobe(canvas, host, initialRunning) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  let width = 1, height = 1, yaw = .7, tilt = -.16, time = 0;
  let running = initialRunning, frame = 0, last = 0, disposed = false, drag = null;
  const project = ([x, y, z]) => {
    const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
    const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
    return [rx, y * Math.cos(tilt) - rz * Math.sin(tilt), y * Math.sin(tilt) + rz * Math.cos(tilt)];
  };
  const draw = () => {
    if (disposed) return;
    const r = Math.min(width, height) * .365, cx = width / 2, cy = height / 2;
    ctx.clearRect(0, 0, width, height);
    const halo = ctx.createRadialGradient(cx, cy, r * .8, cx, cy, r * 1.35);
    halo.addColorStop(0, '#f4b94200'); halo.addColorStop(.52, '#f4b94218'); halo.addColorStop(1, '#f4b94200');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
    const sphere = ctx.createRadialGradient(cx - r * .4, cy - r * .5, 0, cx, cy, r);
    sphere.addColorStop(0, '#37252e'); sphere.addColorStop(.7, '#170f17'); sphere.addColorStop(1, '#09080e');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = sphere; ctx.fill();
    ctx.strokeStyle = '#ffdc8635'; ctx.lineWidth = 1; ctx.stroke();
    // Surface points are depth shaded and the back hemisphere is occluded.
    for (const p of land) {
      const [x, y, z] = project(p);
      if (z < 0) continue;
      ctx.beginPath(); ctx.arc(cx + x * r, cy - y * r, Math.max(.65, width / 530) * (.65 + z * .45), 0, TAU);
      ctx.fillStyle = `rgba(255,213,143,${.19 + z * .66})`; ctx.fill();
    }
    const visible = p => p[2] >= 0 || p[0] ** 2 + p[1] ** 2 > 1.015;
    arcs.forEach((arc, index) => {
      ctx.beginPath(); let connected = false;
      for (const p of arc) {
        const v = project(p);
        if (!visible(v)) { connected = false; continue; }
        if (connected) ctx.lineTo(cx + v[0] * r, cy - v[1] * r);
        else ctx.moveTo(cx + v[0] * r, cy - v[1] * r);
        connected = true;
      }
      ctx.strokeStyle = '#ffbc2180'; ctx.lineWidth = width > 480 ? 1.1 : .85; ctx.stroke();
      const head = Math.floor(((time / 3.8 + index / 6) % 1) * 64);
      const v = project(arc[head]);
      if (!visible(v)) return;
      ctx.beginPath(); ctx.arc(cx + v[0] * r, cy - v[1] * r, 2.5, 0, TAU);
      ctx.shadowColor = '#ffbc21'; ctx.shadowBlur = 10; ctx.fillStyle = '#fff3c9'; ctx.fill(); ctx.shadowBlur = 0;
    });
    locations.forEach((p, index) => {
      const [x, y, z] = project(p);
      if (z < 0) return;
      const pulse = (time / 2 + index * .15) % 1;
      ctx.beginPath(); ctx.arc(cx + x * r, cy - y * r, 4 + pulse * 9, 0, TAU);
      ctx.strokeStyle = `rgba(255,188,33,${(1 - pulse) * .45})`; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + x * r, cy - y * r, 3, 0, TAU); ctx.fillStyle = '#ffca3a'; ctx.fill();
    });
  };
  const tick = now => {
    frame = 0;
    if (!running || disposed) return;
    if (!last || now - last >= 32) {
      const dt = last ? Math.min((now - last) / 1000, .1) : 0;
      last = now; time += dt;
      if (!drag) yaw += dt * .055;
      draw();
    }
    frame = requestAnimationFrame(tick);
  };
  const resize = () => {
    const rect = host.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  };
  const down = event => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, yaw };
    canvas.setPointerCapture(event.pointerId);
  };
  const move = event => { if (drag) { yaw = drag.yaw + (event.clientX - drag.x) / Math.max(width, 1) * 4; draw(); } };
  const up = () => { drag = null; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  if (running) frame = requestAnimationFrame(tick);
  return {
    setRunning(value) { running = value; last = 0; cancelAnimationFrame(frame); frame = value ? requestAnimationFrame(tick) : 0; },
    rotate(direction) { yaw += direction * .3; draw(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('lostpointercapture', up);
    },
  };
}
