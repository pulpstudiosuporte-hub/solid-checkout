import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import { buildApp } from '../src/app.js';
import type { AuthRepository, LoginUser, SessionUser } from '../src/auth-repository.js';
import type { CatalogRepository, CheckoutInput, CheckoutSessionInput, ProductInput, ShopifyCartSessionInput, StoreContext } from '../src/catalog-repository.js';

const origin = 'http://localhost:5173';
const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: [origin], TRUST_PROXY: false };
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const sessionToken = 'opaque-session'; const csrfToken = 'csrf-token';

class MemoryAuth implements AuthRepository {
  findUserByEmail(): Promise<LoginUser | null> { return Promise.resolve(null); }
  createSession(): Promise<void> { return Promise.resolve(); }
  findActiveSession(tokenHash: string): Promise<SessionUser | null> { return Promise.resolve(tokenHash === sha256(sessionToken) ? { sessionId: 'session-a', userId: 'user-a', csrfTokenHash: sha256(csrfToken), expiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000), user: { publicId: 'public-user-a', name: 'Owner', email: 'owner@example.com' } } : null); }
  touchSession(): Promise<void> { return Promise.resolve(); }
  revokeSession(): Promise<void> { return Promise.resolve(); }
  updatePasswordAndRevokeOtherSessions(): Promise<void> { return Promise.resolve(); }
}

class MemoryCatalog implements CatalogRepository {
  domainActive = true;
  hasActiveDomain(): Promise<boolean> { return Promise.resolve(this.domainActive); }
  paidDigitalDelivery: { title: string; url: string } | null = null;
  shippingMethods = [{ publicId: 'shipping-a', name: 'Entrega padrão', priceCents: 1290, minDays: 3, maxDays: 5, active: true, position: 0 }];
  listShippingMethods(): Promise<readonly object[]> { return Promise.resolve(this.shippingMethods); }
  createShippingMethod(_context: StoreContext, input: { name: string; priceCents: number; minDays: number; maxDays: number; active: boolean }): Promise<object> { const method = { publicId: 'shipping-new', ...input, position: this.shippingMethods.length }; this.shippingMethods.push(method); return Promise.resolve(method); }
  updateShippingMethod(_context: StoreContext, publicId: string, input: { name: string; priceCents: number; minDays: number; maxDays: number; active: boolean }): Promise<object | null> { return Promise.resolve(publicId === 'shipping-a' ? { publicId, ...input, position: 0 } : null); }
  deleteShippingMethod(_context: StoreContext, publicId: string): Promise<boolean> { return Promise.resolve(publicId === 'shipping-a'); }
  listPublicShippingMethods(publicId: string, tokenHash: string): Promise<readonly object[] | null> { return Promise.resolve(publicId === 'session-a' && tokenHash ? this.shippingMethods.filter(item => item.active) : null); }
  selectPublicShippingMethod(publicId: string, tokenHash: string, methodPublicId: string): Promise<object | null> { const method = this.shippingMethods.find(item => item.publicId === methodPublicId && item.active); return Promise.resolve(publicId === 'session-a' && tokenHash && method ? { shippingMethod: method, subtotalCents: 9900, shippingPriceCents: method.priceCents, grandTotalCents: 9900 + method.priceCents } : null); }
  setPublicOrderBump(publicId: string, tokenHash: string, productPublicId: string, enabled: boolean): Promise<object | null> { return Promise.resolve(publicId === 'session-a' && tokenHash && productPublicId === 'product-a' ? { totalCents: enabled ? 14900 : 9900, shippingPriceCents: 0, grandTotalCents: enabled ? 14900 : 9900, enabled } : null); }
  role: StoreContext['role'] = 'OWNER';
  products: Array<{ publicId: string; storeId: string; checkoutTitle: string; priceCents: number; [key: string]: unknown }> = [{ publicId: 'product-a', storeId: 'store-a', checkoutTitle: 'Produto A', priceCents: 9900 }, { publicId: 'product-b', storeId: 'store-b', checkoutTitle: 'Produto B', priceCents: 5000 }];
  checkouts: Array<Record<string, unknown>> = [];
  resolveStoreContext(userId: string, sessionId: string): Promise<StoreContext | null> { return Promise.resolve({ userId, sessionId, storeId: 'store-a', role: this.role }); }
  listProducts(context: StoreContext) { const items = this.products.filter(product => product.storeId === context.storeId); return Promise.resolve({ items, total: items.length }); }
  getProduct(context: StoreContext, publicId: string) { return Promise.resolve(this.products.find(product => product.storeId === context.storeId && product.publicId === publicId) ?? null); }
  createProduct(context: StoreContext, input: ProductInput): Promise<object> { const product = { publicId: 'new-product', storeId: context.storeId, checkoutTitle: input.title, ...input }; this.products.push(product); return Promise.resolve(product); }
  deleteManualProduct(context: StoreContext, publicId: string): Promise<'deleted' | 'archived' | 'not_found'> { const index = this.products.findIndex(product => product.storeId === context.storeId && product.publicId === publicId); if (index < 0) return Promise.resolve('not_found'); this.products.splice(index, 1); return Promise.resolve('deleted'); }
  listCheckouts(context: StoreContext): Promise<readonly object[]> { return Promise.resolve(this.checkouts.filter(checkout => checkout.storeId === context.storeId)); }
  createCheckout(context: StoreContext, input: CheckoutInput): Promise<object | 'limit_reached' | null> { if (input.mode === 'DIRECT_LINK' && !this.products.some(product => product.publicId === input.productPublicId && product.storeId === context.storeId)) return Promise.resolve(null); const checkout = { publicId: `new-checkout-${this.checkouts.length + 1}`, storeId: context.storeId, ...input }; this.checkouts.push(checkout); return Promise.resolve(checkout); }
  deleteCheckout(context: StoreContext, publicId: string): Promise<'deleted' | 'archived' | 'not_found'> { const index = this.checkouts.findIndex(checkout => checkout.storeId === context.storeId && checkout.publicId === publicId); if (index < 0) return Promise.resolve('not_found'); this.checkouts.splice(index, 1); return Promise.resolve('deleted'); }
  updateCheckoutDraft(context: StoreContext, publicId: string, config: Record<string, unknown>): Promise<object | null> { const checkout = this.checkouts.find(item => item.storeId === context.storeId && item.publicId === publicId); if (checkout) checkout.draftConfig = config; return Promise.resolve(checkout ?? null); }
  publishCheckout(context: StoreContext, publicId: string): Promise<object | null> { const checkout = this.checkouts.find(item => item.storeId === context.storeId && item.publicId === publicId); if (checkout) checkout.status = 'PUBLISHED'; return Promise.resolve(checkout ?? null); }
  getPublicCheckout(storeSlug: string, checkoutSlug: string): Promise<object | null> { return Promise.resolve(storeSlug === 'store-a' && checkoutSlug === 'checkout-a' ? { slug: checkoutSlug, product: this.products[0] } : null); }
  createPublicCheckoutSession(input: CheckoutSessionInput): Promise<object | null> { return Promise.resolve(input.storeSlug === 'store-a' && input.checkoutSlug === 'checkout-a' ? { publicId: 'session-a', totalCents: 9900 * input.quantity } : null); }
  getPublicCheckoutSession(publicId: string, tokenHash: string): Promise<object | null> { return Promise.resolve(publicId === 'session-a' && tokenHash ? { publicId, totalCents: 9900 } : null); }
  getPaidDigitalDelivery(publicId: string, tokenHash: string): Promise<object | null> { return Promise.resolve(publicId === 'session-a' && tokenHash && this.paidDigitalDelivery ? this.paidDigitalDelivery : null); }
  createShopifyCartSession(input: ShopifyCartSessionInput): Promise<object | null> { return Promise.resolve(input.shopDomain === 'store-a.myshopify.com' ? { publicId: 'shopify-session', totalCents: 9900 } : null); }
  updatePublicCheckoutCustomer(publicId: string, tokenHash: string): Promise<object | null> { return Promise.resolve(publicId === 'session-a' && tokenHash ? { customerCaptured: true, shippingCaptured: false } : null); }
  updatePublicCheckoutShipping(publicId: string, tokenHash: string): Promise<object | null> { return Promise.resolve(publicId === 'session-a' && tokenHash ? { customerCaptured: true, shippingCaptured: true } : null); }
}

const authenticatedHeaders = { origin, cookie: `solid_session=${sessionToken}; solid_csrf=${csrfToken}`, 'x-csrf-token': csrfToken };

describe('catálogo isolado por loja', () => {
  it('exige sessão e lista somente registros da loja autorizada', async () => {
    const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: new MemoryCatalog() });
    expect((await app.inject({ method: 'GET', url: '/products' })).statusCode).toBe(401);
    const response = await app.inject({ method: 'GET', url: '/products', headers: { cookie: `solid_session=${sessionToken}` } });
    expect(response.statusCode).toBe(200); expect(response.json<{ items: Array<{ storeId: string }> }>().items).toHaveLength(1); expect(response.json<{ items: Array<{ storeId: string }> }>().items[0]?.storeId).toBe('store-a');
    expect((await app.inject({ method: 'GET', url: '/products/product-a', headers: { cookie: `solid_session=${sessionToken}` } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/products/product-b', headers: { cookie: `solid_session=${sessionToken}` } })).statusCode).toBe(404);
    await app.close();
  });

  it('exige CSRF e grava valores monetários em centavos', async () => {
    const catalog = new MemoryCatalog(); const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: catalog });
    const payload = { title: 'Produto Seguro', priceCents: 14990, compareAtCents: 19990 };
    expect((await app.inject({ method: 'POST', url: '/products', headers: { cookie: `solid_session=${sessionToken}` }, payload })).statusCode).toBe(403);
    const response = await app.inject({ method: 'POST', url: '/products', headers: authenticatedHeaders, payload });
    expect(response.statusCode).toBe(201); expect(response.json<{ product: { storeId: string; priceCents: number } }>().product).toMatchObject({ storeId: 'store-a', priceCents: 14990 });
    await app.close();
  });

  it('aceita infoproduto apenas com link externo HTTPS', async () => {
    const catalog = new MemoryCatalog(); const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: catalog });
    const missingLink = await app.inject({ method: 'POST', url: '/products', headers: authenticatedHeaders, payload: { title: 'Curso SOLID', priceCents: 9900, fulfillmentType: 'DIGITAL' } });
    expect(missingLink.statusCode).toBe(400);
    const response = await app.inject({ method: 'POST', url: '/products', headers: authenticatedHeaders, payload: { title: 'Curso SOLID', priceCents: 9900, fulfillmentType: 'DIGITAL', externalDeliveryUrl: 'https://conteudo.exemplo.com/aula-1' } });
    expect(response.statusCode).toBe(201);
    expect(response.json<{ product: { fulfillmentType: string; externalDeliveryUrl?: string; trackInventory: boolean } }>().product).toMatchObject({ fulfillmentType: 'DIGITAL', externalDeliveryUrl: 'https://conteudo.exemplo.com/aula-1', trackInventory: false });
    await app.close();
  });

  it('impede checkout com produto de outra loja e escrita por analista', async () => {
    const catalog = new MemoryCatalog(); const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: catalog });
    const foreign = await app.inject({ method: 'POST', url: '/checkouts', headers: authenticatedHeaders, payload: { name: 'Checkout', slug: 'checkout', productId: 'product-b' } });
    expect(foreign.statusCode).toBe(404);
    catalog.role = 'ANALYST';
    const forbidden = await app.inject({ method: 'POST', url: '/products', headers: authenticatedHeaders, payload: { title: 'Produto', priceCents: 1000 } });
    expect(forbidden.statusCode).toBe(403);
    await app.close();
  });

  it('separa o modelo automático Shopify do link de infoproduto', async () => {
    const catalog = new MemoryCatalog(); const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: catalog });
    const shopify = await app.inject({ method: 'POST', url: '/checkouts', headers: authenticatedHeaders, payload: { mode: 'SHOPIFY_CART', name: 'Modelo Shopify', slug: 'shopify-principal' } });
    expect(shopify.statusCode).toBe(201);
    expect(shopify.json<{ checkout: { mode: string; productPublicId?: string } }>().checkout).toMatchObject({ mode: 'SHOPIFY_CART' });
    expect(shopify.json<{ checkout: { productPublicId?: string } }>().checkout.productPublicId).toBeUndefined();

    const direct = await app.inject({ method: 'POST', url: '/checkouts', headers: authenticatedHeaders, payload: { mode: 'DIRECT_LINK', name: 'Curso SOLID', slug: 'curso-solid', productId: 'product-a' } });
    expect(direct.statusCode).toBe(201);
    expect(direct.json<{ checkout: { mode: string; productPublicId: string } }>().checkout).toMatchObject({ mode: 'DIRECT_LINK', productPublicId: 'product-a' });

    const missingProduct = await app.inject({ method: 'POST', url: '/checkouts', headers: authenticatedHeaders, payload: { mode: 'DIRECT_LINK', name: 'Sem produto', slug: 'sem-produto' } });
    expect(missingProduct.statusCode).toBe(400);
    await app.close();
  });

  it('impede criar checkout antes de ativar um dominio seguro', async () => {
    const catalog = new MemoryCatalog(); catalog.domainActive = false;
    const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: catalog });
    const response = await app.inject({ method: 'POST', url: '/checkouts', headers: authenticatedHeaders, payload: { mode: 'SHOPIFY_CART', name: 'Modelo Shopify', slug: 'shopify-principal' } });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('DOMAIN_REQUIRED');
    expect(catalog.checkouts).toHaveLength(0);
    await app.close();
  });

  it('exclui checkout somente na loja autenticada e exige CSRF', async () => {
    const catalog = new MemoryCatalog(); catalog.checkouts.push({ publicId: 'checkout-a', storeId: 'store-a' });
    const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: catalog });
    expect((await app.inject({ method: 'DELETE', url: '/checkouts/checkout-a', headers: { cookie: `solid_session=${sessionToken}` } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'DELETE', url: '/checkouts/checkout-missing', headers: authenticatedHeaders })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: '/checkouts/checkout-a', headers: authenticatedHeaders })).statusCode).toBe(204);
    expect(catalog.checkouts).toHaveLength(0);
    await app.close();
  });

  it('valida e salva personalização somente na loja autenticada', async () => {
    const catalog = new MemoryCatalog(); catalog.checkouts.push({ publicId: 'checkout-a', storeId: 'store-a', draftConfig: {} });
    const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: catalog });
    const config = { template: 'minimal', font: 'Inter', language: 'pt-BR', currency: 'BRL', buttonEffect: 'lift', logoText: 'SOLID', timerText: 'Oferta reservada por', title: 'Finalize seu pedido', subtitle: 'Preencha seus dados.', buttonText: 'Continuar', footerText: 'Todos os direitos reservados.', footerEnabled: true, footerBackgroundColor: '#000000', footerTextColor: '#ffffff', footerAlignment: 'center', footerLayout: 'centered', footerPadding: 56, footerPaymentMethodsEnabled: true, footerPaymentTitle: 'Formas de pagamento', footerPaymentMethods: ['visa', 'mastercard', 'pix'], footerCompanyName: 'Loja Teste', footerCompanyDocument: 'CNPJ 00.000.000/0001-00', footerCompanyAddress: 'São Paulo - SP', footerSecureBadgeEnabled: true, footerSecureText: 'Pagamento seguro', footerShowPolicies: true, secureHeader: true, timer: true, showCoupon: false, showBump: false, showSummary: true, primary: '#7357e9', pageBg: '#f6f7f9', cardBg: '#ffffff', textColor: '#17171a', borderColor: '#e5e5e9', inputBg: '#ffffff', radius: 14, timerMinutes: 10, progressStyle: 'icons', privacyUrl: '#', termsUrl: '#', successUrl: '' };
    const response = await app.inject({ method: 'PATCH', url: '/checkouts/checkout-a/draft', headers: authenticatedHeaders, payload: { config: { ...config, seoTitle: 'Curso SOLID | Loja Teste', seoDescription: 'Finalize sua inscricao com seguranca.', faviconUrl: 'https://cdn.example.com/favicon.webp', customElements: [{ id: 'text-title-only', type: 'text', slot: 1, region: 'main', title: 'Uma oferta especial', text: '' }] } } });
    expect(response.statusCode).toBe(200); expect(catalog.checkouts[0]?.draftConfig).toMatchObject({ primary: '#7357e9', title: 'Finalize seu pedido', progressStyle: 'icons', footerPadding: 56, footerPaymentMethods: ['visa', 'mastercard', 'pix'], seoTitle: 'Curso SOLID | Loja Teste', faviconUrl: 'https://cdn.example.com/favicon.webp', customElements: [{ id: 'text-title-only', title: 'Uma oferta especial', text: '' }] });
    expect((await app.inject({ method: 'PATCH', url: '/checkouts/checkout-a/draft', headers: authenticatedHeaders, payload: { config: { ...config, primary: 'url(javascript:1)' } } })).statusCode).toBe(400);
    await app.close();
  });

  it('cria sessão pública com token opaco e preço calculado no servidor', async () => {
    const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: new MemoryCatalog() });
    expect((await app.inject({ method: 'GET', url: '/public/checkouts/store-b/checkout-a' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/public/checkouts/store-a/checkout-a' })).statusCode).toBe(200);
    const created = await app.inject({ method: 'POST', url: '/public/checkouts/store-a/checkout-a/sessions', payload: { quantity: 2 } });
    expect(created.statusCode).toBe(201);
    expect(created.json<{ session: { publicId: string; totalCents: number } }>().session).toMatchObject({ publicId: 'session-a', totalCents: 19800 });
    expect(created.json<{ token: string }>().token.length).toBeGreaterThanOrEqual(43);
    await app.close();
  });

  it('protege a entrega digital e só libera o link após confirmação', async () => {
    const catalog = new MemoryCatalog();
    const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: catalog });
    const url = '/public/checkout-sessions/session-a/delivery';
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    const headers = { authorization: `Bearer ${'a'.repeat(43)}`, origin };
    expect((await app.inject({ method: 'GET', url, headers })).statusCode).toBe(404);
    catalog.paidDigitalDelivery = { title: 'Curso SOLID', url: 'https://conteudo.exemplo.com/acesso' };
    const delivered = await app.inject({ method: 'GET', url, headers });
    expect(delivered.statusCode).toBe(200);
    expect(delivered.headers['cache-control']).toBe('no-store');
    expect(delivered.json()).toEqual({ delivery: catalog.paidDigitalDelivery });
    await app.close();
  });

  it('recusa quantidade e variante manipuladas no checkout público', async () => {
    const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: new MemoryCatalog() });
    expect((await app.inject({ method: 'POST', url: '/public/checkouts/store-a/checkout-a/sessions', payload: { quantity: 0 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/public/checkouts/store-a/checkout-a/sessions', payload: { quantity: 1, variantId: '../foreign' } })).statusCode).toBe(400);
    await app.close();
  });
  it('valida identificação e endereço sem expor dados na resposta', async () => {
    const secureEnv = { ...env, APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') };
    const app = buildApp(secureEnv, { authRepository: new MemoryAuth(), catalogRepository: new MemoryCatalog() });
    const headers = { authorization: `Bearer ${'a'.repeat(43)}`, origin };
    const customer = await app.inject({ method: 'PUT', url: '/public/checkout-sessions/session-a/customer', headers, payload: { name: 'Maria da Silva', email: 'maria@example.com', phone: '(11) 99999-9999', document: '529.982.247-25' } });
    expect(customer.statusCode).toBe(200); expect(customer.body).not.toContain('52998224725'); expect(customer.json()).toEqual({ customerCaptured: true, shippingCaptured: false });
    const customerWithoutCpf = await app.inject({ method: 'PUT', url: '/public/checkout-sessions/session-a/customer', headers, payload: { name: 'Maria da Silva', email: 'maria@example.com', phone: '(11) 99999-9999' } });
    expect(customerWithoutCpf.statusCode).toBe(200);
    const shipping = await app.inject({ method: 'PUT', url: '/public/checkout-sessions/session-a/shipping', headers, payload: { postalCode: '01310-100', street: 'Avenida Paulista', number: '1000', complement: '', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' } });
    expect(shipping.statusCode).toBe(200); expect(shipping.json()).toEqual({ customerCaptured: true, shippingCaptured: true });
    expect((await app.inject({ method: 'PUT', url: '/public/checkout-sessions/session-a/customer', headers, payload: { name: 'Teste', email: 'x@example.com', phone: '11999999999', document: '111.111.111-11' } })).statusCode).toBe(400);
    await app.close();
  });
  it('cria frete por loja e confirma o valor no servidor', async () => {
    const app = buildApp(env, { authRepository: new MemoryAuth(), catalogRepository: new MemoryCatalog() });
    const created = await app.inject({ method: 'POST', url: '/shipping-methods', headers: authenticatedHeaders, payload: { name: 'Entrega expressa', priceCents: 1590, minDays: 1, maxDays: 2, active: true } });
    expect(created.statusCode).toBe(201); expect(created.json<{ method: { priceCents: number } }>().method.priceCents).toBe(1590);
    const headers = { authorization: `Bearer ${'a'.repeat(43)}`, origin };
    expect((await app.inject({ method: 'GET', url: '/public/checkout-sessions/session-a/shipping-methods', headers })).statusCode).toBe(200);
    const selected = await app.inject({ method: 'PUT', url: '/public/checkout-sessions/session-a/shipping-method', headers, payload: { methodId: 'shipping-a' } });
    expect(selected.statusCode).toBe(200); expect(selected.json()).toMatchObject({ shippingPriceCents: 1290, grandTotalCents: 11190 });
    await app.close();
  });
});
