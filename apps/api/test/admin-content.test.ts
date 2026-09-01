import { createHash } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import { describe, expect, it, vi } from 'vitest';
import type { AuthRepository, LoginUser, SessionUser } from '../src/auth-repository.js';
import { buildApp } from '../src/app.js';
import type { CatalogRepository } from '../src/catalog-repository.js';

const token = 'admin-content-session';
const csrf = 'admin-content-csrf';
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const env: AppEnvironment = { NODE_ENV: 'test', API_HOST: '127.0.0.1', API_PORT: 3333, LOG_LEVEL: 'silent', CORS_ORIGINS: ['http://localhost:5173'], TRUST_PROXY: false };

class AdminAuth implements AuthRepository {
  findUserByEmail(): Promise<LoginUser | null> { return Promise.resolve(null); }
  createSession(): Promise<void> { return Promise.resolve(); }
  findActiveSession(tokenHash: string): Promise<SessionUser | null> { return Promise.resolve(tokenHash === hash(token) ? { sessionId: 'session-a', userId: 'user-a', csrfTokenHash: hash(csrf), expiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000), user: { publicId: 'user-public', name: 'Admin', email: 'admin@example.com', platformAdmin: true } } : null); }
  touchSession(): Promise<void> { return Promise.resolve(); }
  revokeSession(): Promise<void> { return Promise.resolve(); }
  updatePasswordAndRevokeOtherSessions(): Promise<void> { return Promise.resolve(); }
}

function contentDatabase(spies?: { updateFeedback?: ReturnType<typeof vi.fn>; deleteFeedback?: ReturnType<typeof vi.fn>; createMedia?: ReturnType<typeof vi.fn>; upsertAsset?: ReturnType<typeof vi.fn>; updateRelease?: ReturnType<typeof vi.fn> }): PrismaClient {
  return {
    productRelease: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), upsert: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue({ id: 'release-a' }), update: spies?.updateRelease ?? vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    integrationCatalogAsset: { findMany: vi.fn().mockResolvedValue([]), upsert: spies?.upsertAsset ?? vi.fn() },
    productFeedback: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: spies?.updateFeedback ?? vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: spies?.deleteFeedback ?? vi.fn().mockResolvedValue({ count: 1 }),
    },
    mediaAsset: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { sizeBytes: 0 } }),
      create: spies?.createMedia ?? vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

const authenticated = { cookie: `solid_session=${token}; solid_csrf=${csrf}` };
const mutationHeaders = { ...authenticated, origin: 'http://localhost:5173', 'x-csrf-token': csrf };
const unusedCatalog = {} as CatalogRepository;

describe('conteúdo administrável da plataforma', () => {
  it('exige sessão e preserva uma lista realmente vazia', async () => {
    const database = contentDatabase();
    const app = buildApp(env, { authRepository: new AdminAuth(), database });
    expect((await app.inject({ method: 'GET', url: '/platform-content' })).statusCode).toBe(401);
    const response = await app.inject({ method: 'GET', url: '/platform-content', headers: authenticated });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ releases: [], integrationAssets: [] });
    const releaseCalls = vi.mocked(database.productRelease.upsert).mock.calls as unknown as Array<[{ create: { publicId: string } }]>;
    expect(releaseCalls.length).toBeGreaterThan(0);
    expect(releaseCalls.every(([input]) => input.create.publicId.length <= 32)).toBe(true);
    await app.close();
  });

  it('mantém o conteúdo disponível se uma novidade automática falhar ao ser registrada', async () => {
    const database = contentDatabase();
    vi.mocked(database.productRelease.upsert).mockRejectedValue(new Error('release seed failed'));
    const app = buildApp(env, { authRepository: new AdminAuth(), database });
    const response = await app.inject({ method: 'GET', url: '/admin/content', headers: authenticated });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ feedback: [], releases: [], integrationAssets: [] });
    await app.close();
  });

  it('rejeita mídia insegura e exige CSRF nas mutações', async () => {
    const app = buildApp(env, { authRepository: new AdminAuth(), database: contentDatabase() });
    const body = { category: 'NEWS', title: 'Título válido', description: 'Descrição suficientemente detalhada.', videoUrl: 'http://example.com/video.mp4' };
    expect((await app.inject({ method: 'POST', url: '/admin/content/releases', headers: authenticated, payload: body })).statusCode).toBe(403);
    const response = await app.inject({ method: 'POST', url: '/admin/content/releases', headers: mutationHeaders, payload: body });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    await app.close();
  });

  it('aprova e exclui feedback com autorização administrativa', async () => {
    const updateFeedback = vi.fn().mockResolvedValue({ count: 1 });
    const deleteFeedback = vi.fn().mockResolvedValue({ count: 1 });
    const database = contentDatabase({ updateFeedback, deleteFeedback });
    const app = buildApp(env, { authRepository: new AdminAuth(), database });
    const approved = await app.inject({ method: 'PATCH', url: '/admin/content/feedback/feedback-a', headers: mutationHeaders, payload: { approved: true, status: 'PLANNED' } });
    expect(approved.statusCode).toBe(200);
    expect(updateFeedback).toHaveBeenCalledWith({ where: { publicId: 'feedback-a' }, data: { approved: true, status: 'PLANNED' } });
    expect((await app.inject({ method: 'DELETE', url: '/admin/content/feedback/feedback-a', headers: mutationHeaders })).statusCode).toBe(204);
    expect(deleteFeedback).toHaveBeenCalledWith({ where: { publicId: 'feedback-a' } });
    await app.close();
  });

  it('otimiza mídia global sem vinculá-la à loja ativa', async () => {
    const createMedia = vi.fn().mockResolvedValue({});
    const app = buildApp(env, { authRepository: new AdminAuth(), catalogRepository: unusedCatalog, database: contentDatabase({ createMedia }) });
    const boundary = '----solid-content-test';
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="pixel.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const response = await app.inject({
      method: 'POST',
      url: '/admin/content/media',
      headers: { ...mutationHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ format: 'webp', width: 1, height: 1 });
    expect(createMedia).toHaveBeenCalledOnce();
    const [mediaInput] = createMedia.mock.calls[0] as unknown as [{ data: { storeId: string | null } }];
    expect(mediaInput.data.storeId).toBeNull();
    await app.close();
  });

  it('permite editar e ocultar uma atualização automática sem excluí-la', async () => {
    const updateRelease = vi.fn().mockResolvedValue({ publicId: 'auto-20260831-search', category: 'IMPROVEMENT', title: 'Busca aprimorada', description: 'Nova descrição detalhada da busca.', imageUrl: null, videoUrl: null, published: false, publishedAt: new Date() });
    const database = contentDatabase({ updateRelease });
    const app = buildApp(env, { authRepository: new AdminAuth(), database });
    const response = await app.inject({ method: 'PATCH', url: '/admin/content/releases/auto-20260831-search', headers: mutationHeaders, payload: { title: 'Busca aprimorada', description: 'Nova descrição detalhada da busca.', published: false } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ release: { automatic: true, published: false } });
    expect(updateRelease).toHaveBeenCalledOnce();
    expect((await app.inject({ method: 'DELETE', url: '/admin/content/releases/auto-20260831-search', headers: mutationHeaders })).statusCode).toBe(400);
    await app.close();
  });

  it('permite ao administrador cadastrar a logo de um gateway', async () => {
    const upsertAsset = vi.fn().mockResolvedValue({ integrationKey: 'gateway-roas', imageUrl: 'https://api.example.com/media/logo.webp', altText: 'Logo Roas', updatedAt: new Date() });
    const app = buildApp(env, { authRepository: new AdminAuth(), database: contentDatabase({ upsertAsset }) });
    const response = await app.inject({ method: 'PUT', url: '/admin/content/integrations/gateway-roas', headers: mutationHeaders, payload: { imageUrl: 'https://api.example.com/media/logo.webp', altText: 'Logo Roas' } });
    expect(response.statusCode).toBe(200);
    expect(upsertAsset).toHaveBeenCalledOnce();
    const [assetInput] = upsertAsset.mock.calls[0] as unknown as [{ create: { integrationKey: string }; update: { imageUrl: string } }];
    expect(assetInput.create.integrationKey).toBe('gateway-roas');
    expect(assetInput.update.imageUrl).toBe('https://api.example.com/media/logo.webp');
    await app.close();
  });
});
