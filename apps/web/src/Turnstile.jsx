import { useEffect, useRef } from 'react';

export const turnstileEnabled = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
let loader;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-solid-turnstile]');
    const script = existing || document.createElement('script');
    const timeout = window.setTimeout(() => reject(new Error('Turnstile timeout')), 10_000);
    const ready = () => { window.clearTimeout(timeout); window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable')); };
    script.addEventListener('load', ready, { once: true });
    script.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error('Turnstile unavailable')); }, { once: true });
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.defer = true; script.dataset.solidTurnstile = 'true';
      document.head.appendChild(script);
    }
  });
  return loader;
}

export default function Turnstile({ action, onToken, resetKey = 0 }) {
  const container = useRef(null);
  useEffect(() => {
    if (!turnstileEnabled || !container.current) return undefined;
    let active = true; let widgetId;
    onToken('');
    loadTurnstile().then(api => {
      if (!active || !container.current) return;
      widgetId = api.render(container.current, { sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY, action, theme: 'light', size: 'flexible', callback: token => onToken(token), 'expired-callback': () => onToken(''), 'error-callback': () => onToken('') });
    }).catch(() => onToken(''));
    return () => { active = false; if (widgetId !== undefined && window.turnstile) window.turnstile.remove(widgetId); };
  }, [action, onToken, resetKey]);
  if (!turnstileEnabled) return null;
  return <div className="turnstile-wrap"><div ref={container}/><small>Verificação protegida pela Cloudflare</small></div>;
}
