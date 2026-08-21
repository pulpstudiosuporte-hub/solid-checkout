import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { resolveCname } from 'node:dns/promises';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository, SessionUser } from './auth-repository.js';
import type { StoreRepository } from './store-repository.js';
import type { DokployDomainClient } from './dokploy-client.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const slugify = (value: string): string => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'loja';
const checkoutTarget = 'pay.solidcheckout.xyz';
const normaliseHostname = (value: string): string => value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
const validCheckoutHostname = (hostname: string): boolean => hostname.length <= 253 && hostname.split('.').length >= 3 && /^(?=.{1,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(hostname) && !hostname.endsWith('.solidcheckout.xyz');

export function registerStoreRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, stores: StoreRepository, dokploy?: DokployDomainClient): void {
  const secure = environment.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-solid_session' : 'solid_session'; const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';
  const authenticate = async (request: FastifyRequest, mutation = false): Promise<SessionUser | null> => {
    const token = request.cookies[sessionCookie]; if (!token) return null;
    const session = await auth.findActiveSession(sha256(token), new Date()); if (!session) return null;
    if (mutation) {
      const cookieToken = request.cookies[csrfCookie]; const headerToken = request.headers['x-csrf-token']; const origin = request.headers.origin;
      if (typeof origin !== 'string' || !environment.CORS_ORIGINS.includes(origin) || !cookieToken || typeof headerToken !== 'string' || !safeEqual(cookieToken, headerToken) || !safeEqual(sha256(headerToken), session.csrfTokenHash)) return null;
    }
    return session;
  };

  app.get('/stores', async (request, reply) => {
    const session = await authenticate(request);
    if (!session) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    return reply.send({ items: await stores.listForUser(session.userId, session.sessionId) });
  });

  app.post<{ Body: { name?: unknown } }>('/stores', async (request, reply) => {
    const session = await authenticate(request, true);
    if (!session) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
    const hasControlCharacter = Array.from(name).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
    if (name.length < 3 || name.length > 120 || hasControlCharacter) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'O nome da loja deve ter entre 3 e 120 caracteres.'));
    const slug = `${slugify(name)}-${randomBytes(4).toString('hex')}`;
    const store = await stores.createForUser(session.userId, session.sessionId, name, slug, request.id);
    if (!store) return reply.code(409).send(errorBody(request, 'STORE_LIMIT_REACHED', 'Limite de lojas atingido.'));
    return reply.code(201).send({ store });
  });

  app.post<{ Params: { storeId: string } }>('/stores/:storeId/select', async (request, reply) => {
    const session = await authenticate(request, true);
    if (!session) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(request.params.storeId)) return reply.code(404).send(errorBody(request, 'STORE_NOT_FOUND', 'Loja não encontrada.'));
    const store = await stores.selectForUser(session.userId, session.sessionId, request.params.storeId, request.id);
    if (!store) return reply.code(404).send(errorBody(request, 'STORE_NOT_FOUND', 'Loja não encontrada.'));
    return reply.send({ store });
  });
  app.delete<{ Params: { storeId: string } }>('/stores/:storeId', async (request, reply) => {
    const session = await authenticate(request, true); if (!session) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(request.params.storeId)) return reply.code(404).send(errorBody(request, 'STORE_NOT_FOUND', 'Loja não encontrada.'));
    if (!await stores.archiveForUser(session.userId, session.sessionId, request.params.storeId, request.id)) return reply.code(409).send(errorBody(request, 'STORE_ARCHIVE_NOT_ALLOWED', 'Não foi possível arquivar esta loja. Mantenha ao menos uma loja ativa.'));
    return reply.code(204).send();
  });

  app.get('/store-domain', async (request, reply) => {
    const session = await authenticate(request); if (!session) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    return reply.send({ domain: await stores.getDomainForUser(session.userId, session.sessionId), cnameTarget: checkoutTarget });
  });

  app.put<{ Body: { hostname?: unknown } }>('/store-domain', async (request, reply) => {
    const session = await authenticate(request, true); if (!session) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const hostname = typeof request.body?.hostname === 'string' ? normaliseHostname(request.body.hostname) : '';
    if (!validCheckoutHostname(hostname)) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Use um subdomínio válido, como checkout.sualoja.com.'));
    try {
      const previous = await stores.getDomainForUser(session.userId, session.sessionId);
      if (previous && previous.hostname !== hostname && previous.dokployDomainId && dokploy) await dokploy.deleteCheckoutDomain(previous.dokployDomainId);
      const domain = await stores.saveDomainForUser(session.userId, session.sessionId, hostname, request.id);
      if (!domain) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Somente proprietários e administradores podem alterar domínios.'));
      return reply.send({ domain, cnameTarget: checkoutTarget });
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') return reply.code(409).send(errorBody(request, 'DOMAIN_IN_USE', 'Este domínio já está conectado a outra loja SOLID.'));
      throw error;
    }
  });

  app.post<{ Params: { domainId: string } }>('/store-domain/:domainId/verify', async (request, reply) => {
    const session = await authenticate(request, true); if (!session) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const current = await stores.getDomainForUser(session.userId, session.sessionId);
    if (!current || current.publicId !== request.params.domainId) return reply.code(404).send(errorBody(request, 'DOMAIN_NOT_FOUND', 'Domínio não encontrado.'));
    let verified = false;
    try { verified = (await resolveCname(current.hostname)).some(value => value.replace(/\.$/, '').toLowerCase() === checkoutTarget); } catch { verified = false; }
    let domain = await stores.updateDomainVerification(session.userId, session.sessionId, current.publicId, verified, request.id);
    if (!domain) return reply.code(404).send(errorBody(request, 'DOMAIN_NOT_FOUND', 'Domínio não encontrado.'));
    if (verified && dokploy && !domain.dokployDomainId) {
      try {
        const existingDomainId = await dokploy.findCheckoutDomain(current.hostname);
        const dokployDomainId = existingDomainId ?? await dokploy.createCheckoutDomain(current.hostname);
        domain = await stores.activateDomainForUser(session.userId, session.sessionId, current.publicId, dokployDomainId, request.id) ?? domain;
      }
      catch (error) { request.log.error({ err: error, hostname: current.hostname }, 'dokploy_domain_activation_failed'); return reply.code(502).send(errorBody(request, 'DOMAIN_ACTIVATION_FAILED', 'DNS validado, mas não foi possível ativar o checkout. Tente novamente em alguns instantes.')); }
    }
    return reply.send({ domain, cnameTarget: checkoutTarget, verified, activated: domain.status === 'ACTIVE' });
  });

  app.delete<{ Params: { domainId: string } }>('/store-domain/:domainId', async (request, reply) => {
    const session = await authenticate(request, true); if (!session) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.'));
    const current = await stores.getDomainForUser(session.userId, session.sessionId);
    if (!current || current.publicId !== request.params.domainId) return reply.code(404).send(errorBody(request, 'DOMAIN_NOT_FOUND', 'Domínio não encontrado.'));
    if (current.dokployDomainId && dokploy) { try { await dokploy.deleteCheckoutDomain(current.dokployDomainId); } catch (error) { request.log.error({ err: error, hostname: current.hostname }, 'dokploy_domain_deletion_failed'); return reply.code(502).send(errorBody(request, 'DOMAIN_DELETION_FAILED', 'Não foi possível remover a rota do checkout. Tente novamente.')); } }
    if (!await stores.deleteDomainForUser(session.userId, session.sessionId, request.params.domainId, request.id)) return reply.code(404).send(errorBody(request, 'DOMAIN_NOT_FOUND', 'Domínio não encontrado.'));
    return reply.code(204).send();
  });
}
