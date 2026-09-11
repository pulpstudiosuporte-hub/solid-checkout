import { describe, expect, it } from 'vitest';
import { googlePageLocation, startGoogleTracking } from '../src/google-tracking';

function fixture(mode = 'direct') {
  const storage = new Map();
  const scripts = [];
  const browser = { location: { origin: 'https://checkout.example.com' }, document: { createElement: () => ({ dataset: {} }), head: { appendChild: script => scripts.push(script) } }, sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } };
  const data = { scope: 'store-a', checkoutId: 'checkout-a', transactionId: 'order-a', purchase: false, orderValue: 99, config: { mode, measurementId: 'G-ABCDE12345', adsId: 'AW-1234567', conversionLabel: 'label_1', containerId: 'GTM-ABCDEF' }, ecommerce: { currency: 'BRL', value: 89, shipping: 10, items: [{ item_id: 'product-a', price: 89, quantity: 1 }] } };
  const commands = () => browser.dataLayer.filter(item => typeof item[0] === 'string').map(item => Array.from(item));
  return { browser, scripts, data, commands };
}

describe('Google checkout measurement', () => {
  it('initializes consent before config and loads one script for GA4 and Ads', () => {
    const f = fixture();
    const tracker = startGoogleTracking(f.data, f.browser);
    expect(startGoogleTracking(f.data, f.browser)).toBe(tracker);
    expect(f.scripts).toHaveLength(1);
    expect(f.scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-ABCDE12345');
    expect(f.commands()[0]).toEqual(['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
    const config = f.commands().find(item => item[0] === 'config');
    expect(config[2]).toMatchObject({ send_page_view: false, cookie_prefix: 'solid_store-a', cookie_domain: 'none', page_referrer: '' });
  });
  it('sends purchase only after confirmation, routes Ads separately and deduplicates', () => {
    const f = fixture(); const tracker = startGoogleTracking(f.data, f.browser);
    tracker.track('add_payment_info', f.data);
    expect(tracker.track('purchase', f.data)).toBe(false);
    expect(f.commands().filter(item => item[1] === 'conversion')).toHaveLength(0);
    const paid = { ...f.data, purchase: true };
    expect(tracker.track('purchase', paid)).toBe(true);
    expect(tracker.track('purchase', paid)).toBe(false);
    expect(f.commands().filter(item => item[1] === 'purchase')).toHaveLength(1);
    expect(f.commands().find(item => item[1] === 'purchase')[2]).toMatchObject({ transaction_id: 'order-a', value: 89, shipping: 10, send_to: 'G-ABCDE12345' });
    expect(f.commands().find(item => item[1] === 'conversion')[2]).toMatchObject({ transaction_id: 'order-a', value: 99, send_to: 'AW-1234567/label_1' });
  });
  it('does not mix stores or install another destination in the same document', () => {
    const f = fixture(); const tracker = startGoogleTracking(f.data, f.browser);
    expect(startGoogleTracking({ ...f.data, scope: 'store-b' }, f.browser)).toBeNull();
    expect(tracker.track('begin_checkout', { ...f.data, scope: 'store-b' })).toBe(false);
    expect(f.scripts).toHaveLength(1);
    tracker.stop();
    expect(tracker.track('begin_checkout', f.data)).toBe(false);
  });
  it('emits clean dataLayer ecommerce events for GTM without a second GA4 installation', () => {
    const f = fixture('gtm'); const tracker = startGoogleTracking(f.data, f.browser);
    tracker.track('purchase', { ...f.data, purchase: true });
    expect(f.scripts[0].src).toContain('/gtm.js?id=GTM-ABCDEF');
    expect(f.commands().filter(item => item[0] === 'config')).toHaveLength(0);
    expect(f.browser.dataLayer.slice(-2)).toEqual([{ ecommerce: null }, expect.objectContaining({ event: 'purchase', solid_store: 'store-a', ecommerce: expect.objectContaining({ transaction_id: 'order-a', value: 89 }) })]);
  });
  it('filters private query data and keeps working when storage is blocked', () => {
    const f = fixture();
    expect(googlePageLocation({ ...f.data, attribution: { gclid: 'click-id', token: 'secret', utm_term: 'user@example.com' } }, f.browser.location.origin)).toBe('https://checkout.example.com/checkout/checkout-a?gclid=click-id');
    f.browser.sessionStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    const tracker = startGoogleTracking(f.data, f.browser);
    expect(tracker.track('begin_checkout', f.data)).toBe(true);
    expect(tracker.track('begin_checkout', f.data)).toBe(false);
  });
});
