import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppEnvironment } from '@solid/config';
import type { AuthRepository } from './auth-repository.js';
import { hashToken, sessionCookieName, validAdminMutation } from './admin-access.js';
import { AssistantUnavailable, generateHelp, type HelpMessage } from './pirat-assistant.js';

export function parseHelpMessages(body: unknown): HelpMessage[] | null {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'messages')) return null;
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 9 || messages.length % 2 !== 1) return null;
  let total = 0;
  const parsed: HelpMessage[] = [];
  for (const [index, item] of (messages as unknown[]).entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const message = item as Record<string, unknown>;
    const role = index % 2 ? 'assistant' : 'user';
    if (Object.keys(message).some(key => !['role', 'text'].includes(key)) || message.role !== role || typeof message.text !== 'string') return null;
    const text = message.text.trim();
    if (!text || text.length > (index % 2 ? 4000 : 2000) || text.includes('\0')) return null;
    total += text.length;
    if (total > 14000) return null;
    parsed.push({ role, text });
  }
  return parsed;
}

export function registerAssistantRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository): void {
  const sessionFor = async (request: FastifyRequest) => {
    const token = request.cookies[sessionCookieName(environment)];
    const session = token ? await auth.findActiveSession(hashToken(token), new Date()) : null;
    return session && !session.support && !request.headers['x-solid-support-session'] ? session : null;
  };
  app.get('/assistant/status', async (request, reply) => {
    if (!await sessionFor(request)) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Entre na sua conta para conversar.' } });
    return reply.header('cache-control', 'private, no-store').send({ available: Boolean(environment.GEMINI_API_KEY) });
  });
  // Authenticate before the limiter so its key follows the account, not an IP or a new session.
  const actors = new WeakMap<FastifyRequest, string>();
  app.post('/assistant/messages', {
    bodyLimit: 64000,
    preValidation: async (request, reply) => {
      const session = await sessionFor(request);
      if (!session) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Entre na sua conta para conversar.' } });
      if (!validAdminMutation(request, session, environment)) return reply.code(403).send({ error: { code: 'CSRF_INVALID', message: 'Recarregue o painel e tente novamente.' } });
      actors.set(request, session.userId);
    },
    config: { rateLimit: { hook: 'preHandler', max: 20, ban: -1, timeWindow: '1 hour', keyGenerator: (request: FastifyRequest) => `pirat-help:${actors.get(request) || request.ip}`, errorResponseBuilder: () => ({ statusCode: 429, message: 'Assistant rate limit reached' }) } },
  }, async (request, reply) => {
    reply.header('cache-control', 'private, no-store');
    const messages = parseHelpMessages(request.body);
    if (!messages) return reply.code(400).send({ error: { code: 'INVALID_MESSAGES', message: 'Envie uma pergunta de até 2.000 caracteres ou comece uma nova conversa.' } });
    if (!environment.GEMINI_API_KEY) return reply.code(503).send({ error: { code: 'ASSISTANT_NOT_CONFIGURED', message: 'O papagaio ainda está preparando o mapa. O assistente será liberado quando a conexão com a IA estiver configurada.' } });
    const controller = new AbortController();
    const disconnect = () => { if (!reply.raw.writableEnded) controller.abort(); };
    reply.raw.once('close', disconnect);
    try { return reply.send(await generateHelp(environment, messages, controller.signal)); }
    catch (cause) {
      const quota = cause instanceof AssistantUnavailable && cause.reason === 'quota';
      request.log.warn({ reason: cause instanceof AssistantUnavailable ? cause.reason : 'connection' }, 'pirat_assistant_unavailable');
      return reply.code(503).send({ error: { code: quota ? 'ASSISTANT_BUSY' : 'ASSISTANT_UNAVAILABLE', message: quota ? 'O papagaio está com muitas perguntas. Tente novamente mais tarde.' : 'O papagaio perdeu o fio da conversa. Tente novamente em instantes.' } });
    } finally { reply.raw.off('close', disconnect); }
  });
}
