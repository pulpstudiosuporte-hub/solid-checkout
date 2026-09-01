import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthRepository, SessionUser } from './auth-repository.js';
import { createStorePushDispatcher } from './web-push-service.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const same = (left: string, right: string): boolean => {
  const a = Buffer.from(sha256(left), 'hex'); const b = Buffer.from(sha256(right), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};
const failure = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const clean = (value: unknown, max: number): string => typeof value === 'string' ? value.trim().replace(/\0/g, '').slice(0, max) : '';
const optionalUrl = (value: unknown): string | null | undefined => {
  const raw = clean(value, 2048); if (!raw) return null;
  try { const url = new URL(raw); return url.protocol === 'https:' ? url.toString() : undefined; } catch { return undefined; }
};
const statuses = ['BACKLOG', 'PLANNED', 'IN_PROGRESS', 'DONE'] as const;
const categories = ['NEWS', 'IMPROVEMENT', 'FIX', 'INTEGRATION', 'SECURITY'] as const;
const automaticReleases = [
  { publicId: 'auto-20260901-first-store', category: 'IMPROVEMENT' as const, title: 'Primeira loja criada por você', description: 'Novas contas agora começam sem uma loja automática. Após confirmar o e-mail, cada pessoa escolhe o nome da primeira operação em uma etapa guiada, com um novo seletor de lojas mais claro e compacto.', publishedAt: new Date('2026-09-01T22:45:00.000Z') },
  { publicId: 'auto-20260901-domain-mfa', category: 'IMPROVEMENT' as const, title: 'Domínios sem autenticação em duas etapas obrigatória', description: 'Adicionar, validar, trocar e remover o domínio do checkout não exige mais ativar o aplicativo autenticador. O segundo fator continua disponível como proteção opcional da conta.', publishedAt: new Date('2026-09-01T22:15:00.000Z') },
  { publicId: 'auto-20260901-social-proof', category: 'IMPROVEMENT' as const, title: 'Prova social com vendas confirmadas', description: 'A nova área de Escassez permite ativar notificações de compra no checkout, personalizar posição, intervalo e aparência. No checkout publicado, os avisos usam somente pagamentos reais e dados anonimizados.', publishedAt: new Date('2026-09-01T21:30:00.000Z') },
  { publicId: 'auto-20260901-admin-testing', category: 'IMPROVEMENT' as const, title: 'Testes administrativos sem cadastro comercial', description: 'Administradores da plataforma agora podem criar, publicar e testar checkouts em suas próprias lojas sem preencher dados comerciais. As exigências de ativação continuam válidas para as contas dos lojistas.', publishedAt: new Date('2026-09-01T20:45:00.000Z') },
  { publicId: 'auto-20260901-hardening', category: 'SECURITY' as const, title: 'Cadastro e análises mais seguros', description: 'Dados cadastrais sensíveis agora usam criptografia, a ativação da loja é revalidada antes de publicar ou cobrar e o ChromaSense ganhou visitas mais precisas e coleta com privacidade reforçada.', publishedAt: new Date('2026-09-01T20:30:00.000Z') },
  { publicId: 'auto-20260901-integrations-ui', category: 'IMPROVEMENT' as const, title: 'Novo diretório de integrações', description: 'A central de integrações ganhou busca, filtro por categoria, status de conexão e ações mais claras para configurar ou gerenciar cada serviço.', publishedAt: new Date('2026-09-01T19:15:00.000Z') },
  { publicId: 'auto-20260901-home-alert', category: 'IMPROVEMENT' as const, title: 'Pendências de ativação agora visíveis no Início', description: 'O aviso de cadastro pendente foi centralizado na tela principal, com contagem atualizada das informações necessárias para ativar a loja.', publishedAt: new Date('2026-09-01T18:45:00.000Z') },
  { publicId: 'auto-20260901-semgrep-review', category: 'SECURITY' as const, title: 'Nova revisão automatizada de segurança', description: 'Executamos uma nova análise estática completa com Semgrep e revalidamos as proteções de código e da cadeia de build do painel.', publishedAt: new Date('2026-09-01T18:15:00.000Z') },
  { publicId: 'auto-20260901-onboarding', category: 'IMPROVEMENT' as const, title: 'Ativação guiada da loja', description: 'Novas contas podem explorar o painel após verificar o e-mail e recebem um checklist para concluir o cadastro antes de publicar checkouts e processar pagamentos.', publishedAt: new Date('2026-09-01T17:30:00.000Z') },
  { publicId: 'auto-20260901-settings', category: 'IMPROVEMENT' as const, title: 'Central de configurações renovada', description: 'Dados da loja e do responsável, domínios, usuários, segurança e preferências de notificações agora ficam reunidos em uma central completa.', publishedAt: new Date('2026-09-01T12:45:00.000Z') },
  { publicId: 'auto-20260831-integrations', category: 'NEWS' as const, title: 'Catálogo de integrações renovado', description: 'Agora você encontra, pesquisa e gerencia integrações e gateways em uma central organizada.', publishedAt: new Date('2026-08-31T21:00:00.000Z') },
  { publicId: 'auto-20260831-search', category: 'IMPROVEMENT' as const, title: 'Busca avançada no painel', description: 'Use Ctrl K para encontrar páginas, recursos e ações por nome ou palavras relacionadas.', publishedAt: new Date('2026-08-31T20:00:00.000Z') },
  { publicId: 'auto-20260831-checkout', category: 'IMPROVEMENT' as const, title: 'Checkout responsivo e personalizável', description: 'Novos controles visuais, elementos editáveis e melhorias de compatibilidade para checkouts publicados.', publishedAt: new Date('2026-08-31T19:00:00.000Z') },
  { publicId: 'auto-20260831-gateway', category: 'INTEGRATION' as const, title: 'Prioridade e contingência de gateways', description: 'Defina o gateway principal e organize alternativas para manter os pagamentos disponíveis.', publishedAt: new Date('2026-08-31T18:00:00.000Z') },
  { publicId: 'auto-20260830-webhooks', category: 'INTEGRATION' as const, title: 'Webhooks duráveis por loja', description: 'Envie eventos de pedidos para sistemas externos com assinatura, tentativas e histórico de entrega.', publishedAt: new Date('2026-08-30T22:00:00.000Z') },
  { publicId: 'auto-20260830-security', category: 'SECURITY' as const, title: 'Proteções de conta ampliadas', description: 'Fluxos de recuperação, sessão protegida e verificações adicionais para ações sensíveis.', publishedAt: new Date('2026-08-30T21:00:00.000Z') },
];
const releaseSelect = { publicId: true, category: true, title: true, description: true, imageUrl: true, videoUrl: true, published: true, publishedAt: true } as const;
const withReleaseSource = <T extends { publicId: string }>(item: T): T & { automatic: boolean } => ({ ...item, automatic: item.publicId.startsWith('auto-') });
const destinations = ['Início', 'Novidades', 'Análises', 'Pedidos', 'Carrinhos', 'Produtos', 'Integrações', 'Webhooks'] as const;

export function registerAdminContentRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, db: PrismaClient): void {
  const push = createStorePushDispatcher(environment, db, app.log);
  const secure = environment.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';
  const session = async (request: FastifyRequest): Promise<SessionUser | null> => {
    const token = request.cookies[sessionCookie];
    return token ? auth.findActiveSession(sha256(token), new Date()) : null;
  };
  const admin = async (request: FastifyRequest): Promise<SessionUser | null> => {
    const current = await session(request); return current?.user.platformAdmin ? current : null;
  };
  const mutationAllowed = (request: FastifyRequest, current: SessionUser): boolean => {
    const origin = request.headers.origin; const header = request.headers['x-csrf-token']; const cookie = request.cookies[csrfCookie];
    return typeof origin === 'string' && environment.CORS_ORIGINS.includes(origin) && typeof header === 'string' && Boolean(cookie) && same(cookie!, header) && same(sha256(header), current.csrfTokenHash);
  };
  const ensureAutomaticReleases = async (): Promise<void> => {
    const results = await Promise.allSettled(automaticReleases.map(release => db.productRelease.upsert({
      where: { publicId: release.publicId },
      create: { ...release, published: true },
      update: {},
    })));
    results.forEach((result, index) => {
      if (result.status === 'rejected') app.log.error({ err: result.reason, publicId: automaticReleases[index]?.publicId }, 'automatic_release_upsert_failed');
    });
  };

  app.get('/platform-content', async (request, reply) => {
    if (!await session(request)) return reply.code(401).send(failure(request, 'UNAUTHENTICATED', 'Autenticação necessária.'));
    await ensureAutomaticReleases();
    const [releases, assets] = await Promise.all([
      db.productRelease.findMany({ where: { published: true }, orderBy: { publishedAt: 'desc' }, take: 50, select: releaseSelect }),
      db.integrationCatalogAsset.findMany({ select: { integrationKey: true, imageUrl: true, altText: true } }),
    ]);
    return reply.header('cache-control', 'private, no-store').send({ releases: releases.map(withReleaseSource), integrationAssets: assets });
  });

  app.get('/admin/content', async (request, reply) => {
    if (!await admin(request)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));
    await ensureAutomaticReleases();
    const [feedback, releases, assets] = await Promise.all([
      db.productFeedback.findMany({ orderBy: [{ approved: 'asc' }, { status: 'asc' }, { createdAt: 'desc' }], take: 200, select: { publicId: true, type: true, status: true, approved: true, title: true, description: true, createdAt: true, user: { select: { name: true, email: true } }, store: { select: { name: true } }, _count: { select: { votes: true } } } }),
      db.productRelease.findMany({ orderBy: { publishedAt: 'desc' }, take: 100, select: releaseSelect }),
      db.integrationCatalogAsset.findMany({ orderBy: { integrationKey: 'asc' }, select: { integrationKey: true, imageUrl: true, altText: true, updatedAt: true } }),
    ]);
    return reply.header('cache-control', 'private, no-store').send({ feedback: feedback.map(item => ({ ...item, author: item.user.name, email: item.user.email, store: item.store?.name ?? 'Sem loja', votes: item._count.votes, user: undefined, _count: undefined })), releases: releases.map(withReleaseSource), integrationAssets: assets });
  });

  app.patch<{ Params: { feedbackId: string }; Body: { status?: string; approved?: boolean } }>('/admin/content/feedback/:feedbackId', async (request, reply) => {
    const current = await admin(request); if (!current || !mutationAllowed(request, current)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    const data: { status?: typeof statuses[number]; approved?: boolean } = {};
    if (request.body?.status !== undefined) {
      if (!statuses.includes(request.body.status as typeof statuses[number])) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Status inválido.'));
      data.status = request.body.status as typeof statuses[number];
    }
    if (typeof request.body?.approved === 'boolean') data.approved = request.body.approved;
    if (!Object.keys(data).length) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Nenhuma alteração informada.'));
    const result = await db.productFeedback.updateMany({ where: { publicId: clean(request.params.feedbackId, 32) }, data });
    if (!result.count) return reply.code(404).send(failure(request, 'NOT_FOUND', 'Feedback não encontrado.'));
    return reply.send({ updated: true });
  });

  app.delete<{ Params: { feedbackId: string } }>('/admin/content/feedback/:feedbackId', async (request, reply) => {
    const current = await admin(request); if (!current || !mutationAllowed(request, current)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    const result = await db.productFeedback.deleteMany({ where: { publicId: clean(request.params.feedbackId, 32) } });
    if (!result.count) return reply.code(404).send(failure(request, 'NOT_FOUND', 'Feedback não encontrado.'));
    return reply.code(204).send();
  });

  app.post<{ Body: { category?: string; title?: string; description?: string; imageUrl?: string; videoUrl?: string; published?: boolean } }>('/admin/content/releases', async (request, reply) => {
    const current = await admin(request); if (!current || !mutationAllowed(request, current)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    const title = clean(request.body?.title, 140); const description = clean(request.body?.description, 4000);
    const imageUrl = optionalUrl(request.body?.imageUrl); const videoUrl = optionalUrl(request.body?.videoUrl);
    if (title.length < 5 || description.length < 10 || imageUrl === undefined || videoUrl === undefined) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Revise título, descrição e URLs HTTPS.'));
    const category = categories.includes(request.body?.category as typeof categories[number]) ? request.body.category as typeof categories[number] : 'NEWS';
    const release = await db.productRelease.create({ data: { category, title, description, imageUrl, videoUrl, published: request.body?.published !== false }, select: releaseSelect });
    return reply.code(201).send({ release: withReleaseSource(release) });
  });

  app.patch<{ Params: { releaseId: string }; Body: { category?: string; title?: string; description?: string; imageUrl?: string; videoUrl?: string; published?: boolean } }>('/admin/content/releases/:releaseId', async (request, reply) => {
    const current = await admin(request); if (!current || !mutationAllowed(request, current)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    const publicId = clean(request.params.releaseId, 32);
    const data: { category?: typeof categories[number]; title?: string; description?: string; imageUrl?: string | null; videoUrl?: string | null; published?: boolean } = {};
    if (request.body?.category !== undefined) {
      if (!categories.includes(request.body.category as typeof categories[number])) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Categoria inválida.'));
      data.category = request.body.category as typeof categories[number];
    }
    if (request.body?.title !== undefined) { data.title = clean(request.body.title, 140); if (data.title.length < 5) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Título muito curto.')); }
    if (request.body?.description !== undefined) { data.description = clean(request.body.description, 4000); if (data.description.length < 10) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Descrição muito curta.')); }
    if (request.body?.imageUrl !== undefined) { const imageUrl = optionalUrl(request.body.imageUrl); if (imageUrl === undefined) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Imagem HTTPS inválida.')); data.imageUrl = imageUrl; }
    if (request.body?.videoUrl !== undefined) { const videoUrl = optionalUrl(request.body.videoUrl); if (videoUrl === undefined) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Vídeo HTTPS inválido.')); data.videoUrl = videoUrl; }
    if (typeof request.body?.published === 'boolean') data.published = request.body.published;
    if (!Object.keys(data).length) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Nenhuma alteração informada.'));
    const existing = await db.productRelease.findUnique({ where: { publicId }, select: { id: true } });
    if (!existing) return reply.code(404).send(failure(request, 'NOT_FOUND', 'Publicação não encontrada.'));
    const release = await db.productRelease.update({ where: { publicId }, data, select: releaseSelect });
    return reply.send({ release: withReleaseSource(release) });
  });

  app.delete<{ Params: { releaseId: string } }>('/admin/content/releases/:releaseId', async (request, reply) => {
    const current = await admin(request); if (!current || !mutationAllowed(request, current)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    const publicId = clean(request.params.releaseId, 32);
    if (publicId.startsWith('auto-')) return reply.code(400).send(failure(request, 'AUTOMATIC_RELEASE', 'Atualizações automáticas podem ser editadas ou ocultadas, mas não excluídas.'));
    await db.productRelease.deleteMany({ where: { publicId } });
    return reply.code(204).send();
  });

  app.put<{ Params: { integrationKey: string }; Body: { imageUrl?: string; altText?: string } }>('/admin/content/integrations/:integrationKey', async (request, reply) => {
    const current = await admin(request); if (!current || !mutationAllowed(request, current)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    const integrationKey = clean(request.params.integrationKey, 64).toLowerCase(); const imageUrl = optionalUrl(request.body?.imageUrl); const altText = clean(request.body?.altText, 160);
    if (!/^[a-z0-9-]{2,64}$/.test(integrationKey) || !imageUrl) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Integração ou imagem HTTPS inválida.'));
    const asset = await db.integrationCatalogAsset.upsert({ where: { integrationKey }, create: { integrationKey, imageUrl, altText }, update: { imageUrl, altText }, select: { integrationKey: true, imageUrl: true, altText: true, updatedAt: true } });
    return reply.send({ asset });
  });

  app.post<{ Body: { title?: string; message?: string; destination?: string } }>('/admin/content/broadcasts', async (request, reply) => {
    const current = await admin(request); if (!current || !mutationAllowed(request, current)) return reply.code(403).send(failure(request, 'FORBIDDEN', 'Acesso negado.'));
    const title = clean(request.body?.title, 120); const message = clean(request.body?.message, 300);
    const destination = destinations.includes(request.body?.destination as typeof destinations[number]) ? request.body.destination as typeof destinations[number] : 'Novidades';
    if (title.length < 4 || message.length < 8) return reply.code(400).send(failure(request, 'VALIDATION_ERROR', 'Informe título e mensagem da notificação.'));
    const stores = await db.store.findMany({ where: { active: true }, select: { id: true } });
    const targetId = randomUUID();
    if (stores.length) await db.auditLog.createMany({ data: stores.map(store => ({ storeId: store.id, actorUserId: current.userId, actorType: 'USER', action: 'platform.announcement', targetType: 'platform_release', targetId, metadata: { title, message, destination } })) });
    if (push) await Promise.all(stores.map(store => push(store.id, 'platform.announcement', { title, message, destination }, targetId)));
    return reply.code(201).send({ deliveredToStores: stores.length });
  });
}
