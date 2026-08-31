import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { Prisma, PrismaClient } from '@solid/database';
import type { AuthRepository } from './auth-repository.js';
import { decryptSecret, encryptSecret } from './shopify-crypto.js';

export const webhookEvents = ['order.created', 'order.paid', 'order.cancelled', 'order.refunded', 'payment.failed'] as const;
type WebhookEvent = typeof webhookEvents[number];
export type StoreWebhookDispatcher = (storeId: string, event: WebhookEvent, data: Record<string, unknown>) => Promise<void>;
const MAX_ENDPOINTS_PER_STORE = 20;
const MAX_ATTEMPTS = 8;
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

const blocked = new BlockList();
for (const [network, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32]] as const) blocked.addSubnet(network, prefix, 'ipv6');

function publicAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return !blocked.check(mapped, 'ipv4');
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, 'ipv4') : family === 6 ? !blocked.check(address, 'ipv6') : false;
}

type ResolvedWebhook = Readonly<{ url: URL; address: string; family: 4 | 6 }>;
export async function resolveSafeWebhookUrl(value: unknown): Promise<ResolvedWebhook> {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Informe uma URL válida.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Informe uma URL válida.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Use uma URL HTTPS pública, sem credenciais ou porta personalizada.');
  const results = isIP(url.hostname) ? [{ address: url.hostname, family: isIP(url.hostname) as 4 | 6 }] : await lookup(url.hostname, { all: true, verbatim: true });
  if (!results.length || results.some(result => !publicAddress(result.address))) throw new Error('A URL deve apontar para um servidor público.');
  const selected = results[0]!;
  return { url, address: selected.address, family: selected.family as 4 | 6 };
}

function validEvents(value: unknown): WebhookEvent[] {
  if (!Array.isArray(value) || !value.length || value.length > webhookEvents.length) throw new Error('Selecione pelo menos um evento.');
  const events = [...new Set(value.filter((item): item is string => typeof item === 'string'))];
  if (events.some(event => !webhookEvents.includes(event as WebhookEvent))) throw new Error('Evento inválido.');
  return events as WebhookEvent[];
}

async function postPinnedWebhook(resolved: ResolvedWebhook, body: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest({
      protocol: 'https:', hostname: resolved.url.hostname, servername: resolved.url.hostname,
      path: `${resolved.url.pathname}${resolved.url.search}`, method: 'POST', headers,
      lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family),
      timeout: 10_000,
    }, response => { response.resume(); response.once('end', () => resolve(response.statusCode ?? 0)); });
    request.once('timeout', () => request.destroy(new Error('Tempo limite excedido.')));
    request.once('error', reject);
    request.end(body);
  });
}

async function sendWebhook(url: string, secretEncrypted: string, encryptionKey: string, event: string, payload: unknown): Promise<{ statusCode: number; durationMs: number }> {
  const resolved = await resolveSafeWebhookUrl(url);
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secret = decryptSecret(secretEncrypted, encryptionKey);
  const started = Date.now();
  const statusCode = await postPinnedWebhook(resolved, body, {
    'content-type': 'application/json', 'content-length': Buffer.byteLength(body).toString(), 'user-agent': 'SOLID-Webhooks/1.0',
    'x-solid-event': event, 'x-solid-timestamp': timestamp,
    'x-solid-signature': `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`,
  });
  return { statusCode, durationMs: Date.now() - started };
}

type WebhookOutboxDatabase = Pick<PrismaClient, 'webhookEndpoint' | 'webhookDelivery'>;
export async function enqueueStoreWebhookEvent(database: WebhookOutboxDatabase, storeId: string, event: WebhookEvent, data: Record<string, unknown>, eventKey?: string): Promise<void> {
  const endpoints = await database.webhookEndpoint.findMany({ where: { storeId, active: true, events: { has: event } }, take: MAX_ENDPOINTS_PER_STORE, select: { id: true } });
  if (!endpoints.length) return;
  const eventId = eventKey ? `evt_${sha256(`${storeId}:${event}:${eventKey}`).slice(0, 32)}` : `evt_${Date.now()}_${randomBytes(8).toString('hex')}`;
  const payload = { id: eventId, event, createdAt: new Date().toISOString(), test: false, data } as Prisma.InputJsonValue;
  await database.webhookDelivery.createMany({ data: endpoints.map(endpoint => ({ storeId, webhookEndpointId: endpoint.id, event, eventId, payload, nextAttemptAt: new Date() })), skipDuplicates: true });
}

export function createStoreWebhookDispatcher(_environment: AppEnvironment, database: PrismaClient): StoreWebhookDispatcher {
  return (storeId, event, data) => enqueueStoreWebhookEvent(database, storeId, event, data);
}

export function startWebhookDelivery(environment: AppEnvironment, database: PrismaClient, logger: FastifyBaseLogger): () => void {
  let running = false;
  const run = async () => {
    if (running || !environment.APP_ENCRYPTION_KEY) return;
    running = true;
    try {
      const now = new Date();
      const stale = new Date(now.getTime() - 5 * 60_000);
      const candidates = await database.webhookDelivery.findMany({
        where: { OR: [{ status: 'PENDING', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, { status: 'PROCESSING', claimedAt: { lte: stale } }] },
        orderBy: { nextAttemptAt: 'asc' }, take: 20,
        select: { id: true, event: true, payload: true, attempts: true, webhookEndpoint: { select: { active: true, url: true, secretEncrypted: true } } },
      });
      await Promise.all(candidates.map(async candidate => {
        const claimed = await database.webhookDelivery.updateMany({ where: { id: candidate.id, OR: [{ status: 'PENDING' }, { status: 'PROCESSING', claimedAt: { lte: stale } }] }, data: { status: 'PROCESSING', claimedAt: now } });
        if (!claimed.count) return;
        if (!candidate.webhookEndpoint.active) { await database.webhookDelivery.update({ where: { id: candidate.id }, data: { status: 'DEAD', claimedAt: null, error: 'Endpoint inativo.' } }); return; }
        try {
          const result = await sendWebhook(candidate.webhookEndpoint.url, candidate.webhookEndpoint.secretEncrypted, environment.APP_ENCRYPTION_KEY!, candidate.event, candidate.payload);
          if (result.statusCode < 200 || result.statusCode >= 300) throw new Error(`HTTP ${result.statusCode}`);
          await database.webhookDelivery.update({ where: { id: candidate.id }, data: { status: 'DELIVERED', success: true, statusCode: result.statusCode, durationMs: result.durationMs, deliveredAt: new Date(), claimedAt: null, nextAttemptAt: null, error: null } });
        } catch (error) {
          const attempts = candidate.attempts + 1;
          const dead = attempts >= MAX_ATTEMPTS;
          await database.webhookDelivery.update({ where: { id: candidate.id }, data: { status: dead ? 'DEAD' : 'PENDING', success: false, attempts, claimedAt: null, nextAttemptAt: dead ? null : new Date(Date.now() + Math.min(360, 2 ** attempts) * 60_000), error: (error instanceof Error ? error.message : 'Falha no envio').slice(0, 500) } });
        }
      }));
    } catch (error) { logger.error({ err: error }, 'webhook_delivery_failed'); }
    finally { running = false; }
  };
  void run();
  const interval = setInterval(() => void run(), 15_000); interval.unref();
  return () => clearInterval(interval);
}

export function registerWebhookRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, database: PrismaClient): void {
  const sessionCookie = environment.NODE_ENV === 'production' ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = environment.NODE_ENV === 'production' ? '__Host-solid_csrf' : 'solid_csrf';
  const context = async (request: FastifyRequest, mutation = false) => {
    const token = request.cookies[sessionCookie]; const current = token ? await auth.findActiveSession(sha256(token), new Date()) : null; if (!current) return null;
    if (mutation) { const origin = request.headers.origin, cookie = request.cookies[csrfCookie], header = request.headers['x-csrf-token']; if (typeof origin !== 'string' || !environment.CORS_ORIGINS.includes(origin) || !cookie || typeof header !== 'string' || !safeEqual(cookie, header) || !safeEqual(sha256(header), current.csrfTokenHash)) return null; }
    const active = await database.session.findFirst({ where: { id: current.sessionId, userId: current.userId, revokedAt: null }, select: { activeStoreId: true } }); if (!active?.activeStoreId) return null;
    const member = await database.storeMember.findUnique({ where: { storeId_userId: { storeId: active.activeStoreId, userId: current.userId } }, select: { role: true } });
    return member ? { storeId: active.activeStoreId, writable: ['OWNER', 'ADMIN'].includes(member.role) } : null;
  };
  app.get('/store-webhooks', async (request, reply) => { const ctx = await context(request); if (!ctx) return reply.code(401).send(errorBody(request, 'UNAUTHENTICATED', 'Autenticação necessária.')); const items = await database.webhookEndpoint.findMany({ where: { storeId: ctx.storeId }, orderBy: { createdAt: 'desc' }, take: MAX_ENDPOINTS_PER_STORE, select: { publicId: true, name: true, description: true, url: true, active: true, events: true, createdAt: true, updatedAt: true, _count: { select: { deliveries: true } }, deliveries: { orderBy: { createdAt: 'desc' }, take: 1, select: { success: true, status: true, statusCode: true, createdAt: true, error: true } } } }); return reply.header('cache-control', 'private, no-store').send({ items, writable: ctx.writable, events: webhookEvents, limit: MAX_ENDPOINTS_PER_STORE }); });
  app.post<{ Body: { name?: unknown; description?: unknown; url?: unknown; secret?: unknown; active?: unknown; events?: unknown } }>('/store-webhooks', async (request, reply) => { const ctx = await context(request, true); if (!ctx?.writable) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.')); if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Criptografia indisponível.')); if (await database.webhookEndpoint.count({ where: { storeId: ctx.storeId } }) >= MAX_ENDPOINTS_PER_STORE) return reply.code(409).send(errorBody(request, 'LIMIT_REACHED', `Limite de ${MAX_ENDPOINTS_PER_STORE} webhooks por loja atingido.`)); try { const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''; if (name.length < 2 || name.length > 120) throw new Error('Informe um nome entre 2 e 120 caracteres.'); const description = typeof request.body.description === 'string' ? request.body.description.trim().slice(0, 240) : null; const resolved = await resolveSafeWebhookUrl(request.body.url); const events = validEvents(request.body.events); const secret = typeof request.body.secret === 'string' && request.body.secret.trim().length >= 16 ? request.body.secret.trim() : randomBytes(32).toString('hex'); const item = await database.webhookEndpoint.create({ data: { storeId: ctx.storeId, name, description: description || null, url: resolved.url.toString(), active: request.body.active !== false, events, secretEncrypted: encryptSecret(secret, environment.APP_ENCRYPTION_KEY) }, select: { publicId: true, name: true, description: true, url: true, active: true, events: true } }); return reply.code(201).send({ item, secret }); } catch (error) { return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', error instanceof Error ? error.message : 'Dados inválidos.')); } });
  app.patch<{ Params: { id: string }; Body: { name?: unknown; description?: unknown; url?: unknown; active?: unknown; events?: unknown } }>('/store-webhooks/:id', async (request, reply) => { const ctx = await context(request, true); if (!ctx?.writable) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.')); const existing = await database.webhookEndpoint.findFirst({ where: { publicId: request.params.id, storeId: ctx.storeId } }); if (!existing) return reply.code(404).send(errorBody(request, 'NOT_FOUND', 'Webhook não encontrado.')); try { const data: { name?: string; description?: string | null; url?: string; active?: boolean; events?: string[] } = {}; if (request.body.name !== undefined) { const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''; if (name.length < 2 || name.length > 120) throw new Error('Nome inválido.'); data.name = name; } if (request.body.description !== undefined) data.description = typeof request.body.description === 'string' ? request.body.description.trim().slice(0, 240) || null : null; if (request.body.url !== undefined) data.url = (await resolveSafeWebhookUrl(request.body.url)).url.toString(); if (typeof request.body.active === 'boolean') data.active = request.body.active; if (request.body.events !== undefined) data.events = validEvents(request.body.events); const item = await database.webhookEndpoint.update({ where: { id: existing.id }, data, select: { publicId: true, name: true, description: true, url: true, active: true, events: true } }); return reply.send({ item }); } catch (error) { return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', error instanceof Error ? error.message : 'Dados inválidos.')); } });
  app.delete<{ Params: { id: string } }>('/store-webhooks/:id', async (request, reply) => { const ctx = await context(request, true); if (!ctx?.writable) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.')); const result = await database.webhookEndpoint.deleteMany({ where: { publicId: request.params.id, storeId: ctx.storeId } }); return result.count ? reply.code(204).send() : reply.code(404).send(errorBody(request, 'NOT_FOUND', 'Webhook não encontrado.')); });
  app.post<{ Params: { id: string }; Body: { event?: unknown } }>('/store-webhooks/:id/test', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => { const ctx = await context(request, true); if (!ctx?.writable) return reply.code(403).send(errorBody(request, 'FORBIDDEN', 'Acesso negado.')); if (!environment.APP_ENCRYPTION_KEY) return reply.code(503).send(errorBody(request, 'SERVICE_UNAVAILABLE', 'Criptografia indisponível.')); const endpoint = await database.webhookEndpoint.findFirst({ where: { publicId: request.params.id, storeId: ctx.storeId } }); if (!endpoint) return reply.code(404).send(errorBody(request, 'NOT_FOUND', 'Webhook não encontrado.')); const event = typeof request.body?.event === 'string' ? request.body.event : 'order.created'; if (!webhookEvents.includes(event as WebhookEvent)) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Evento inválido.')); const eventId = `evt_test_${Date.now()}_${randomBytes(4).toString('hex')}`; const payload = { id: eventId, event, createdAt: new Date().toISOString(), test: true, data: { order: { id: 'SLD-EXEMPLO', paymentId: 'PAY-EXEMPLO', status: 'PENDING', totalCents: 9990, currency: 'BRL' } } }; try { const result = await sendWebhook(endpoint.url, endpoint.secretEncrypted, environment.APP_ENCRYPTION_KEY, event, payload); const success = result.statusCode >= 200 && result.statusCode < 300; await database.webhookDelivery.create({ data: { storeId: ctx.storeId, webhookEndpointId: endpoint.id, event, eventId, payload, status: success ? 'DELIVERED' : 'DEAD', success, statusCode: result.statusCode, durationMs: result.durationMs, deliveredAt: success ? new Date() : null, error: success ? null : `HTTP ${result.statusCode}` } }); return reply.send({ success, statusCode: result.statusCode, durationMs: result.durationMs }); } catch (error) { await database.webhookDelivery.create({ data: { storeId: ctx.storeId, webhookEndpointId: endpoint.id, event, eventId, payload, status: 'DEAD', success: false, attempts: 1, error: (error instanceof Error ? error.message : 'Falha no envio').slice(0, 500) } }); return reply.code(502).send(errorBody(request, 'DELIVERY_FAILED', 'Não foi possível entregar o teste ao endpoint.')); } });
}
