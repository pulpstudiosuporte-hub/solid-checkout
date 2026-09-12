import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getPublicExitOffer } from './api';
import './exit-offer.css';

import { exitOfferDefaults } from './exit-offer-config';

export function offerLabel(offer) {
  return offer.type === 'PERCENT' && !offer.capped ? `${offer.value / 100}% OFF` : `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(offer.couponDiscountCents / 100)} OFF`;
}
function buttonTextColor(hex) {
  const channels = hex.match(/[\da-f]{2}/gi)?.map(value => parseInt(value, 16) / 255) || [1, 1, 1];
  const [r, g, b] = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return r * 0.2126 + g * 0.7152 + b * 0.0722 > 0.179 ? '#171717' : '#ffffff';
}
export function ExitOfferDialog({ config, offer, onAccept, onClose, busy = false, error = '', preview = false }) {
  const dialog = useRef(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const element = dialog.current; const previous = document.activeElement; element.showModal(); const timer = setInterval(() => setNow(Date.now()), 1000); return () => { clearInterval(timer); element.close(); previous?.focus?.(); }; }, []);
  const remaining = Math.max(0, Math.ceil((new Date(offer.expiresAt).getTime() - now) / 1000));
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  const c = { ...exitOfferDefaults, ...config };
  return <dialog ref={dialog} className="exit-offer-dialog" aria-labelledby="exit-offer-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} style={{ '--offer-accent': c.exitOfferAccent, '--offer-bg': c.exitOfferBackground, '--offer-text': c.exitOfferTextColor, '--offer-button-text': buttonTextColor(c.exitOfferAccent) }}>
    <button type="button" className="exit-offer-close" aria-label="Fechar oferta" disabled={busy} onClick={onClose}><X size={24}/></button>
    {preview && <p className="exit-offer-preview">PRÉVIA · nenhum desconto será aplicado</p>}
    <h2 id="exit-offer-title">{c.exitOfferTitle}</h2><strong className="exit-offer-discount">{offerLabel(offer)}</strong>
    {c.exitOfferCountdown && <div className="exit-offer-timer"><p>{remaining ? 'OFERTA DISPONÍVEL POR' : 'OFERTA ENCERRADA'}</p><div aria-label={`${minutes} minutos e ${seconds} segundos`} className="exit-offer-clock"><span>{minutes}</span><b aria-hidden="true">:</b><span>{seconds}</span></div><small>Validade do cupom ou desta sessão, o que terminar primeiro.</small></div>}
    <p className="exit-offer-caption">Desconto de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(offer.couponDiscountCents / 100)} nos produtos deste pedido.</p>
    {error && <p className="exit-offer-error" role="alert">{error}</p>}
    <button type="button" className="exit-offer-accept" disabled={busy || !remaining} onClick={onAccept}>{busy ? 'Aplicando desconto...' : !remaining ? 'Oferta encerrada' : c.exitOfferButtonText}</button>
    <button type="button" className="exit-offer-dismiss" disabled={busy} onClick={onClose}>{c.exitOfferDismissText}</button>
  </dialog>;
}

export default function ExitOffer({ config, sessionId, token, enabled, onApply }) {
  const [offer, setOffer] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const enabledRef = useRef(enabled); enabledRef.current = enabled;
  const shown = useRef(new Set());
  const startedAt = useRef(new Map());
  const code = config.exitOfferCouponCode;
  useEffect(() => {
    if (!config.exitOfferEnabled || !enabled || !sessionId || !code) return;
    const key = `solid-exit-offer:${sessionId}:${code}`;
    if (shown.current.has(key)) return;
    try { if (sessionStorage.getItem(key)) return; } catch { /* Storage may be disabled in private contexts. */ }
    const controller = new AbortController();
    if (!startedAt.current.has(key)) startedAt.current.set(key, Date.now());
    const started = startedAt.current.get(key);
    let attempted = false, peak = window.scrollY, previousPointer = null;
    const available = () => !controller.signal.aborted && enabledRef.current && document.visibilityState === 'visible' && !document.querySelector('dialog[open]');
    const show = async (delaySeconds) => {
      if (attempted || shown.current.has(key) || Date.now() - started < delaySeconds * 1000 || !available()) return;
      attempted = true;
      try {
        const result = await getPublicExitOffer(sessionId, token, controller.signal);
        if (result.offer && !available()) { attempted = false; return; }
        if (result.offer) {
          shown.current.add(key);
          try { sessionStorage.setItem(key, 'shown'); } catch { /* The in-memory guard still prevents repeats on this page. */ }
          setError(''); setOffer(result.offer);
        }
      } catch { /* An unavailable offer must never interrupt checkout. */ }
    };
    const showOnExit = () => void show(config.exitOfferDelaySeconds ?? 10);
    const leave = event => { if (event.clientY <= 8 && window.matchMedia('(pointer: fine)').matches) showOnExit(); };
    // Anticipate the browser's Back control while the pointer is still in the page.
    const nearBack = point => point.x <= Math.min(200, window.innerWidth * 0.35) && point.y <= 100;
    const move = event => {
      const point = { x: event.clientX, y: event.clientY };
      if (window.matchMedia('(pointer: fine)').matches && previousPointer) {
        const approachingBack = nearBack(point) && !nearBack(previousPointer)
          && (point.y < previousPointer.y || point.x < previousPointer.x);
        const approachingTop = previousPointer.y > 24 && point.y <= 24;
        if (approachingBack || approachingTop) showOnExit();
      }
      previousPointer = point;
    };
    const scroll = () => { peak = Math.max(peak, window.scrollY); if (config.exitOfferMobile !== false && window.matchMedia('(pointer: coarse)').matches && peak > 250 && window.scrollY < 80) showOnExit(); };
    // Keep checking so a deadline reached during another dialog or operation is not lost.
    const timer = config.exitOfferTimedEnabled !== false
      ? window.setInterval(() => void show(config.exitOfferTimedSeconds ?? 30), 1000)
      : null;
    document.addEventListener('pointermove', move, { passive: true }); document.documentElement.addEventListener('mouseleave', leave); window.addEventListener('scroll', scroll, { passive: true });
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('pointermove', move); document.documentElement.removeEventListener('mouseleave', leave); window.removeEventListener('scroll', scroll); };
  }, [config.exitOfferEnabled, config.exitOfferDelaySeconds, config.exitOfferTimedEnabled, config.exitOfferTimedSeconds, config.exitOfferMobile, code, sessionId, token, enabled]);
  if (!offer || (!enabled && !busy)) return null;
  const apply = async () => { setBusy(true); setError(''); try { await onApply(offer.code); setOffer(null); } catch (cause) { setError(cause.message || 'Não foi possível aplicar o desconto.'); } finally { setBusy(false); } };
  return <ExitOfferDialog config={config} offer={offer} busy={busy} error={error} onAccept={() => void apply()} onClose={() => setOffer(null)}/>;
}
