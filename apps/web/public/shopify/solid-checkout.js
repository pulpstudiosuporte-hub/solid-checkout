(() => {
  if (window.__solidCheckoutBridgeLoaded) return;
  window.__solidCheckoutBridgeLoaded = true;
  const script = document.querySelector('script[data-solid-checkout]');
  if (!script) return;
  const proxyPath = script.dataset.proxyPath || '/apps/solid-checkout/checkout-session';
  const payUrl = (script.dataset.payUrl || 'https://app.solidcheckout.xyz').replace(/\/$/, '');
  const nativeFallback = script.dataset.fallback !== 'false';
  let redirecting = false;

  const cartLines = async () => {
    const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart.js`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('cart_unavailable');
    const cart = await response.json();
    return (cart.items || []).map(item => ({ variantId: String(item.variant_id), quantity: item.quantity }));
  };
  const productLine = target => {
    const form = target.closest('form[action*="/cart/add"]') || document.querySelector('form[action*="/cart/add"]');
    if (!form) return [];
    const data = new FormData(form); const variantId = String(data.get('id') || ''); const quantity = Number(data.get('quantity') || 1);
    return /^\d+$/.test(variantId) ? [{ variantId, quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1 }] : [];
  };
  const start = async lines => {
    if (!proxyPath || lines.length === 0) throw new Error('solid_not_configured');
    const response = await fetch(proxyPath, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ lines }) });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.session?.publicId || !body?.token) throw new Error(body?.error?.code || 'session_failed');
    window.location.assign(`${payUrl}/#/session/${encodeURIComponent(body.session.publicId)}?token=${encodeURIComponent(body.token)}`);
  };
  const fallback = () => { redirecting = false; if (nativeFallback) window.location.assign('/checkout'); };
  const isCheckoutAction = target => Boolean(target.closest('[name="checkout"], a[href$="/checkout"], a[href*="/checkout?"], .shopify-payment-button__button'));
  document.addEventListener('click', async event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || redirecting || !isCheckoutAction(target)) return;
    event.preventDefault(); event.stopImmediatePropagation(); redirecting = true;
    try { await start(target.closest('.shopify-payment-button__button') ? productLine(target) : await cartLines()); }
    catch (error) { console.error('[SOLID Checkout]', error instanceof Error ? error.message : 'unexpected_error'); fallback(); }
  }, true);
  document.addEventListener('submit', async event => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form || redirecting || !form.querySelector('[name="checkout"]')) return;
    event.preventDefault(); event.stopImmediatePropagation(); redirecting = true;
    try { await start(await cartLines()); } catch (error) { console.error('[SOLID Checkout]', error instanceof Error ? error.message : 'unexpected_error'); fallback(); }
  }, true);
})();
