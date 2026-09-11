const consent = value => ({ analytics_storage: value, ad_storage: value, ad_user_data: value, ad_personalization: value });
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const runtimes = new WeakMap();

export function googlePageLocation(data, origin) {
  // Never use the session URL, checkout token, form contents or arbitrary query parameters.
  const url = new URL(`/checkout/${encodeURIComponent(data.checkoutId)}`, origin);
  for (const [key, value] of Object.entries(data.attribution || {})) {
    if (['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].includes(key) && typeof value === 'string' && /^[\p{L}\p{N}_ .~-]{1,200}$/u.test(value)) url.searchParams.set(key, value);
  }
  return url.href;
}

export function startGoogleTracking(data, browser = window) {
  const config = data.config;
  if (!config || !safeId(data.scope) || !safeId(data.checkoutId) || !safeId(data.transactionId)) return null;
  if (config.mode === 'gtm' ? !/^GTM-[A-Z0-9]{4,20}$/.test(config.containerId) : config.mode !== 'direct' || (!config.measurementId && !config.adsId) || (config.measurementId && !/^G-[A-Z0-9]{4,20}$/.test(config.measurementId)) || (config.adsId && (!/^AW-\d{5,20}$/.test(config.adsId) || !/^[A-Za-z0-9_-]{1,100}$/.test(config.conversionLabel)))) return null;
  const identity = JSON.stringify([data.scope, config.mode, config.measurementId, config.adsId, config.conversionLabel, config.containerId]);
  const existing = runtimes.get(browser);
  if (existing) {
    if (existing.identity !== identity) { existing.stop(); return null; }
    existing.resume();
    return existing;
  }
  browser.dataLayer = browser.dataLayer || [];
  const gtag = function () { browser.dataLayer.push(arguments); };
  browser.gtag = gtag;
  gtag('consent', 'default', consent('denied'));
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', false);
  gtag('consent', 'update', consent('granted'));
  const page = { page_location: googlePageLocation(data, browser.location.origin), page_referrer: '', page_title: 'Checkout' };
  gtag('set', page);
  const sent = new Set();
  let enabled = true;
  const storage = {
    get(key) { try { return browser.sessionStorage.getItem(key); } catch { return null; } },
    set(key) { try { browser.sessionStorage.setItem(key, '1'); } catch { /* Memory deduplication remains available. */ } },
  };
  const runtime = {
    identity,
    track(name, current) {
      if (!enabled || current.scope !== data.scope || !safeId(current.transactionId)) return false;
      if (!['page_view', 'view_item', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase'].includes(name)) return false;
      if (name === 'purchase' && current.purchase !== true) return false;
      const key = `solid-google-event:${identity}:${current.transactionId}:${name}`;
      if (sent.has(key) || storage.get(key)) return false;
      const ecommerce = current.ecommerce;
      if (!ecommerce || !Number.isFinite(ecommerce.value) || ecommerce.value < 0 || !/^[A-Z]{3}$/.test(ecommerce.currency) || !Array.isArray(ecommerce.items)) return false;
      const parameters = { ...page, page_location: googlePageLocation(current, browser.location.origin), ...(name === 'page_view' ? {} : ecommerce), ...(name === 'purchase' ? { transaction_id: current.transactionId } : {}), ...(name === 'add_payment_info' ? { payment_type: 'Pix' } : {}) };
      if (config.mode === 'gtm') {
        browser.dataLayer.push({ ecommerce: null });
        browser.dataLayer.push({ event: name, solid_store: data.scope, solid_page_location: parameters.page_location, solid_page_title: 'Checkout', solid_page_referrer: '', ecommerce: name === 'page_view' ? undefined : { ...ecommerce, ...(name === 'purchase' ? { transaction_id: current.transactionId } : {}), ...(name === 'add_payment_info' ? { payment_type: 'Pix' } : {}) } });
      } else {
        if (config.measurementId) gtag('event', name, { ...parameters, send_to: config.measurementId });
        if (name === 'purchase' && config.adsId) gtag('event', 'conversion', { ...page, send_to: `${config.adsId}/${config.conversionLabel}`, transaction_id: current.transactionId, value: current.orderValue, currency: ecommerce.currency });
      }
      sent.add(key); storage.set(key);
      return true;
    },
    resume() { if (!enabled) { enabled = true; if (config.measurementId) browser[`ga-disable-${config.measurementId}`] = false; gtag('consent', 'update', consent('granted')); } },
    stop() { enabled = false; if (config.measurementId) browser[`ga-disable-${config.measurementId}`] = true; gtag('consent', 'update', consent('denied')); },
  };
  const script = browser.document.createElement('script');
  script.async = true;
  script.referrerPolicy = 'origin';
  script.dataset.solidGoogle = 'true';
  if (config.mode === 'gtm') {
    browser.dataLayer.push({ solid_consent: consent('granted'), ...page });
    browser.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    script.src = `https://www.googletagmanager.com/gtm.js?id=${config.containerId}`;
  } else {
    gtag('js', new Date());
    const settings = { ...page, send_page_view: false, cookie_prefix: `solid_${data.scope}`, cookie_domain: 'none', cookie_path: '/', allow_google_signals: false, allow_ad_personalization_signals: false };
    if (config.measurementId) gtag('config', config.measurementId, settings);
    if (config.adsId) gtag('config', config.adsId, settings);
    script.src = `https://www.googletagmanager.com/gtag/js?id=${config.measurementId || config.adsId}`;
  }
  browser.document.head.appendChild(script);
  runtimes.set(browser, runtime);
  return runtime;
}
