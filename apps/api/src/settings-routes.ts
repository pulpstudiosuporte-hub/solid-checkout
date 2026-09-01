import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { Prisma, PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository } from './auth-repository.js';
import { refreshStoreOnboarding } from './store-onboarding.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const same = (left: string, right: string) => { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const plainObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const cleanText = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const digits = (value: string) => value.replace(/\D/g, '');
const validDocument = (value: string) => [11, 14].includes(digits(value).length);

export function registerSettingsRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const sessionCookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = environment.NODE_ENV === 'production' ? '__Host-solid_csrf' : 'solid_csrf';
  const context = async (request: FastifyRequest, mutation = false) => {
    const raw = request.cookies[sessionCookie]; const session = raw ? await auth.findActiveSession(sha256(raw), new Date()) : null;
    if (!session) return null;
    if (mutation) { const origin = request.headers.origin; const cookie = request.cookies[csrfCookie]; const header = request.headers['x-csrf-token']; if (typeof origin !== 'string' || !environment.CORS_ORIGINS.includes(origin) || !cookie || typeof header !== 'string' || !same(cookie, header) || !same(sha256(header), session.csrfTokenHash)) return null; }
    const selected = await db.session.findUnique({ where: { id: session.sessionId }, select: { activeStoreId: true } });
    if (!selected?.activeStoreId) return null;
    const membership = await db.storeMember.findUnique({ where: { storeId_userId: { storeId: selected.activeStoreId, userId: session.userId } }, select: { role: true } });
    return membership ? { session, storeId: selected.activeStoreId, role: membership.role } : null;
  };

  app.get('/settings', async (request, reply) => {
    const current = await context(request); if (!current) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    const [store, user, members, state] = await Promise.all([
      db.store.findUnique({ where: { id: current.storeId }, select: { publicId: true, name: true, profile: true } }),
      db.user.findUnique({ where: { id: current.session.userId }, select: { publicId: true, name: true, email: true, emailVerifiedAt: true, profile: true, mfaEnabledAt: true } }),
      db.storeMember.findMany({ where: { storeId: current.storeId }, orderBy: { createdAt: 'asc' }, select: { role: true, createdAt: true, user: { select: { publicId: true, name: true, email: true, disabledAt: true } } } }),
      db.notificationState.findUnique({ where: { userId_storeId: { userId: current.session.userId, storeId: current.storeId } }, select: { preferences: true } }),
    ]);
    const activation = store && user ? await refreshStoreOnboarding(db, current.storeId, current.session.userId) : { completed: false, completedAt: null, missing: ['store'] };
    return reply.header('cache-control', 'private, no-store').send({ store, user, activation, members: members.map(item => ({ ...item.user, role: item.role, createdAt: item.createdAt, status: item.user.disabledAt ? 'DISABLED' : 'ACTIVE' })), preferences: state?.preferences ?? null, role: current.role });
  });

  app.patch<{ Body: { section?: unknown; values?: unknown } }>('/settings', async (request, reply) => {
    const current = await context(request, true); if (!current) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    const section = request.body?.section; const values = request.body?.values;
    if (!plainObject(values)) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Dados inválidos.'));
    if (section === 'store') {
      if (!['OWNER', 'ADMIN'].includes(current.role)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Sem permissão para alterar a loja.'));
      const name = cleanText(values.name, 120); if (name.length < 3) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Informe o nome da loja.'));
      const profile = { document: cleanText(values.document, 18), legalName: cleanText(values.legalName, 120), businessModel: cleanText(values.businessModel, 50), monthlyRevenue: cleanText(values.monthlyRevenue, 50), website: cleanText(values.website, 255), noWebsite: Boolean(values.noWebsite), instagram: cleanText(values.instagram, 80) };
      if (profile.document && !validDocument(profile.document)) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Informe um CPF ou CNPJ válido para a loja.'));
      if (profile.website && !profile.noWebsite) { try { if (new URL(profile.website).protocol !== 'https:') throw new Error(); } catch { return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Informe uma URL HTTPS válida para o site.')); } }
      await db.store.update({ where: { id: current.storeId }, data: { name, profile: profile as Prisma.InputJsonValue } });
    } else if (section === 'user') {
      const name = cleanText(values.name, 120); if (name.length < 3) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Informe seu nome.'));
      const profile = { document: cleanText(values.document, 18), birthDate: cleanText(values.birthDate, 10), zipCode: cleanText(values.zipCode, 10), address: cleanText(values.address, 180), number: cleanText(values.number, 20), complement: cleanText(values.complement, 80), district: cleanText(values.district, 80), city: cleanText(values.city, 80), state: cleanText(values.state, 2).toUpperCase() };
      if (profile.document && !validDocument(profile.document)) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Informe um CPF ou CNPJ válido.'));
      if (profile.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate)) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Informe uma data de nascimento válida.'));
      if (profile.zipCode && digits(profile.zipCode).length !== 8) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Informe um CEP válido.'));
      if (profile.state && !/^[A-Z]{2}$/.test(profile.state)) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Informe uma UF válida.'));
      await db.user.update({ where: { id: current.session.userId }, data: { name, profile: profile as Prisma.InputJsonValue } });
    } else if (section === 'notifications') {
      const preferences = { salesEnabled: values.salesEnabled !== false, newOrder: values.newOrder !== false, paymentConfirmed: values.paymentConfirmed !== false, includeStoreName: Boolean(values.includeStoreName), productEnabled: values.productEnabled !== false, releases: values.releases !== false, feedback: values.feedback !== false };
      await db.notificationState.upsert({ where: { userId_storeId: { userId: current.session.userId, storeId: current.storeId } }, create: { userId: current.session.userId, storeId: current.storeId, preferences: preferences as Prisma.InputJsonValue }, update: { preferences: preferences as Prisma.InputJsonValue } });
    } else return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Seção inválida.'));
    const activation = section === 'store' || section === 'user' ? await refreshStoreOnboarding(db, current.storeId, current.session.userId) : undefined;
    return reply.send({ saved: true, ...(activation ? { activation } : {}) });
  });
}
