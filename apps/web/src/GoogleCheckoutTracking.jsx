import { useEffect, useRef, useState } from 'react';
import { getPublicGoogleConfig } from './api';
import { startGoogleTracking } from './google-tracking';
import './google-consent.css';

export default function GoogleCheckoutTracking(props) {
  return <GoogleCheckoutSession key={props.sessionId} {...props}/>;
}

function GoogleCheckoutSession({ sessionId, token, paymentStatus, shippingSelected, paymentCreated, checkoutRevision }) {
  const [data, setData] = useState(null);
  const [choice, setChoice] = useState(null);
  const [open, setOpen] = useState(false);
  const runtime = useRef(null);
  const loadedScope = useRef(null);
  useEffect(() => () => runtime.current?.stop(), []);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    getPublicGoogleConfig(sessionId, token, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setData(value.config ? value : null);
      if (value.scope && loadedScope.current !== value.scope) {
        loadedScope.current = value.scope;
        let saved = null;
        try {
          const stored = JSON.parse(localStorage.getItem(`solid-google-consent:${value.scope}`) || 'null');
          if (stored?.version === 1 && Date.now() - stored.at < 180 * 86400000 && ['accepted', 'declined'].includes(stored.choice)) saved = stored.choice;
        } catch { /* Ask again when storage is unavailable. */ }
        setChoice(saved); setOpen(!saved);
      }
    }).catch(() => { /* Measurement must never block checkout. */ });
    return () => controller.abort();
  }, [sessionId, token, paymentStatus, shippingSelected, paymentCreated, checkoutRevision]);
  useEffect(() => {
    if (!data || choice !== 'accepted') return;
    try {
      runtime.current = startGoogleTracking(data);
      const tracker = runtime.current;
      if (!tracker) return;
      tracker.track('page_view', data);
      tracker.track('view_item', data);
      tracker.track('begin_checkout', data);
      if (shippingSelected) tracker.track('add_shipping_info', data);
      if (paymentCreated) tracker.track('add_payment_info', data);
      if (data.purchase) tracker.track('purchase', data);
    } catch { /* Optional tags must not interrupt payment. */ }
  }, [data, choice, shippingSelected, paymentCreated]);
  const choose = next => {
    if (!data) return;
    try { localStorage.setItem(`solid-google-consent:${data.scope}`, JSON.stringify({ version: 1, choice: next, at: Date.now() })); } catch { /* The choice still applies for this page. */ }
    setChoice(next); setOpen(false);
    if (next === 'declined' && runtime.current) {
      runtime.current.stop();
      // GTM can install listeners: a reload removes them and prevents tags loading again.
      window.location.reload();
    }
  };
  if (!data) return null;
  return <div className="google-checkout-consent">
    {open ? <section className="google-consent-panel" aria-label="Preferências de cookies"><div><strong>Cookies de medição</strong><p>Permitir que esta loja use o Google para medir visitas, campanhas e compras? Você pode comprar sem aceitar.</p></div><div className="google-consent-actions"><button type="button" onClick={() => choose('declined')}>Só essenciais</button><button type="button" onClick={() => choose('accepted')}>Aceitar medição</button></div></section> : <button className="google-consent-preferences" type="button" onClick={() => setOpen(true)}>Preferências de cookies</button>}
  </div>;
}
