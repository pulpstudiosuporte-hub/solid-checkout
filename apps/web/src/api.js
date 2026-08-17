const fallbackApiUrl = 'http://127.0.0.1:3333';

export const apiBaseUrl = (import.meta.env.VITE_API_URL || fallbackApiUrl).replace(/\/$/, '');

export async function getApiHealth() {
  const response = await fetch(`${apiBaseUrl}/health/ready`, {
    method: 'GET',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) throw new Error(`API indisponivel (${response.status})`);

  const body = await response.json();
  if (body?.status !== 'ok' || body?.service !== 'solid-api') {
    throw new Error('Resposta inesperada da API');
  }

  return body;
}

async function readJson(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Não foi possível concluir a solicitação.');
    error.code = body?.error?.code;
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function getSession() {
  const response = await fetch(`${apiBaseUrl}/auth/session`, { credentials: 'include', headers: { Accept: 'application/json' } });
  return readJson(response);
}

export async function login(email, password) {
  const csrfResponse = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: 'include', headers: { Accept: 'application/json' } });
  const { csrfToken } = await readJson(csrfResponse);
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify({ email, password }),
  });
  return readJson(response);
}

export async function logout(csrfToken) {
  const response = await fetch(`${apiBaseUrl}/auth/logout`, {
    method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken },
  });
  if (!response.ok && response.status !== 401) await readJson(response);
}

export async function changePassword(currentPassword, newPassword, csrfToken) {
  const response = await fetch(`${apiBaseUrl}/auth/change-password`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (response.status !== 204) await readJson(response);
}

export async function getStores() {
  const response = await fetch(`${apiBaseUrl}/stores`, { credentials: 'include', headers: { Accept: 'application/json' } });
  return readJson(response);
}

export async function createStore(name, csrfToken) {
  const response = await fetch(`${apiBaseUrl}/stores`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ name }) });
  return readJson(response);
}

export async function selectStore(storeId, csrfToken) {
  const response = await fetch(`${apiBaseUrl}/stores/${encodeURIComponent(storeId)}/select`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } });
  return readJson(response);
}

export async function getShopifyStatus() { return readJson(await fetch(`${apiBaseUrl}/integrations/shopify/status`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function connectShopify(shop, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/integrations/shopify/connect`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ shop }) })); }
export async function disconnectShopify(csrfToken) { const response = await fetch(`${apiBaseUrl}/integrations/shopify`, { method: 'DELETE', credentials: 'include', headers: { 'x-csrf-token': csrfToken } }); if (response.status !== 204) await readJson(response); }
export async function syncShopifyCatalog(csrfToken) { return readJson(await fetch(`${apiBaseUrl}/integrations/shopify/sync`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }
export async function getProducts(filters = {}, signal) { const query = new URLSearchParams({ page: String(filters.page || 1), pageSize: '20' }); if (filters.search) query.set('search', filters.search); if (filters.status) query.set('status', filters.status); if (filters.source) query.set('source', filters.source); return readJson(await fetch(`${apiBaseUrl}/products?${query}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function getProduct(productId, signal) { return readJson(await fetch(`${apiBaseUrl}/products/${encodeURIComponent(productId)}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function getPublicCheckout(storeSlug, checkoutSlug, signal) { return readJson(await fetch(`${apiBaseUrl}/public/checkouts/${encodeURIComponent(storeSlug)}/${encodeURIComponent(checkoutSlug)}`, { headers: { Accept: 'application/json' }, signal })); }
export async function createPublicCheckoutSession(storeSlug, checkoutSlug, input) { return readJson(await fetch(`${apiBaseUrl}/public/checkouts/${encodeURIComponent(storeSlug)}/${encodeURIComponent(checkoutSlug)}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(input) })); }
export async function getPublicCheckoutSession(sessionId, token, signal) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal })); }
export async function savePublicCheckoutCustomer(sessionId, token, input) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/customer`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })); }
export async function savePublicCheckoutShipping(sessionId, token, input) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/shipping`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })); }
export async function getPublicShippingMethods(sessionId, token) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/shipping-methods`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })); }
export async function selectPublicShippingMethod(sessionId, token, methodId) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/shipping-method`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ methodId }) })); }
export async function setPublicOrderBump(sessionId, token, enabled) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/order-bump`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ enabled }) })); }
export async function createWestPayPix(sessionId, token) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/payments/westpay/pix`, { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })); }
export async function getLatestPublicPayment(sessionId, token, signal) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/payments/latest`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal })); }
export async function getWestPayStatus() { return readJson(await fetch(`${apiBaseUrl}/integrations/westpay/status`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function saveWestPay(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/integrations/westpay`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function getOrders(filters = {}) { const query = new URLSearchParams({ page: String(filters.page || 1), pageSize: String(filters.pageSize || 20) }); return readJson(await fetch(`${apiBaseUrl}/orders?${query}`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function getOrder(orderId, signal) { return readJson(await fetch(`${apiBaseUrl}/orders/${encodeURIComponent(orderId)}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function lookupPostalCode(postalCode, signal) { return readJson(await fetch(`${apiBaseUrl}/public/postal-codes/${encodeURIComponent(postalCode.replace(/\D/g, ''))}`, { headers: { Accept: 'application/json' }, signal })); }
export async function getCheckouts() { return readJson(await fetch(`${apiBaseUrl}/checkouts`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function getShippingMethods() { return readJson(await fetch(`${apiBaseUrl}/shipping-methods`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function createShippingMethod(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/shipping-methods`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function updateShippingMethod(methodId, input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/shipping-methods/${encodeURIComponent(methodId)}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function createCheckout(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/checkouts`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function updateCheckoutDraft(checkoutId, config, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/checkouts/${encodeURIComponent(checkoutId)}/draft`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ config }) })); }
export async function publishCheckout(checkoutId, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/checkouts/${encodeURIComponent(checkoutId)}/publish`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }
