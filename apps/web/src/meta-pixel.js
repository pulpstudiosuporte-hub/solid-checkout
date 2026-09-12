let scriptPromise;
const initialized = new Set();
const sent = new Set();

export function loadMetaPixel(pixelId) {
  if (!/^\d{5,32}$/.test(pixelId)) return Promise.reject(new Error('Pixel inválido'));
  if (!window.fbq) {
    const fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    fbq.queue = []; fbq.loaded = true; fbq.version = '2.0'; fbq.push = fbq;
    window.fbq = fbq; window._fbq ||= fbq;
  }
  if (!initialized.has(pixelId)) { window.fbq('init', pixelId); initialized.add(pixelId); }
  if (window.fbq.callMethod) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      const timeout = setTimeout(() => fail(), 10000);
      const fail = () => { clearTimeout(timeout); script.remove(); scriptPromise = undefined; reject(new Error('Pixel indisponível')); };
      script.onerror = fail;
      script.onload = () => { clearTimeout(timeout); resolve(); };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function trackMeta(pixelId, eventName, data = {}, eventId) {
  if (!window.fbq || !initialized.has(pixelId)) return;
  const key = eventId ? `solid-meta:${pixelId}:${eventId}` : '';
  if (key) {
    if (sent.has(key)) return;
    try { if (sessionStorage.getItem(key)) return; } catch { /* Restricted storage must not stop tracking or checkout. */ }
  }
  // Scope dispatch to the current store even if another Pixel was initialized.
  window.fbq('trackSingle', pixelId, eventName, data, eventId ? { eventID: eventId } : undefined);
  if (key) { sent.add(key); try { sessionStorage.setItem(key, '1'); } catch { /* Memory deduplication remains available. */ } }
}
