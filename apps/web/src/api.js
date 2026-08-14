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
