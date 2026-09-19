// Fictional, in-memory responses used only by the browser test runner.
const user = { id: 'qa-user', publicId: 'qa-user', name: 'Marina Oliveira', email: 'marina@example.com', platformAdmin: false };
const store = { publicId: 'qa-store', name: 'Aurora Store', slug: 'aurora-qa', role: 'OWNER', active: true, onboardingCompleted: true };
const products = [
  { publicId: 'qa-product-1', checkoutTitle: 'Kit Essentials', checkoutDescription: 'Um kit de exemplo para revisão da interface.', priceCents: 14900, compareAtCents: 17900, active: true, source: 'MANUAL', vendor: 'Aurora', trackInventory: true, stockQuantity: 42, fulfillmentType: 'PHYSICAL', images: [], tags: [], variants: [] },
  { publicId: 'qa-product-2', checkoutTitle: 'Ecobag Natural', priceCents: 2900, active: true, source: 'SHOPIFY', vendor: 'Aurora', trackInventory: true, stockQuantity: 128, images: [], tags: [], variants: [] },
  { publicId: 'qa-product-3', checkoutTitle: 'Guia de organização', priceCents: 7900, active: false, source: 'MANUAL', fulfillmentType: 'DIGITAL', trackInventory: false, images: [], tags: [], variants: [] },
];
const orders = ['PAID', 'PENDING', 'PAID', 'EXPIRED', 'PAID'].map((status, index) => ({ publicId: `qa-order-000${index + 1}`, createdAt: `2026-09-10T${14 + index}:25:00.000Z`, status, totalCents: 14900 + index * 2900, country: 'BR', paymentProvider: 'ROAS', customer: { name: ['Ana Lima', 'Lucas Costa', 'Paula Souza', 'Bruno Alves', 'Camila Santos'][index], email: `cliente${index + 1}@example.com` }, items: [{ quantity: 1, titleSnapshot: 'Kit Essentials', totalCents: 14900 }] }));
const releases = [{ publicId: 'qa-release', title: 'Novidades para sua operação', publishedAt: '2026-09-10T12:00:00Z', category: 'IMPROVEMENT', summary: 'Exemplo de atualização para revisão visual.' }];

export async function mockAdmin(page, { anonymous = false, revenueError = false, empty = false, fullYear = false, platformReleases = releases } = {}) {
  page.on('pageerror', error => console.error('Browser error:', error.message));
  page.on('requestfailed', request => console.error('Request failed:', request.url(), request.failure()?.errorText));
  const unexpected = [];
  const mutations = [];
  await page.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
    if (!['fetch', 'xhr'].includes(request.resourceType())) return route.continue();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.startsWith('/assets/') || path.startsWith('/brand/')) return route.continue();
    const respond = (body, status = 200) => route.fulfill({ status, json: body });
    if (request.method() !== 'GET') { mutations.push(`${request.method()} ${path}`); return respond({ error: { message: 'Gravação bloqueada no teste visual.' } }, 403); }
    if (path === '/health/ready') return respond({ status: 'ok', service: 'solid-api' });
    if (path === '/auth/session') return anonymous ? respond({ error: { message: 'Sem sessão de teste' } }, 401) : respond({ user, csrfToken: 'qa-token' });
    if (path === '/stores') return respond({ items: [store] });
    if (path === '/settings') return respond({ user, store: { ...store, profile: { legalName: 'Aurora Exemplo', businessModel: 'E-commerce', noWebsite: true } }, members: [{ user, role: 'OWNER' }], activation: { completed: true, missing: [] }, preferences: {} });
    if (path === '/platform-content') return respond({ releases: platformReleases, assets: [] });
    if (path === '/notifications') return respond({ items: [], unread: 0 });
    if (path === '/notifications/push/config') return respond({ enabled: false });
    if (path === '/dashboard') {
      const period = url.searchParams.get('period');
      if (revenueError && period !== 'today') return respond({ error: { message: 'API indisponível no cenário de teste.' } }, 503);
      const series = Array.from({ length: period === 'today' ? 1 : fullYear && period === 'year' ? 365 : 7 }, (_, index) => ({ date: fullYear && period === 'year' ? new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10) : `2026-09-${String(index + 4).padStart(2, '0')}`, revenueCents: empty ? 0 : [29800, 44700, 37800, 74500, 59600, 89400, 104300][index % 7], paidOrders: empty ? 0 : [2, 3, 3, 5, 4, 6, 7][index % 7] }));
      const revenueCents = series.reduce((sum, item) => sum + item.revenueCents, 0);
      return respond({ userName: user.name, revenueCents, paidOrders: empty ? 0 : 30, pendingPix: empty ? 0 : 8, activeVisitors: empty ? 0 : 12, conversionRate: empty ? 0 : 4.82, series, analytics: { sessions: empty ? 0 : 622, generatedOrders: empty ? 0 : 38, generatedRevenueCents: empty ? 0 : 548200, averageTicketCents: empty ? 0 : 14670, geography: { locations: [], countries: 0, cities: 0, visitors: 0, regions: 0 } } });
    }
    if (path === '/products') {
      const query = url.searchParams.get('search')?.toLowerCase() || '';
      const items = empty ? [] : products.filter(item => item.checkoutTitle.toLowerCase().includes(query));
      return respond({ items, total: items.length, pages: 1 });
    }
    if (path.startsWith('/products/')) return respond({ product: products.find(item => path.endsWith(item.publicId)) });
    if (path === '/orders') return respond({ items: empty ? [] : orders, total: empty ? 0 : orders.length, pages: 1 });
    if (path === '/store-domain') return respond({ domain: { hostname: 'checkout.example.com', status: 'ACTIVE' } });
    if (path === '/checkouts') return respond({ items: empty ? [] : [{ publicId: 'qa-checkout', name: 'Checkout principal', slug: 'principal', mode: 'SHOPIFY_CART', status: 'PUBLISHED', isDefault: true, draftConfig: {} }] });
    if (path === '/shipping-methods') return respond({ items: [] });
    if (path === '/coupons') return respond({ items: [] });
    if (path === '/payment-discounts/pix') return respond({ discount: { active: false, percentageBps: 500, minimumAmountCents: 0, maximumAmountCents: null } });
    if (/^\/integrations\/\w+\/status$/.test(path)) return respond({ connected: false, configured: false, enabled: false });
    unexpected.push(path);
    console.error(`Fixture não mapeada: ${request.resourceType()} ${path}`);
    return respond({ error: { message: `Endpoint ausente do cenário visual: ${path}` } }, 501);
  });
  return { unexpected, mutations };
}
