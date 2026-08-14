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
