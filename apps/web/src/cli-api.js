import { apiBaseUrl } from './api';
import { request } from './api-request';
export async function cliRequest(path, method = 'GET', body, csrfToken) {
  const response = await request(`${apiBaseUrl}/cli${path}`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 204) return {};
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'Não foi possível concluir a conexão.');
  return result;
}
