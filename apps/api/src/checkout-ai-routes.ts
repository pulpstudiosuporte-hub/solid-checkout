import type { AppEnvironment } from '@solid/config';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository } from './auth-repository.js';
import type { CatalogRepository, StoreContext } from './catalog-repository.js';
import { hashToken, sessionCookieName, validAdminMutation } from './admin-access.js';
import { generateCheckoutDesign, parseCheckoutIdea, referenceImage } from './checkout-ai.js';
import { AssistantUnavailable } from './pirat-assistant.js';

export function registerCheckoutAiRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, catalog: CatalogRepository) {
  const actors = new WeakMap<FastifyRequest, StoreContext>();
  app.post('/checkouts/ai/preview', {
    bodyLimit: 3_000_000,
    preValidation: async (request, reply) => {
      const token = request.cookies[sessionCookieName(environment)];
      const session = token ? await auth.findActiveSession(hashToken(token), new Date()) : null;
      if (!session) return reply.code(401).send({ error: { message: 'Entre na sua conta para criar com IA.' } });
      if (session.support || request.headers['x-solid-support-session'] || !validAdminMutation(request, session, environment)) return reply.code(403).send({ error: { message: 'Atualize sua sessão para continuar.' } });
      const context = await catalog.resolveStoreContext(session.userId, session.sessionId);
      if (!context || !['OWNER', 'ADMIN'].includes(context.role)) return reply.code(403).send({ error: { message: 'Sua conta não pode criar checkouts nesta loja.' } });
      actors.set(request, context);
    },
    config: { rateLimit: { hook: 'preHandler', max: 10, ban: -1, timeWindow: '1 hour', keyGenerator: (request: FastifyRequest) => `checkout-ai:${actors.get(request)?.userId || request.ip}`, errorResponseBuilder: () => ({ statusCode: 429, message: 'Checkout AI rate limit reached' }) } },
  }, async (request, reply) => {
    reply.header('cache-control', 'private, no-store');
    const idea = parseCheckoutIdea(request.body);
    if (!idea) return reply.code(400).send({ error: { message: 'Confira a descrição, os depoimentos e a referência (PNG, JPEG ou WebP, até 2 MB).' } });
    if (!environment.GEMINI_API_KEY) return reply.code(503).send({ error: { message: 'A criação por IA ainda não está configurada.' } });
    let productTitle: string | undefined;
    if (idea.productId) {
      const product = await catalog.getProduct(actors.get(request)!, idea.productId) as { checkoutTitle?: string; active?: boolean } | null;
      if (!product || product.active === false) return reply.code(404).send({ error: { message: 'Produto indisponível nesta loja.' } });
      productTitle = product.checkoutTitle?.slice(0, 120);
    }
    let reference: string | undefined;
    try { if (idea.reference) reference = await referenceImage(idea.reference); }
    catch { return reply.code(400).send({ error: { message: 'A referência precisa ser uma imagem válida de até 2 MB e 16 megapixels.' } }); }
    // Release the raw reference before generation. Nothing is persisted.
    idea.reference = undefined;
    request.body = undefined;
    const controller = new AbortController();
    const disconnect = () => { if (!reply.raw.writableEnded) controller.abort(); };
    reply.raw.once('close', disconnect);
    try { return reply.send({ config: await generateCheckoutDesign(environment, idea, productTitle, reference, controller.signal) }); }
    catch (cause) {
      const quota = cause instanceof AssistantUnavailable && cause.reason === 'quota';
      request.log.warn({ reason: cause instanceof AssistantUnavailable ? cause.reason : 'connection' }, 'checkout_ai_unavailable');
      return reply.code(503).send({ error: { message: quota ? 'A IA atingiu o limite de uso. Tente mais tarde.' : 'Não consegui montar a prévia agora. Sua ideia foi mantida; tente novamente.' } });
    } finally { reference = undefined; reply.raw.off('close', disconnect); }
  });
}
