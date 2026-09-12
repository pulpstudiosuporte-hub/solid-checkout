import { apiBaseUrl } from './api';
import { request } from './api-request';

async function call(path, csrfToken, method = 'GET', body) {
  const response = await request(`${apiBaseUrl}${path}`, { method, credentials: 'include', headers: { Accept: 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) { const error = new Error(data?.error?.message || 'Não foi possível concluir a solicitação.'); error.code = data?.error?.code; error.status = response.status; throw error; }
  return data;
}
export const startSupport = (userId, values, csrfToken) => call(`/admin/users/${encodeURIComponent(userId)}/support`, csrfToken, 'POST', values);
export const endSupport = csrfToken => call('/admin/support/end', csrfToken, 'POST');
export const getPlatformRoles = () => call('/admin/roles');
export const getPlatformTeam = () => call('/admin/team');
export const savePlatformRole = (roleId, values, csrfToken) => call(roleId ? `/admin/roles/${encodeURIComponent(roleId)}` : '/admin/roles', csrfToken, roleId ? 'PUT' : 'POST', values);
export const deletePlatformRole = (roleId, csrfToken) => call(`/admin/roles/${encodeURIComponent(roleId)}`, csrfToken, 'DELETE');
export const assignPlatformRole = (userId, rolePublicId, csrfToken) => call(`/admin/users/${encodeURIComponent(userId)}/platform-role`, csrfToken, 'PUT', { rolePublicId });
export const getAccessAudit = (page = 1) => call(`/admin/access-audit?page=${page}`);
