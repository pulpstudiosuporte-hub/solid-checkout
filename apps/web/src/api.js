const fallbackApiUrl = 'http://127.0.0.1:3333';

export const apiBaseUrl = (import.meta.env.VITE_API_URL || fallbackApiUrl).replace(/\/$/, '');

const tabUserKey = 'solid-tab-user-context';

export function bindTabToUser(userId) {
  if (userId) sessionStorage.setItem(tabUserKey, userId);
}

export function clearTabUser() {
  sessionStorage.removeItem(tabUserKey);
}

async function fetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const expectedUser = sessionStorage.getItem(tabUserKey);
  const url = String(input);
  const establishesSession = /\/auth\/(csrf|login|register|verify-email|forgot-password|reset-password)$/.test(url);
  if (init.credentials === 'include' && expectedUser && !establishesSession) headers.set('x-solid-user-context', expectedUser);
  const response = await globalThis.fetch(input, { ...init, headers });
  if (response.status === 409) {
    const clone = response.clone();
    const body = await clone.json().catch(() => null);
    if (body?.error?.code === 'SESSION_CONTEXT_CHANGED') {
      window.dispatchEvent(new CustomEvent('solid:session-conflict'));
    }
  }
  return response;
}

// Imagens enviadas pelo painel são armazenadas e servidas pela API.  Mantemos
// esse caminho centralizado para que registros antigos, que eventualmente
// tenham salvo outro host, continuem funcionando após uma troca de domínio.
export function resolveMediaUrl(value) {
  if (typeof value !== 'string' || !value) return value;
  const match = value.match(/\/media\/([0-9a-f-]{36}\.webp)(?:[?#].*)?$/i);
  return match ? `${apiBaseUrl}/media/${match[1]}` : value;
}

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
export async function getDashboard(period, signal) { return readJson(await fetch(`${apiBaseUrl}/dashboard?period=${encodeURIComponent(period)}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function getBilling() { return readJson(await fetch(`${apiBaseUrl}/billing`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function startBillingCheckout(plan, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/billing/checkout`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ plan }) })); }
export async function startBillingPix(plan, customer, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/billing/pix`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ plan, ...customer }) })); }
export async function getBillingPix(invoiceId) { return readJson(await fetch(`${apiBaseUrl}/billing/pix/${encodeURIComponent(invoiceId)}`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function openBillingPortal(csrfToken) { return readJson(await fetch(`${apiBaseUrl}/billing/portal`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }

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
  const result = await readJson(response);
  return result?.mfaRequired ? { ...result, authCsrfToken: csrfToken } : result;
}

async function anonymousAuthPost(path, body) {
  const csrfResponse = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: 'include', headers: { Accept: 'application/json' } });
  const { csrfToken } = await readJson(csrfResponse);
  return readJson(await fetch(`${apiBaseUrl}${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(body) }));
}

export async function forgotPassword(email) { return anonymousAuthPost('/auth/forgot-password', { email }); }
export async function resetPassword(token, newPassword) { return anonymousAuthPost('/auth/reset-password', { token, newPassword }); }
export async function getSessions(csrfToken) { return readJson(await fetch(`${apiBaseUrl}/auth/sessions`, { credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }
export async function revokeSession(sessionId, csrfToken) { const response = await fetch(`${apiBaseUrl}/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } }); if (response.status !== 204) return readJson(response); }
export async function revokeOtherSessions(csrfToken) { return readJson(await fetch(`${apiBaseUrl}/auth/sessions/revoke-others`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }

export async function completeMfaLogin(challengeToken, code, authCsrfToken) {
  const response = await fetch(`${apiBaseUrl}/auth/login/mfa`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': authCsrfToken },
    body: JSON.stringify({ challengeToken, code }),
  });
  return readJson(response);
}

async function authPost(path, body) {
  const csrfResponse = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: 'include', headers: { Accept: 'application/json' } });
  const { csrfToken } = await readJson(csrfResponse);
  return readJson(await fetch(`${apiBaseUrl}${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(body) }));
}
export function registerAccount(name, email, password, turnstileToken) { return authPost('/auth/register', { name, email, password, termsAccepted: true, turnstileToken }); }
export function verifyAccount(token) { return authPost('/auth/verify-email', { token }); }

export async function logout(csrfToken, pushEndpoint) {
  const response = await fetch(`${apiBaseUrl}/auth/logout`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ pushEndpoint: pushEndpoint || undefined }),
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

const mfaRequest = async (path, body, csrfToken, method = 'POST') => readJson(await fetch(`${apiBaseUrl}${path}`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, ...(body ? { body: JSON.stringify(body) } : {}) }));
export const getMfaStatus = csrfToken => mfaRequest('/auth/mfa/status', null, csrfToken, 'GET');
export const beginMfaSetup = (currentPassword, csrfToken) => mfaRequest('/auth/mfa/setup', { currentPassword }, csrfToken);
export const enableMfa = (code, csrfToken) => mfaRequest('/auth/mfa/enable', { code }, csrfToken);
export async function disableMfa(currentPassword, code, csrfToken) {
  const response = await fetch(`${apiBaseUrl}/auth/mfa/disable`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ currentPassword, code }) });
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
export async function archiveStore(storeId, csrfToken) { const response = await fetch(`${apiBaseUrl}/stores/${encodeURIComponent(storeId)}`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } }); if (!response.ok) return readJson(response); }
export async function getStoreDomain() { return readJson(await fetch(`${apiBaseUrl}/store-domain`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function saveStoreDomain(hostname, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/store-domain`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ hostname }) })); }
export async function verifyStoreDomain(domainId, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/store-domain/${encodeURIComponent(domainId)}/verify`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }
export async function deleteStoreDomain(domainId, csrfToken) { const response = await fetch(`${apiBaseUrl}/store-domain/${encodeURIComponent(domainId)}`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } }); if (response.status !== 204) return readJson(response); }

export async function getShopifyStatus() { return readJson(await fetch(`${apiBaseUrl}/integrations/shopify/status`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function connectShopify(shop, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/integrations/shopify/connect`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ shop }) })); }
export async function disconnectShopify(csrfToken) { const response = await fetch(`${apiBaseUrl}/integrations/shopify`, { method: 'DELETE', credentials: 'include', headers: { 'x-csrf-token': csrfToken } }); if (response.status !== 204) await readJson(response); }
export async function syncShopifyCatalog(csrfToken) { return readJson(await fetch(`${apiBaseUrl}/integrations/shopify/sync`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }
export async function getUtmifyStatus() { return readJson(await fetch(`${apiBaseUrl}/integrations/utmify/status`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function saveUtmify(token, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/integrations/utmify`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ token }) })); }
export async function disconnectUtmify(csrfToken) { const response = await fetch(`${apiBaseUrl}/integrations/utmify`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } }); if (response.status !== 204) return readJson(response); }
export async function getMetaStatus() { return readJson(await fetch(`${apiBaseUrl}/integrations/meta/status`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function saveMeta(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/integrations/meta`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function disconnectMeta(csrfToken) { const response = await fetch(`${apiBaseUrl}/integrations/meta`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } }); if (response.status !== 204) return readJson(response); }
export async function getIntegrationDiagnostics(signal) { return readJson(await fetch(`${apiBaseUrl}/integrations/diagnostics`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function getNotifications() { return readJson(await fetch(`${apiBaseUrl}/notifications`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function markNotificationsRead(csrfToken) { return readJson(await fetch(`${apiBaseUrl}/notifications/read`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }
export async function getPushConfig() { return readJson(await fetch(`${apiBaseUrl}/notifications/push/config`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function savePushSubscription(subscription, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/notifications/push/subscriptions`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(subscription) })); }
export async function getProducts(filters = {}, signal) { const query = new URLSearchParams({ page: String(filters.page || 1), pageSize: '20' }); if (filters.search) query.set('search', filters.search); if (filters.status) query.set('status', filters.status); if (filters.source) query.set('source', filters.source); return readJson(await fetch(`${apiBaseUrl}/products?${query}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function getProduct(productId, signal) { return readJson(await fetch(`${apiBaseUrl}/products/${encodeURIComponent(productId)}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function createProduct(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/products`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function deleteManualProduct(productId, csrfToken) { const response = await fetch(`${apiBaseUrl}/products/${encodeURIComponent(productId)}`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } }); if (response.status !== 204) return readJson(response); }
export async function uploadProductImage(file, csrfToken) { const form = new FormData(); form.append('image', file); return readJson(await fetch(`${apiBaseUrl}/media/images`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken }, body: form })); }
export async function getPublicCheckout(storeSlug, checkoutSlug, signal) { return readJson(await fetch(`${apiBaseUrl}/public/checkouts/${encodeURIComponent(storeSlug)}/${encodeURIComponent(checkoutSlug)}`, { headers: { Accept: 'application/json' }, signal })); }
export async function createPublicCheckoutSession(storeSlug, checkoutSlug, input) { return readJson(await fetch(`${apiBaseUrl}/public/checkouts/${encodeURIComponent(storeSlug)}/${encodeURIComponent(checkoutSlug)}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(input) })); }
export async function getPublicCheckoutSession(sessionId, token, signal) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal })); }
export async function touchPublicCheckoutPresence(sessionId, token) { const response = await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/presence`, { method: 'PUT', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } }); if (response.status !== 204) return readJson(response); }
export async function getPublicMetaConfig(sessionId, token, signal) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/tracking/meta`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal })); }
export async function getPaidDigitalDelivery(sessionId, token, signal) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/delivery`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal })); }
export async function savePublicCheckoutCustomer(sessionId, token, input) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/customer`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })); }
export async function savePublicCheckoutShipping(sessionId, token, input) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/shipping`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })); }
export async function getPublicShippingMethods(sessionId, token) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/shipping-methods`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })); }
export async function selectPublicShippingMethod(sessionId, token, methodId) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/shipping-method`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ methodId }) })); }
export async function setPublicOrderBump(sessionId, token, productId, enabled) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/order-bump`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ productId, enabled }) })); }
export async function setPublicCheckoutQuantity(sessionId, token, quantity) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/quantity`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ quantity }) })); }
export async function applyPublicCoupon(sessionId, token, code) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/coupon`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ code }) })); }
export async function createWestPayPix(sessionId, token) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/payments/westpay/pix`, { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })); }
export async function getLatestPublicPayment(sessionId, token, signal) { return readJson(await fetch(`${apiBaseUrl}/public/checkout-sessions/${encodeURIComponent(sessionId)}/payments/latest`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal })); }
export async function getWestPayStatus() { return readJson(await fetch(`${apiBaseUrl}/integrations/westpay/status`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function saveWestPay(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/integrations/westpay`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function getRoasStatus() { return readJson(await fetch(`${apiBaseUrl}/integrations/roas/status`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function saveRoas(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/integrations/roas`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function getOrders(filters = {}, signal) { const query = new URLSearchParams({ page: String(filters.page || 1), pageSize: String(filters.pageSize || 20) }); for (const key of ['search','status','from','to','sort']) if (filters[key]) query.set(key, String(filters[key])); return readJson(await fetch(`${apiBaseUrl}/orders?${query}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function getOrder(orderId, signal) { return readJson(await fetch(`${apiBaseUrl}/orders/${encodeURIComponent(orderId)}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function getAbandonedCarts(filters = {}, signal) { const query = new URLSearchParams({ page: String(filters.page || 1), pageSize: String(filters.pageSize || 20) }); for (const key of ['status','search','stage','period','sort']) if (filters[key]) query.set(key, String(filters[key])); return readJson(await fetch(`${apiBaseUrl}/abandoned-carts?${query}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function getAbandonedRecoverySettings(signal) { return readJson(await fetch(`${apiBaseUrl}/abandoned-carts/recovery-settings`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function saveAbandonedRecoverySettings(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/abandoned-carts/recovery-settings`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function getStoreWebhooks(signal) { return readJson(await fetch(`${apiBaseUrl}/store-webhooks`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function createStoreWebhook(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/store-webhooks`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function updateStoreWebhook(id, input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/store-webhooks/${encodeURIComponent(id)}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function deleteStoreWebhook(id, csrfToken) { const response = await fetch(`${apiBaseUrl}/store-webhooks/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } }); if (!response.ok) return readJson(response); }
export async function testStoreWebhook(id, event, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/store-webhooks/${encodeURIComponent(id)}/test`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ event }) })); }
export async function lookupPostalCode(postalCode, signal) { return readJson(await fetch(`${apiBaseUrl}/public/postal-codes/${encodeURIComponent(postalCode.replace(/\D/g, ''))}`, { headers: { Accept: 'application/json' }, signal })); }
export async function getCheckouts() { return readJson(await fetch(`${apiBaseUrl}/checkouts`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function getShippingMethods() { return readJson(await fetch(`${apiBaseUrl}/shipping-methods`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function createShippingMethod(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/shipping-methods`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function updateShippingMethod(methodId, input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/shipping-methods/${encodeURIComponent(methodId)}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function deleteShippingMethod(methodId, csrfToken) { const response = await fetch(`${apiBaseUrl}/shipping-methods/${encodeURIComponent(methodId)}`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } }); if (!response.ok) return readJson(response); }
export async function createCheckout(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/checkouts`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function deleteCheckout(checkoutId, csrfToken) { const response = await fetch(`${apiBaseUrl}/checkouts/${encodeURIComponent(checkoutId)}`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } }); if (response.status !== 204) return readJson(response); }
export async function getCoupons() { return readJson(await fetch(`${apiBaseUrl}/coupons`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function createCoupon(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/coupons`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function updateCoupon(couponId, input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/coupons/${encodeURIComponent(couponId)}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function deleteCoupon(couponId, csrfToken) { const response = await fetch(`${apiBaseUrl}/coupons/${encodeURIComponent(couponId)}`, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } }); if (!response.ok) return readJson(response); }
export async function updateCheckoutDraft(checkoutId, config, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/checkouts/${encodeURIComponent(checkoutId)}/draft`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ config }) })); }
export async function publishCheckout(checkoutId, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/checkouts/${encodeURIComponent(checkoutId)}/publish`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }
export async function getAdminUsers(status = 'PENDING', page = 1) { return readJson(await fetch(`${apiBaseUrl}/admin/users?status=${encodeURIComponent(status)}&page=${page}`, { credentials: 'include', headers: { Accept: 'application/json' } })); }
export async function approveAdminUser(userId, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/admin/users/${encodeURIComponent(userId)}/approve`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }
export async function blockAdminUser(userId, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/admin/users/${encodeURIComponent(userId)}/block`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }
export async function updateAdminBillingOverride(userId, input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/admin/users/${encodeURIComponent(userId)}/billing-override`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function getAdminOperations(signal) { return readJson(await fetch(`${apiBaseUrl}/admin/operations`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function retryAdminOperation(jobId, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/admin/operations/${encodeURIComponent(jobId)}/retry`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }
export async function getProductFeedback(signal) { return readJson(await fetch(`${apiBaseUrl}/product-feedback`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })); }
export async function createProductFeedback(input, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/product-feedback`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(input) })); }
export async function toggleProductFeedbackVote(feedbackId, csrfToken) { return readJson(await fetch(`${apiBaseUrl}/product-feedback/${encodeURIComponent(feedbackId)}/vote`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'x-csrf-token': csrfToken } })); }
