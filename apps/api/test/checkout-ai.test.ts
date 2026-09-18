import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository, SessionUser } from '../src/auth-repository.js';
import type { CatalogRepository } from '../src/catalog-repository.js';
import { buildApp } from '../src/app.js';
import { hashToken } from '../src/admin-access.js';
import { designPatch, generateCheckoutDesign, parseCheckoutIdea, referenceImage } from '../src/checkout-ai.js';

const environment: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', TRUST_PROXY: false, CORS_ORIGINS: ['http://localhost:5173'], GEMINI_API_KEY: 'test-key' };
const actor: SessionUser = { sessionId: 'session', userId: 'merchant', csrfTokenHash: hashToken('csrf'), user: { publicId: 'user', name: 'Private Name', email: 'private@example.com' }, expiresAt: new Date(Date.now() + 3600000), absoluteExpiresAt: new Date(Date.now() + 3600000) };
const headers = { cookie: 'solid_session=valid; solid_csrf=csrf', origin: 'http://localhost:5173', 'x-csrf-token': 'csrf' };
const design = { primary: '#111111', pageBg: '#ffffff', cardBg: '#ffffff', headerBg: '#ffffff', textColor: '#111111', pageTextColor: '#111111', headerTextColor: '#111111', buttonTextColor: '#ffffff', borderColor: '#dddddd', inputBg: '#ffffff', logoText: 'Minha loja', title: 'Finalize seu pedido', subtitle: 'Confira seus dados para continuar.', buttonText: 'Gerar Pix', eyebrow: 'SEU PEDIDO', summaryTitle: 'Resumo', template: 'minimal', layout: 'split', font: 'Inter', radius: 12 };
const provider = (value: unknown = design, finishReason = 'STOP') => new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }] }));
const apps: ReturnType<typeof buildApp>[] = [];
function setup(role = 'OWNER') {
  const catalog = { resolveStoreContext: vi.fn().mockResolvedValue({ storeId: 'store', userId: 'merchant', sessionId: 'session', role }), getProduct: vi.fn().mockImplementation((_context, id) => Promise.resolve(id === 'mine' ? { checkoutTitle: 'Café da loja', active: true, priceCents: 900, privateField: 'do not send' } : null)), createCheckout: vi.fn(), listCheckouts: vi.fn() };
  const auth = { findActiveSession: vi.fn().mockResolvedValue(actor) };
  const app = buildApp(environment, { authRepository: auth as unknown as AuthRepository, catalogRepository: catalog as unknown as CatalogRepository });
  apps.push(app); return { app, catalog };
}
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); await Promise.all(apps.splice(0).map(app => app.close())); });

describe('checkout AI drafts', () => {
  const brief = { template: 'retail', brand: 'Aurora', logoUrl: 'https://cdn.example.com/logo.webp', heroImageUrl: 'https://cdn.example.com/banner.webp', heroMobileImageUrl: '', summaryBannerUrl: '', fidelity: 'close', layout: 'auto', progressStyle: 'chevrons', showProgress: true, showCoupon: false, showSummary: true, socialProofEnabled: true };
  it('honors explicit brand, structure, assets and features instead of model guesses', async () => {
    const fetch = vi.fn().mockResolvedValue(provider()); vi.stubGlobal('fetch', fetch);
    const idea = parseCheckoutIdea({ prompt: 'Minha loja', brief });
    expect(idea).not.toBeNull();
    const config = await generateCheckoutDesign(environment, idea!, undefined, undefined, new AbortController().signal);
    expect(config).toMatchObject({ template: 'retail', layout: 'split', logoText: 'Aurora', logoUrl: brief.logoUrl, heroEnabled: true, heroImageUrl: brief.heroImageUrl, progressStyle: 'chevrons', showCoupon: false, socialProofEnabled: true, socialProofPreviewMessages: '', testimonials: [] });
    const body = (fetch.mock.calls[0] as [string, RequestInit])[1].body;
    expect(body).toContain('Aurora'); expect(body).not.toContain(brief.logoUrl); expect(body).not.toContain(brief.heroImageUrl);
  });
  it('validates guided options and preserves compatibility with earlier requests', () => {
    for (const patch of [{ logoUrl: 'javascript:alert(1)' }, { logoUrl: 'https://user:password@example.com/image' }, { socialProofEnabled: 'true' }, { template: 'unknown' }, { progressStyle: 'unknown' }, { heroImageUrl: '', heroMobileImageUrl: brief.heroImageUrl }, { customScript: 'bad' }, { brand: '' }]) {
      expect(parseCheckoutIdea({ prompt: 'Loja', brief: { ...brief, ...patch } })).toBeNull();
    }
    expect(parseCheckoutIdea({ prompt: 'Loja' })).not.toBeNull();
    for (const template of ['retail', 'marketplace']) expect(designPatch({ ...design, template, progressStyle: 'chevrons' })).toMatchObject({ template });
    expect(designPatch({ ...design, contentWidth: 5000 })).toBeNull();
  });
  it('requires auth, CSRF and store write access before generation', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const { app } = setup();
    expect((await app.inject({ method: 'POST', url: '/checkouts/ai/preview', payload: { prompt: 'Oi' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/checkouts/ai/preview', headers: { ...headers, 'x-csrf-token': 'bad' }, payload: { prompt: 'Oi' } })).statusCode).toBe(403);
    expect((await setup('ANALYST').app.inject({ method: 'POST', url: '/checkouts/ai/preview', headers, payload: { prompt: 'Oi' } })).statusCode).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects other-store products, arbitrary URLs, invalid images and extra context', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); const { app } = setup();
    expect((await app.inject({ method: 'POST', url: '/checkouts/ai/preview', headers, payload: { prompt: 'Café', productId: 'other' } })).statusCode).toBe(404);
    for (const extra of [{ reference: 'https://internal/secret' }, { reference: 'data:image/png;base64,YWJj' }, { storeId: 'other' }, { prompt: 'x'.repeat(2001) }, { testimonials: [{ name: 'A', text: 'B', rating: 100 }] }]) {
      expect((await app.inject({ method: 'POST', url: '/checkouts/ai/preview', headers, payload: { prompt: 'Café', ...extra } })).statusCode).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('returns only visual configuration, never creates a checkout or trusts generated commerce data', async () => {
    const fetch = vi.fn().mockResolvedValue(provider({ ...design, priceCents: 1, exitOfferCouponCode: 'FREE', testimonials: [{ name: 'Invented' }], logoUrl: 'https://evil.example', customElements: [{ type: 'video' }] })); vi.stubGlobal('fetch', fetch);
    const { app, catalog } = setup();
    const review = { name: 'Cliente real', text: 'Avaliação fornecida.', rating: 4 };
    const response = await app.inject({ method: 'POST', url: '/checkouts/ai/preview', headers, payload: { prompt: 'Visual para café', productId: 'mine', testimonials: [review] } });
    expect(response.statusCode).toBe(200);
    const config = response.json<{ config: Record<string, unknown> }>().config;
    expect(config.testimonials).toEqual([]);
    expect(config.customElements).toEqual([expect.objectContaining({ id: 'real-1', type: 'testimonial', title: review.name, text: review.text, rating: 4, enabled: true, region: 'main' })]);
    expect(config.priceCents).toBeUndefined(); expect(config.logoUrl).toBeUndefined(); expect(config.exitOfferEnabled).toBe(false);
    const call = fetch.mock.calls[0] as [string, RequestInit];
    expect(call[1].body).toContain('Café da loja');
    for (const sensitive of ['private@example.com', 'Private Name', 'Cliente real', 'Avaliação fornecida.', 'do not send']) expect(call[1].body).not.toContain(sensitive);
    expect(catalog.createCheckout).not.toHaveBeenCalled();
    expect(response.headers['cache-control']).toContain('no-store');
  });
  it('sends only a re-encoded inline image, without persistence or reference URLs in output', async () => {
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const inline = await referenceImage(`data:image/png;base64,${png.toString('base64')}`);
    expect((await sharp(Buffer.from(inline, 'base64')).metadata()).format).toBe('jpeg');
    const fetch = vi.fn().mockResolvedValue(provider()); vi.stubGlobal('fetch', fetch);
    const config = await generateCheckoutDesign(environment, { prompt: 'Use as cores', testimonials: [] }, undefined, inline, new AbortController().signal);
    const call = fetch.mock.calls[0] as [string, RequestInit];
    expect(call[1].body).toContain('inlineData'); expect(call[1].body).toContain('image/jpeg');
    expect(config.testimonials).toEqual([]); expect(config.showTrust).toBe(false);
    expect(JSON.stringify(config)).not.toContain(inline);
  });
  it('rejects malformed output and sanitizes upstream failures', async () => {
    expect(designPatch({ ...design, primary: 'javascript:bad' })).toBeNull();
    expect(designPatch({ ...design, title: '<script>bad</script>' })).toBeNull();
    expect(parseCheckoutIdea({ prompt: 'test', current: { primary: 'red' } })).toBeNull();
    const fetch = vi.fn().mockResolvedValue(provider({}, 'MAX_TOKENS')); vi.stubGlobal('fetch', fetch);
    await expect(generateCheckoutDesign(environment, { prompt: 'test', testimonials: [] }, undefined, undefined, new AbortController().signal)).rejects.toThrow('Assistant unavailable');
    fetch.mockResolvedValue(new Response('secret diagnostics', { status: 429 }));
    const response = await setup().app.inject({ method: 'POST', url: '/checkouts/ai/preview', headers, payload: { prompt: 'test' } });
    expect(response.statusCode).toBe(503); expect(response.body).not.toContain('secret diagnostics');
  });
  it('limits generation per account', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(provider())); vi.stubGlobal('fetch', fetch);
    const { app } = setup();
    for (let i = 0; i < 10; i++) expect((await app.inject({ method: 'POST', url: '/checkouts/ai/preview', headers, payload: { prompt: 'test' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/checkouts/ai/preview', headers, payload: { prompt: 'test' } })).statusCode).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(10);
  });
  it('recovers a transient provider failure once without repeating permanent errors', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(provider());
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    expect((await generateCheckoutDesign(environment, { prompt: 'test', testimonials: [] }, undefined, undefined, signal)).logoText).toBe('Minha loja');
    expect(fetch).toHaveBeenCalledTimes(2);
    fetch.mockReset().mockResolvedValue(new Response('', { status: 429 }));
    await expect(generateCheckoutDesign(environment, { prompt: 'test', testimonials: [] }, undefined, undefined, signal)).rejects.toMatchObject({ reason: 'quota' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('reports the shared deadline without restarting and cancels during retry backoff', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => AbortSignal.abort(new DOMException('Slow provider', 'TimeoutError')));
    const fetch = vi.fn().mockRejectedValue(new DOMException('Slow provider', 'TimeoutError'));
    vi.stubGlobal('fetch', fetch);
    await expect(generateCheckoutDesign(environment, { prompt: 'test', testimonials: [] }, undefined, undefined, new AbortController().signal)).rejects.toMatchObject({ reason: 'timeout' });
    expect(fetch).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    const controller = new AbortController();
    fetch.mockReset().mockRejectedValue(new TypeError('Connection lost'));
    const pending = generateCheckoutDesign(environment, { prompt: 'test', testimonials: [] }, undefined, undefined, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await new Promise(resolve => setTimeout(resolve, 10));
    controller.abort(); await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('accepts a generation slower than 20 seconds without starting it again', async () => {
    vi.useFakeTimers();
    const timeoutController = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      setTimeout(() => timeoutController.abort(), ms);
      return timeoutController.signal;
    });
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      setTimeout(() => resolve(provider()), 30_000);
      init.signal!.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetch);
    try {
      const pending = generateCheckoutDesign(environment, { prompt: 'test', testimonials: [] }, undefined, undefined, new AbortController().signal);
      await vi.advanceTimersByTimeAsync(30_000);
      expect((await pending).logoText).toBe('Minha loja');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(timeout).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
  it('passes cancellation to the provider', async () => {
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    const pending = generateCheckoutDesign(environment, { prompt: 'test', testimonials: [] }, undefined, undefined, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await rejected;
  });
});
