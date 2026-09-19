import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { Prisma, PrismaClient } from '@solid/database';
import type { AuthRepository } from './auth-repository.js';
import type { CatalogRepository } from './catalog-repository.js';
import { checkoutConfig } from './catalog-routes.js';
import { storeOnboardingComplete } from './store-onboarding.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const fail = (code: string, message: string) => ({ error: { code, message } });
const writable = (role: string) => role === 'OWNER' || role === 'ADMIN';
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const checkoutSelect = { id: true, publicId: true, name: true, mode: true, draftConfig: true, publishedConfig: true, updatedAt: true, status: true } as const;

// Device approval uses the browser session. CLI tokens can only reach these
// endpoints; they are deliberately not accepted by normal merchant/admin APIs.
export function registerCliRoutes(app: FastifyInstance, env: AppEnvironment, auth: AuthRepository, catalog: CatalogRepository, db: PrismaClient) {
  const prefix = env.NODE_ENV === 'production' ? '__Host-solid_' : 'solid_';
  const browserContext = async (request: FastifyRequest, mutation = false) => {
    const cookie = request.cookies[`${prefix}session`];
    if (!cookie) return null;
    const session = await auth.findActiveSession(hash(cookie), new Date());
    if (!session || session.support) return null;
    if (mutation) {
      const csrf = request.headers['x-csrf-token'];
      if (typeof csrf !== 'string' || !env.CORS_ORIGINS.includes(request.headers.origin ?? '') || request.cookies[`${prefix}csrf`] !== csrf || hash(csrf) !== session.csrfTokenHash) return null;
    }
    const context = await catalog.resolveStoreContext(session.userId, session.sessionId);
    return context && writable(context.role) ? context : null;
  };
  const cliContext = async (request: FastifyRequest) => {
    const bearer = request.headers.authorization;
    if (!bearer || !/^Bearer pirat_[A-Za-z0-9_-]{43}$/.test(bearer)) return null;
    const connection = await db.cliConnection.findFirst({ where: { tokenHash: hash(bearer.slice(7)), revokedAt: null, expiresAt: { gt: new Date() }, user: { disabledAt: null, accountStatus: 'APPROVED' }, store: { active: true } } });
    if (!connection) return null;
    const member = await db.storeMember.findUnique({ where: { storeId_userId: { storeId: connection.storeId, userId: connection.userId } } });
    return member && writable(member.role) ? connection : null;
  };
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/cli/')) reply.header('Cache-Control', 'no-store');
    return payload;
  });

  app.post<{ Body: { challenge?: unknown; label?: unknown } }>('/cli/device', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const { challenge, label } = request.body ?? {};
    if (typeof challenge !== 'string' || !/^[a-f0-9]{64}$/.test(challenge) || typeof label !== 'string' || !label.trim() || label.length > 80) return reply.code(400).send(fail('INVALID_DEVICE', 'Informe um nome e um desafio válidos.'));
    const deviceToken = token(); const userCode = randomBytes(5).toString('hex').toUpperCase();
    await db.cliDevice.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await db.cliDevice.create({ data: { tokenHash: hash(deviceToken), challenge, userCode, label: label.trim(), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    return { deviceToken, userCode, expiresIn: 600, interval: 5, verificationUrl: `${(env.APP_URL ?? env.CORS_ORIGINS[0] ?? '').replace(/\/$/, '')}/#/cli` };
  });

  app.post<{ Body: { userCode?: unknown; canPublish?: unknown; inspect?: unknown; storePublicId?: unknown } }>('/cli/device/approve', { config: { rateLimit: { max: 15, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const context = await browserContext(request, true);
    if (!context) return reply.code(403).send(fail('FORBIDDEN', 'Use uma conta proprietária ou administradora da loja.'));
    const userCode = typeof request.body?.userCode === 'string' ? request.body.userCode.replace(/[-\s]/g, '').toUpperCase() : '';
    if (!/^[A-F0-9]{10}$/.test(userCode)) return reply.code(400).send(fail('INVALID_CODE', 'Código inválido.'));
    const device = await db.cliDevice.findFirst({ where: { userCode, userId: null, consumedAt: null, expiresAt: { gt: new Date() } } });
    if (!device) return reply.code(404).send(fail('DEVICE_EXPIRED', 'Código expirado ou já utilizado. Inicie a conexão novamente.'));
    const store = await db.store.findUniqueOrThrow({ where: { id: context.storeId }, select: { name: true, publicId: true } });
    if (request.body.inspect === true) return { label: device.label, store, expiresAt: device.expiresAt };
    if (request.body.storePublicId !== store.publicId) return reply.code(409).send(fail('STORE_CHANGED', 'A loja selecionada mudou. Confira novamente antes de autorizar.'));
    if (typeof request.body.canPublish !== 'boolean') return reply.code(400).send(fail('INVALID_SCOPE', 'Escolha a permissão de publicação.'));
    const approved = await db.cliDevice.updateMany({ where: { id: device.id, userId: null, consumedAt: null, expiresAt: { gt: new Date() } }, data: { userId: context.userId, storeId: context.storeId, canPublish: request.body.canPublish } });
    if (!approved.count) return reply.code(409).send(fail('DEVICE_EXPIRED', 'Código já utilizado.'));
    return { approved: true, store };
  });

  app.post<{ Body: { deviceToken?: unknown; verifier?: unknown } }>('/cli/device/token', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { deviceToken, verifier } = request.body ?? {};
    if (typeof deviceToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(deviceToken) || typeof verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(verifier)) return reply.code(400).send(fail('INVALID_DEVICE', 'Conexão inválida.'));
    const device = await db.cliDevice.findFirst({ where: { tokenHash: hash(deviceToken), challenge: hash(verifier), consumedAt: null, expiresAt: { gt: new Date() } } });
    if (!device) return reply.code(410).send(fail('DEVICE_EXPIRED', 'Conexão expirada ou consumida. Execute login novamente.'));
    if (!device.userId || !device.storeId) return reply.code(202).send({ pending: true });
    const accessToken = `pirat_${token()}`; const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
    const consumed = await db.$transaction(async tx => {
      const member = await tx.storeMember.findFirst({ where: { userId: device.userId!, storeId: device.storeId!, role: { in: ['OWNER', 'ADMIN'] }, user: { disabledAt: null, accountStatus: 'APPROVED' }, store: { active: true } } });
      if (!member) return false;
      const updated = await tx.cliDevice.updateMany({ where: { id: device.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
      if (!updated.count) return false;
      const connection = await tx.cliConnection.create({ data: { userId: member.userId, storeId: member.storeId, tokenHash: hash(accessToken), label: device.label, canPublish: device.canPublish, expiresAt } });
      await tx.auditLog.create({ data: { actorType: 'USER', actorUserId: member.userId, storeId: member.storeId, action: 'cli.connected', targetType: 'cli_connection', targetId: connection.id, requestId: request.id } });
      return true;
    });
    if (!consumed) return reply.code(410).send(fail('DEVICE_EXPIRED', 'A conexão não está mais disponível.'));
    const store = await db.store.findUniqueOrThrow({ where: { id: device.storeId }, select: { publicId: true, name: true } });
    return { accessToken, expiresAt, store, canPublish: device.canPublish };
  });

  app.get('/cli/connections', async (request, reply) => {
    const context = await browserContext(request);
    if (!context) return reply.code(403).send(fail('FORBIDDEN', 'Acesso negado.'));
    return { items: await db.cliConnection.findMany({ where: { userId: context.userId, storeId: context.storeId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, label: true, canPublish: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } }) };
  });
  app.delete<{ Params: { id: string } }>('/cli/connections/:id', async (request, reply) => {
    const context = await browserContext(request, true);
    if (!context) return reply.code(403).send(fail('FORBIDDEN', 'Acesso negado.'));
    await db.cliConnection.updateMany({ where: { id: request.params.id, userId: context.userId, storeId: context.storeId }, data: { revokedAt: new Date() } });
    return reply.code(204).send();
  });
  app.post('/cli/logout', async (request, reply) => {
    const connection = await cliContext(request);
    if (!connection) return reply.code(401).send(fail('UNAUTHORIZED', 'Conexão expirada ou revogada.'));
    await db.cliConnection.update({ where: { id: connection.id }, data: { revokedAt: new Date() } });
    return { revoked: true };
  });
  app.get('/cli/me', async (request, reply) => {
    const connection = await cliContext(request);
    if (!connection) return reply.code(401).send(fail('UNAUTHORIZED', 'Conexão expirada ou revogada. Execute login.'));
    return { store: await db.store.findUnique({ where: { id: connection.storeId }, select: { publicId: true, name: true } }), canPublish: connection.canPublish, expiresAt: connection.expiresAt };
  });
  app.get('/cli/checkouts', async (request, reply) => {
    const connection = await cliContext(request);
    if (!connection) return reply.code(401).send(fail('UNAUTHORIZED', 'Execute login.'));
    return { items: await db.checkout.findMany({ where: { storeId: connection.storeId, archivedAt: null }, select: { publicId: true, name: true, status: true, updatedAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }) };
  });
  app.post<{ Body: { config?: unknown } }>('/cli/validate', async (request, reply) => {
    if (!await cliContext(request)) return reply.code(401).send(fail('UNAUTHORIZED', 'Execute login.'));
    const input = request.body?.config;
    if (!object(input) || JSON.stringify(input).length > 100_000) return reply.code(400).send(fail('INVALID_CONFIG', 'Configuração inválida ou acima de 100 KB.'));
    const normalized = checkoutConfig(input);
    if (!normalized) return reply.code(400).send(fail('INVALID_CONFIG', 'A configuração não atende ao contrato do editor.'));
    const unknownFields = Object.keys(input).filter(key => !Object.hasOwn(normalized, key));
    if (unknownFields.length) return reply.code(400).send({ ...fail('UNKNOWN_FIELDS', 'Remova os campos não suportados antes de enviar.'), fields: unknownFields });
    return { valid: true, config: normalized };
  });
  app.get<{ Params: { id: string } }>('/cli/checkouts/:id', async (request, reply) => {
    const connection = await cliContext(request);
    if (!connection) return reply.code(401).send(fail('UNAUTHORIZED', 'Execute login.'));
    const checkout = await db.checkout.findFirst({ where: { publicId: request.params.id, storeId: connection.storeId, archivedAt: null }, select: checkoutSelect });
    if (!checkout) return reply.code(404).send(fail('NOT_FOUND', 'Checkout não encontrado nesta loja.'));
    return { checkout: { id: checkout.publicId, name: checkout.name, config: checkout.draftConfig, revision: checkout.updatedAt.toISOString() }, store: await db.store.findUnique({ where: { id: connection.storeId }, select: { publicId: true } }) };
  });
  app.get<{ Params: { id: string } }>('/cli/checkouts/:id/versions', async (request, reply) => {
    const connection = await cliContext(request);
    if (!connection) return reply.code(401).send(fail('UNAUTHORIZED', 'Execute login.'));
    const checkout = await db.checkout.findFirst({ where: { publicId: request.params.id, storeId: connection.storeId, archivedAt: null }, select: { id: true } });
    if (!checkout) return reply.code(404).send(fail('NOT_FOUND', 'Checkout não encontrado nesta loja.'));
    return { items: await db.checkoutCliVersion.findMany({ where: { checkoutId: checkout.id }, select: { id: true, action: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }) };
  });
  for (const action of ['push', 'publish', 'restore'] as const) {
    app.post<{ Params: { id: string }; Body: { revision?: unknown; config?: unknown; version?: unknown } }>(`/cli/checkouts/:id/${action}`, async (request, reply) => {
      const connection = await cliContext(request);
      if (!connection) return reply.code(401).send(fail('UNAUTHORIZED', 'Execute login.'));
      if (action === 'publish' && !connection.canPublish) return reply.code(403).send(fail('SCOPE_REQUIRED', 'Esta conexão permite editar rascunhos, mas não publicar.'));
      const revision = request.body?.revision;
      if (typeof revision !== 'string' || !Number.isFinite(Date.parse(revision))) return reply.code(400).send(fail('REVISION_REQUIRED', 'Baixe o checkout antes de enviar alterações.'));
      let config: Record<string, unknown> | null = null;
      if (action === 'push') {
        if (!object(request.body.config) || JSON.stringify(request.body.config).length > 100_000) return reply.code(400).send(fail('INVALID_CONFIG', 'Configuração inválida ou acima de 100 KB.'));
        config = checkoutConfig(request.body.config);
        if (!config) return reply.code(400).send(fail('INVALID_CONFIG', 'A configuração não atende ao contrato do editor.'));
        if (Object.keys(request.body.config).some(key => !Object.hasOwn(config!, key))) return reply.code(400).send(fail('UNKNOWN_FIELDS', 'A configuração contém campos não suportados. Execute validate.'));
      }
      if (action === 'restore' && (typeof request.body.version !== 'string' || request.body.version.length > 32)) return reply.code(400).send(fail('INVALID_VERSION', 'Informe a versão que deseja restaurar.'));
      if (action === 'publish' && !await storeOnboardingComplete(db, connection.storeId, env.APP_ENCRYPTION_KEY)) return reply.code(403).send(fail('STORE_ONBOARDING_REQUIRED', 'Complete os dados da loja antes de publicar.'));
      const result = await db.$transaction(async tx => {
        // Serialize with normal editor updates as well as concurrent CLI requests.
        await tx.$queryRaw`SELECT id FROM checkouts WHERE public_id = ${request.params.id} AND store_id = ${connection.storeId}::uuid FOR UPDATE`;
        const current = await tx.checkout.findFirst({ where: { publicId: request.params.id, storeId: connection.storeId, archivedAt: null }, select: { ...checkoutSelect, product: { select: { active: true } } } });
        if (!current) return { error: 'NOT_FOUND' } as const;
        if (current.updatedAt.getTime() !== Date.parse(revision)) return { error: 'CONFLICT' } as const;
        if (action === 'restore') {
          const version = await tx.checkoutCliVersion.findFirst({ where: { id: request.body.version as string, checkoutId: current.id } });
          if (!version || !(config = checkoutConfig(version.config))) return { error: 'VERSION_NOT_FOUND' } as const;
        }
        if (action === 'publish') {
          if (current.mode === 'DIRECT_LINK' && !current.product?.active) return { error: 'PRODUCT_UNAVAILABLE' } as const;
          if (!await tx.storeDomain.count({ where: { storeId: connection.storeId, status: 'ACTIVE' } })) return { error: 'DOMAIN_REQUIRED' } as const;
          if (!checkoutConfig(current.draftConfig)) return { error: 'INVALID_CONFIG' } as const;
        }
        const snapshot = action === 'publish' ? current.publishedConfig : current.draftConfig;
        if (object(snapshot) && Object.keys(snapshot).length) await tx.checkoutCliVersion.create({ data: { checkoutId: current.id, config: snapshot as Prisma.InputJsonValue, action: `before_${action}` } });
        if (action === 'publish' && current.mode === 'SHOPIFY_CART') await tx.checkout.updateMany({ where: { storeId: connection.storeId, mode: 'SHOPIFY_CART', isDefault: true, id: { not: current.id } }, data: { isDefault: false } });
        const updatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1));
        const updated = await tx.checkout.update({ where: { id: current.id }, data: action === 'publish' ? { publishedConfig: current.draftConfig as Prisma.InputJsonValue, status: 'PUBLISHED', isDefault: current.mode === 'SHOPIFY_CART', publishedAt: new Date(), updatedAt } : { draftConfig: config as Prisma.InputJsonValue, updatedAt }, select: checkoutSelect });
        await tx.auditLog.create({ data: { storeId: connection.storeId, actorUserId: connection.userId, actorType: 'USER', action: `cli.checkout_${action}`, targetType: 'checkout', targetId: current.publicId, requestId: request.id, metadata: { connectionId: connection.id } } });
        return { checkout: { id: updated.publicId, revision: updated.updatedAt.toISOString(), status: updated.status } };
      });
      if ('error' in result) return reply.code(result.error === 'NOT_FOUND' || result.error === 'VERSION_NOT_FOUND' ? 404 : 409).send(fail(result.error, result.error === 'CONFLICT' ? 'O checkout mudou no painel ou em outra IDE. Baixe em outra pasta e compare antes de enviar novamente.' : 'Confira a versão, o produto, o domínio e a configuração antes de continuar.'));
      return result;
    });
  }
}
