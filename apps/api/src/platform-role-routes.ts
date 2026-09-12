import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository } from './auth-repository.js';
import { requirePlatformSession, validAdminMutation, verifyAdminCredentials } from './admin-access.js';
import { platformPermissions } from './platform-permissions.js';

const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const roleSelect = { publicId: true, name: true, description: true, permissions: true, _count: { select: { users: true } } } as const;
function roleInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (name.length < 3 || name.length > 80 || description.length > 240 || !Array.isArray(input.permissions) || input.permissions.length > platformPermissions.length) return null;
  const permissions = input.permissions;
  if (!permissions.every((value): value is typeof platformPermissions[number] => typeof value === 'string' && platformPermissions.some(permission => permission === value))) return null;
  const required = { 'users.manage': 'users.read', 'billing.manage': 'users.read', 'support.read': 'users.read', 'support.write': 'support.read', 'operations.manage': 'operations.read' };
  if (Object.entries(required).some(([permission, dependency]) => permissions.includes(permission as typeof platformPermissions[number]) && !permissions.includes(dependency as typeof platformPermissions[number]))) return null;
  return { name, description, permissions: [...new Set(permissions)] };
}

export function registerPlatformRoleRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  app.get('/admin/roles', async (request, reply) => {
    if (!await requirePlatformSession(request, environment, auth, 'roles.manage')) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Somente administradores podem gerenciar os perfis da equipe.'));
    return reply.header('cache-control', 'private, no-store').send({ roles: await db.platformRole.findMany({ orderBy: { name: 'asc' }, select: roleSelect }), permissions: platformPermissions });
  });
  for (const method of ['POST', 'PUT'] as const) {
    app.route<{ Params: { publicId?: string }; Body: unknown }>({ method, url: method === 'POST' ? '/admin/roles' : '/admin/roles/:publicId', handler: async (request, reply) => {
      const session = await requirePlatformSession(request, environment, auth, 'roles.manage');
      if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Sem permissão para gerenciar perfis.'));
      if (!validAdminMutation(request, session, environment)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
      const data = roleInput(request.body);
      if (!data) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Revise o nome, a descrição e as dependências das permissões.'));
      const previous = method === 'PUT' ? await db.platformRole.findUnique({ where: { publicId: request.params.publicId! }, select: { id: true, name: true, permissions: true } }) : null;
      if (method === 'PUT' && !previous) return reply.code(404).send(failure(request, 'ROLE_NOT_FOUND', 'Perfil não encontrado.'));
      try {
        const role = await db.$transaction(async transaction => {
          const saved = previous ? await transaction.platformRole.update({ where: { id: previous.id }, data, select: roleSelect }) : await transaction.platformRole.create({ data, select: roleSelect });
          // A permission edit immediately ends all support grants created with the old profile.
          if (previous) await transaction.session.updateMany({ where: { supportParent: { user: { platformRoleId: previous.id } }, revokedAt: null }, data: { revokedAt: new Date() } });
          await transaction.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: previous ? 'admin.role.updated' : 'admin.role.created', targetType: 'platform_role', targetId: saved.publicId, requestId: request.id, metadata: { name: data.name, permissions: data.permissions, previousPermissions: previous?.permissions ?? [] } } });
          return saved;
        });
        return reply.code(previous ? 200 : 201).send({ role });
      } catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') return reply.code(409).send(failure(request, 'ROLE_NAME_EXISTS', 'Já existe um perfil com este nome.'));
        throw error;
      }
    } });
  }
  app.delete<{ Params: { publicId: string } }>('/admin/roles/:publicId', async (request, reply) => {
    const session = await requirePlatformSession(request, environment, auth, 'roles.manage');
    if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Sem permissão para excluir perfis.'));
    if (!validAdminMutation(request, session, environment)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const result = await db.$transaction(async transaction => {
      const role = await transaction.platformRole.findUnique({ where: { publicId: request.params.publicId }, select: { id: true, name: true, _count: { select: { users: true } } } });
      if (!role) return 'missing';
      if (role._count.users) return 'assigned';
      await transaction.platformRole.delete({ where: { id: role.id } });
      await transaction.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: 'admin.role.deleted', targetType: 'platform_role', targetId: request.params.publicId, requestId: request.id, metadata: { name: role.name } } });
      return 'deleted';
    }, { isolationLevel: 'Serializable' });
    if (result === 'missing') return reply.code(404).send(failure(request, 'ROLE_NOT_FOUND', 'Perfil não encontrado.'));
    if (result === 'assigned') return reply.code(409).send(failure(request, 'ROLE_ASSIGNED', 'Remova ou altere o perfil dos membros antes de excluir.'));
    return reply.code(204).send();
  });
  app.get('/admin/team', async (request, reply) => {
    if (!await requirePlatformSession(request, environment, auth, 'roles.manage')) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Sem permissão para gerenciar a equipe.'));
    return reply.header('cache-control', 'private, no-store').send({ members: await db.user.findMany({ where: { OR: [{ platformAdmin: true }, { platformRoleId: { not: null } }] }, orderBy: { name: 'asc' }, take: 200, select: { publicId: true, name: true, email: true, platformAdmin: true, disabledAt: true, platformRole: { select: { publicId: true, name: true } } } }) });
  });
  app.put<{ Params: { publicId: string }; Body: { rolePublicId?: unknown } }>('/admin/users/:publicId/platform-role', async (request, reply) => {
    const session = await requirePlatformSession(request, environment, auth, 'roles.manage');
    if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Somente administradores podem atribuir perfis.'));
    if (!validAdminMutation(request, session, environment)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const roleId = request.body?.rolePublicId;
    if (roleId !== null && (typeof roleId !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(roleId))) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Escolha um perfil válido.'));
    const result = await db.$transaction(async transaction => {
      const target = await transaction.user.findUnique({ where: { publicId: request.params.publicId }, select: { id: true, platformAdmin: true, disabledAt: true, accountStatus: true, platformRoleId: true } });
      if (!target || target.platformAdmin || target.id === session.userId || (roleId !== null && (target.disabledAt || target.accountStatus !== 'APPROVED'))) return false;
      const role = roleId === null ? null : await transaction.platformRole.findUnique({ where: { publicId: roleId }, select: { id: true, publicId: true } });
      if (roleId !== null && !role) return false;
      await transaction.user.update({ where: { id: target.id }, data: { platformRoleId: role?.id ?? null } });
      await transaction.session.updateMany({ where: { revokedAt: null, OR: [{ supportParent: { userId: target.id } }, { userId: target.id, supportParentId: { not: null } }] }, data: { revokedAt: new Date() } });
      await transaction.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: 'admin.role.assigned', targetType: 'user', targetId: request.params.publicId, requestId: request.id, metadata: { rolePublicId: role?.publicId ?? null, previousRoleId: target.platformRoleId } } });
      return true;
    });
    if (!result) return reply.code(409).send(failure(request, 'ROLE_ASSIGNMENT_INVALID', 'Escolha uma conta ativa de equipe e um perfil existente. Administradores principais não são alterados aqui.'));
    return reply.send({ updated: true });
  });
  app.put<{ Params: { publicId: string }; Body: { enabled?: unknown; currentPassword?: unknown; code?: unknown } }>('/admin/users/:publicId/platform-admin', { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const session = await requirePlatformSession(request, environment, auth, 'roles.manage');
    if (!session?.user.platformAdmin) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Somente administradores da plataforma podem conceder ou remover este acesso.'));
    if (!validAdminMutation(request, session, environment)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (typeof request.body?.enabled !== 'boolean') return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Informe se o acesso de administrador deve ser ativado.'));
    const enabled = request.body.enabled;
    const credentialError = await verifyAdminCredentials(auth, environment, session, request.body);
    if (credentialError) return reply.code(401).send(failure(request, credentialError.code, credentialError.message));
    try {
      const result = await db.$transaction(async transaction => {
        // Recheck both parties in one serializable transaction, preventing concurrent
        // demotions from removing the last administrator or granting stale authority.
        const actor = await transaction.user.findUnique({ where: { id: session.userId }, select: { platformAdmin: true, disabledAt: true, accountStatus: true } });
        if (!actor?.platformAdmin || actor.disabledAt || actor.accountStatus !== 'APPROVED') return 'forbidden';
        const target = await transaction.user.findUnique({ where: { publicId: request.params.publicId }, select: { id: true, platformAdmin: true, disabledAt: true, accountStatus: true, platformRoleId: true } });
        if (!target) return 'missing';
        if (target.id === session.userId) return 'self';
        if (enabled && (target.disabledAt || target.accountStatus !== 'APPROVED')) return 'inactive';
        if (target.platformAdmin === enabled) return 'unchanged';
        await transaction.user.update({ where: { id: target.id }, data: { platformAdmin: enabled, platformRoleId: null } });
        await transaction.session.updateMany({ where: { revokedAt: null, OR: [{ userId: target.id }, { supportParent: { userId: target.id } }] }, data: { revokedAt: new Date() } });
        await transaction.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: enabled ? 'admin.role.admin_granted' : 'admin.role.admin_revoked', targetType: 'user', targetId: request.params.publicId, requestId: request.id, metadata: { platformAdmin: enabled, previousPlatformAdmin: target.platformAdmin, previousRoleId: target.platformRoleId } } });
        return 'updated';
      }, { isolationLevel: 'Serializable' });
      if (result === 'forbidden') return reply.code(403).send(failure(request, 'FORBIDDEN', 'Seu acesso administrativo foi alterado. Entre novamente.'));
      if (result === 'missing') return reply.code(404).send(failure(request, 'USER_NOT_FOUND', 'Conta não encontrada.'));
      if (result === 'self') return reply.code(409).send(failure(request, 'ADMIN_SELF_CHANGE', 'Peça a outro administrador para alterar o seu acesso.'));
      if (result === 'inactive') return reply.code(409).send(failure(request, 'ADMIN_TARGET_INACTIVE', 'Escolha uma conta aprovada e ativa.'));
      return reply.send({ updated: result === 'updated' });
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2034') return reply.code(409).send(failure(request, 'ADMIN_ACCESS_CONFLICT', 'A equipe foi alterada durante a solicitação. Atualize a página e tente novamente.'));
      throw error;
    }
  });
  app.get<{ Querystring: { page?: string } }>('/admin/access-audit', async (request, reply) => {
    if (!await requirePlatformSession(request, environment, auth, 'audit.read')) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Sem permissão para consultar a auditoria.'));
    const page = Math.min(10000, Math.max(1, Number.parseInt(request.query.page ?? '1', 10) || 1));
    const where = { OR: [{ action: { startsWith: 'admin.support.' } }, { action: { startsWith: 'admin.role.' } }] };
    const [total, items] = await Promise.all([db.auditLog.count({ where }), db.auditLog.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * 30, take: 30, select: { id: true, action: true, targetId: true, requestId: true, metadata: true, createdAt: true, actor: { select: { publicId: true, name: true, email: true } } } })]);
    return reply.header('cache-control', 'private, no-store').send({ items: items.map(item => ({ ...item, id: item.id.toString() })), pagination: { page, total, pages: Math.max(1, Math.ceil(total / 30)) } });
  });
}
