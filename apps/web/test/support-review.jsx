import { createRoot } from 'react-dom/client';
import AdminApp from '../src/AdminApp';
const principal = { publicId: 'admin', name: 'Admin SOLID', email: 'admin@example.com', platformAdmin: true, platformPermissions: ['roles.manage'] };
const customer = { publicId: 'client', name: 'Marina Oliveira', email: 'marina@example.com', accountStatus: 'APPROVED', platformAdmin: false, createdAt: '2026-09-01T12:00:00Z', memberships: [{ store: { name: 'Loja Marina' } }] };
const roleSeed = [{ publicId: 'technical', name: 'Equipe técnica', description: 'Investigar problemas e realizar manutenção.', permissions: ['users.read', 'support.read', 'support.write'], _count: { users: 0 } }, { publicId: 'compliance', name: 'Compliance', description: 'Consultar contas e revisar o histórico de acessos.', permissions: ['users.read', 'support.read', 'audit.read'], _count: { users: 0 } }];
let roles = roleSeed;
let members = [principal];
let products = [];
let supportAttempts = 0;
const supportKey = 'support-review-grant';
window.fetch = async (input, init = {}) => {
  const path = new URL(String(input), location.origin).pathname;
  const headers = new Headers(init.headers);
  const support = headers.has('x-solid-support-session') ? JSON.parse(sessionStorage.getItem(supportKey) || 'null') : null;
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const body = init.body ? JSON.parse(init.body) : {};
  const isStaff = new URLSearchParams(location.search).has('staff');
  const operator = isStaff ? { ...principal, platformAdmin: false, platformRole: roles[1], platformPermissions: roles[1].permissions } : principal;
  if (path === '/health/ready') return json({ status: 'ok', service: 'solid-api' });
  if (path === '/auth/session') return json({ user: support ? customer : operator, support, csrfToken: 'local-csrf' });
  if (path === '/stores') return json({ items: [{ publicId: support ? 'client-store' : 'admin-store', name: support ? 'Loja Marina' : 'Operação SOLID', slug: 'marina', active: true, role: 'OWNER', onboardingCompleted: true }] });
  if (path === '/admin/users') return json({ users: [customer], pagination: { page: 1, pages: 1, total: 1 } });
  if (path === '/admin/users/client/support' && new URLSearchParams(location.search).has('rejectSupport') && supportAttempts++ === 0) return json({ error: { code: 'REAUTH_REQUIRED', message: 'Confirme sua senha de administrador para continuar.' } }, 401);
  if (path === '/admin/users/client/support') { const grant = { actorName: principal.name, actorPublicId: principal.publicId, mode: body.mode, reason: body.reason, expiresAt: new Date(Date.now() + 1800000).toISOString() }; sessionStorage.setItem(supportKey, JSON.stringify(grant)); return json({ supportToken: 's'.repeat(43), targetUserId: customer.publicId, expiresAt: grant.expiresAt }, 201); }
  if (path === '/admin/support/end') { sessionStorage.removeItem(supportKey); return new Response(null, { status: 204 }); }
  if (path === '/admin/roles' && (!init.method || init.method === 'GET')) return json({ roles });
  if (path === '/admin/roles' && init.method === 'POST') { roles = [...roles, { ...body, publicId: `role-${roles.length}`, _count: { users: 0 } }]; return json({ role: roles.at(-1) }, 201); }
  if (path.startsWith('/admin/roles/') && init.method === 'PUT') { roles = roles.map(role => role.publicId === path.split('/').pop() ? { ...role, ...body } : role); return json({ updated: true }); }
  if (path.startsWith('/admin/roles/') && init.method === 'DELETE') { roles = roles.filter(role => role.publicId !== path.split('/').pop()); return new Response(null, { status: 204 }); }
  if (path === '/admin/team') return json({ members });
  if (path.endsWith('/platform-role')) { members = [principal, ...(body.rolePublicId ? [{ ...customer, platformRole: roles.find(role => role.publicId === body.rolePublicId) }] : [])]; return json({ updated: true }); }
  if (path === '/admin/access-audit') return json({ items: [{ id: '1', action: 'admin.support.started', actor: principal, targetId: 'client', createdAt: new Date().toISOString(), metadata: { targetName: customer.name, mode: 'READ_ONLY', reason: 'Chamado 123 — revisar configuração da loja' } }], pagination: { page: 1, pages: 1 } });
  if (path === '/dashboard') return json({ userName: customer.name, revenueCents: 0, paidOrders: 0, pendingPix: 0, conversionRate: 0, activeVisitors: 0, series: [], analytics: { sessions: 0, generatedRevenueCents: 0 }, checklist: {} });
  if (path === '/products' && init.method === 'POST') { const product = { ...body, publicId: 'new-product', checkoutTitle: body.title, source: 'MANUAL' }; products.push(product); return json({ product }, 201); }
  if (path === '/products') return json({ items: products, total: products.length, pages: 1 });
  if (path === '/platform-content') return json({ releases: [] });
  if (path === '/notifications') return json({ items: [], unreadCount: 0 });
  if (path === '/notifications/push/config') return json({ enabled: false });
  if (path === '/settings') return json({ store: { name: 'Loja Marina', profile: {} }, user: customer, members: [], role: 'OWNER', activation: { completed: true, missing: [] } });
  return json({ items: [] });
};
createRoot(document.getElementById('root')).render(<AdminApp/>);
