import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository, SessionUser } from './auth-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerAdminUserRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const secure = environment.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';

  const adminSession = async (request: FastifyRequest): Promise<SessionUser | null> => {
    const token = request.cookies[sessionCookie];
    const session = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    return session?.user.platformAdmin ? session : null;
  };
  const mutationAllowed = (request: FastifyRequest, session: SessionUser): boolean => {
    const origin = request.headers.origin;
    const header = request.headers['x-csrf-token'];
    const cookie = request.cookies[csrfCookie];
    return typeof origin === 'string' && environment.CORS_ORIGINS.includes(origin) && typeof header === 'string' && Boolean(cookie) && safeEqual(cookie!, header) && safeEqual(sha256(header), session.csrfTokenHash);
  };

  app.get<{ Querystring: { status?: string; page?: string } }>('/admin/users', async (request, reply) => {
    const session = await adminSession(request);
    if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));
    const allowed = ['PENDING', 'APPROVED', 'REJECTED'] as const;
    const status = allowed.includes(request.query.status as typeof allowed[number]) ? request.query.status as typeof allowed[number] : 'PENDING';
    const page = Math.max(1, Number.parseInt(request.query.page ?? '1', 10) || 1);
    const pageSize = 30;
    const where = { accountStatus: status };
    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        select: { publicId: true, name: true, email: true, accountStatus: true, platformAdmin: true, disabledAt: true, emailVerifiedAt: true, createdAt: true, memberships: { select: { role: true, store: { select: { name: true, publicId: true } } } } }
      })
    ]);
    return reply.header('cache-control', 'private, no-store').send({ users, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
  });

  app.post<{ Params: { publicId: string } }>('/admin/users/:publicId/approve', async (request, reply) => {
    const session = await adminSession(request);
    if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));
    if (!mutationAllowed(request, session)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const target = await db.user.findUnique({ where: { publicId: request.params.publicId }, select: { id: true, publicId: true } });
    if (!target) return reply.code(404).send(failure(request, 'USER_NOT_FOUND', 'Usuário não encontrado.'));
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { accountStatus: 'APPROVED', disabledAt: null } }),
      db.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: 'admin.user_approved', targetType: 'user', targetId: target.publicId, requestId: request.id } })
    ]);
    return reply.send({ status: 'APPROVED' });
  });

  app.post<{ Params: { publicId: string } }>('/admin/users/:publicId/block', async (request, reply) => {
    const session = await adminSession(request);
    if (!session) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));
    if (!mutationAllowed(request, session)) return reply.code(403).send(failure(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (request.params.publicId === session.user.publicId) return reply.code(409).send(failure(request, 'SELF_BLOCK_FORBIDDEN', 'Você não pode bloquear sua própria conta.'));
    const target = await db.user.findUnique({ where: { publicId: request.params.publicId }, select: { id: true, publicId: true, platformAdmin: true } });
    if (!target) return reply.code(404).send(failure(request, 'USER_NOT_FOUND', 'Usuário não encontrado.'));
    if (target.platformAdmin) return reply.code(409).send(failure(request, 'ADMIN_BLOCK_FORBIDDEN', 'Outro administrador da plataforma não pode ser bloqueado por esta tela.'));
    const now = new Date();
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { accountStatus: 'REJECTED', disabledAt: now } }),
      db.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: now } }),
      db.auditLog.create({ data: { actorType: 'USER', actorUserId: session.userId, action: 'admin.user_blocked', targetType: 'user', targetId: target.publicId, requestId: request.id, metadata: { sessionsRevoked: true } } })
    ]);
    return reply.send({ status: 'REJECTED' });
  });
}
