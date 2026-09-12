// @ts-check
class RequestTimeoutError extends Error { code = 'REQUEST_TIMEOUT'; }
const tabUserKey = 'solid-tab-user-context';
const supportKey = 'solid-support-context';

/** @param {string} token @param {string} userId */
export function bindSupportSession(token, userId) {
  sessionStorage.setItem(supportKey, token);
  bindTabToUser(userId);
}
export function clearSupportSession() { sessionStorage.removeItem(supportKey); clearTabUser(); }
export function hasSupportSession() { return Boolean(sessionStorage.getItem(supportKey)); }

/** @param {string | undefined} userId */
export function bindTabToUser(userId) {
  if (userId) sessionStorage.setItem(tabUserKey, userId);
}

export function clearTabUser() {
  sessionStorage.removeItem(tabUserKey);
}

/** @param {RequestInfo | URL} input @param {RequestInit} init */
export async function request(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const expectedUser = sessionStorage.getItem(tabUserKey);
  const url = String(input);
  const establishesSession = /\/auth\/(csrf|login|register|verify-email|forgot-password|reset-password)$/.test(url);
  const support = sessionStorage.getItem(supportKey);
  if (init.credentials === 'include' && support) headers.set('x-solid-support-session', support);
  if (init.credentials === 'include' && expectedUser && !establishesSession) headers.set('x-solid-user-context', expectedUser);
  const timeout = AbortSignal.timeout(30_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let response;
  try { response = await globalThis.fetch(input, { ...init, headers, signal }); }
  catch (cause) {
    if (timeout.aborted) {
      const error = new RequestTimeoutError('A conexão demorou mais que o esperado. Confira o resultado antes de repetir a ação.');
      throw error;
    }
    throw cause;
  }
  if (response.status === 409) {
    const clone = response.clone();
    const body = await clone.json().catch(() => null);
    if (body?.error?.code === 'SESSION_CONTEXT_CHANGED') {
      window.dispatchEvent(new CustomEvent('solid:session-conflict'));
    }
    if (body?.error?.code === 'SUPPORT_SESSION_EXPIRED') window.dispatchEvent(new CustomEvent('solid:support-expired'));
  }
  return response;
}
