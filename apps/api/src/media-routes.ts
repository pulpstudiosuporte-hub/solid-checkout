import { hasPlatformPermission } from './platform-permissions.js';
import { createHash, timingSafeEqual } from 'node:crypto';
import multipart from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import { storeImage, deleteUnusedImage } from './media-storage.js';
// Only formats accepted by the upload contract are decoded.
sharp.block({ operation: ['VipsForeignLoadHeif'] });
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { AuthRepository } from './auth-repository.js';
import type { CatalogRepository } from './catalog-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const same = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const error = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const STORE_MEDIA_QUOTA_BYTES = 100 * 1024 * 1024;
const PLATFORM_MEDIA_QUOTA_BYTES = 250 * 1024 * 1024;

async function optimizedImage(request: FastifyRequest): Promise<{ output: Buffer; width?: number; height?: number } | { code: string; message: string }> {
  const file = await request.file();
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return { code: 'INVALID_IMAGE', message: 'Envie uma imagem JPG, PNG ou WebP de até 10 MB.' };
  const input = await file.toBuffer();
  if (file.file.truncated || input.length === 0) return { code: 'INVALID_IMAGE', message: 'A imagem é muito grande ou inválida.' };
  try {
    let output = await sharp(input, { limitInputPixels: 25_000_000 }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
    if (output.length > 3 * 1024 * 1024) output = await sharp(output).webp({ quality: 68, effort: 4 }).toBuffer();
    const metadata = await sharp(output).metadata();
    return { output, width: metadata.width, height: metadata.height };
  } catch {
    return { code: 'INVALID_IMAGE', message: 'Não foi possível processar esta imagem.' };
  }
}

export function registerMediaRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, catalog: CatalogRepository, database: PrismaClient): void {
  const secure = environment.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';

  void app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 2 } });

  for (const [prefix, platform] of [['/media/images', false], ['/admin/content/media', true]] as const) {
    const access = async (request: FastifyRequest, mutation: boolean) => {
      const token = request.cookies[sessionCookie];
      const session = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
      if (!session) return null;
      if (mutation) {
        const csrf = request.cookies[csrfCookie]; const header = request.headers['x-csrf-token'];
        if (!environment.CORS_ORIGINS.includes(request.headers.origin ?? '') || !csrf || typeof header !== 'string' || !same(csrf, header) || !same(sha256(header), session.csrfTokenHash)) return null;
      }
      if (platform) return !session.support && hasPlatformPermission(session.user, 'content.manage') ? { storeId: null } : null;
      const context = await catalog.resolveStoreContext(session.userId, session.sessionId);
      return context && ['OWNER', 'ADMIN'].includes(context.role) ? { storeId: context.storeId } : null;
    };
    app.get<{ Querystring: { cursor?: string } }>(prefix, async (request, reply) => {
      const context = await access(request, false);
      if (!context) return reply.code(403).send(error(request, 'FORBIDDEN', 'Acesso negado.'));
      const cursor = request.query.cursor;
      if (cursor && !/^[0-9a-f-]{36}\.webp$/.test(cursor)) return reply.code(400).send(error(request, 'INVALID_CURSOR', 'Página inválida.'));
      const [items, usage] = await Promise.all([
        database.mediaAsset.findMany({ where: { storeId: context.storeId, ...(cursor ? { filename: { gt: cursor } } : {}) }, orderBy: { filename: 'asc' }, take: 25, select: { filename: true, sizeBytes: true, createdAt: true } }),
        database.mediaAsset.aggregate({ where: { storeId: context.storeId }, _sum: { sizeBytes: true } }),
      ]);
      const base = environment.API_PUBLIC_URL?.replace(/\/$/, '') ?? '';
      return reply.header('cache-control', 'private, no-store').send({ items: items.slice(0, 24).map(item => ({ ...item, imageUrl: `${base}/media/${item.filename}` })), nextCursor: items.length > 24 ? items[23]!.filename : null, usedBytes: usage._sum.sizeBytes ?? 0, quotaBytes: platform ? PLATFORM_MEDIA_QUOTA_BYTES : STORE_MEDIA_QUOTA_BYTES });
    });
    app.delete<{ Params: { filename: string } }>(`${prefix}/:filename`, async (request, reply) => {
      const context = await access(request, true);
      if (!context) return reply.code(403).send(error(request, 'FORBIDDEN', 'Acesso negado.'));
      const filename = request.params.filename;
      if (!/^[0-9a-f-]{36}\.webp$/.test(filename)) return reply.code(404).send(error(request, 'NOT_FOUND', 'Imagem não encontrada.'));
      const result = await deleteUnusedImage(database, context.storeId, filename);
      if (result === 'IN_USE') return reply.code(409).send(error(request, 'MEDIA_IN_USE', 'Esta imagem está em uso. Remova suas referências e salve os rascunhos antes de excluí-la.'));
      if (result === 'NOT_FOUND') return reply.code(404).send(error(request, 'NOT_FOUND', 'Imagem não encontrada.'));
      return reply.code(204).send();
    });
  }

  app.post('/media/images', async (request, reply) => {
    const token = request.cookies[sessionCookie];
    const csrf = request.cookies[csrfCookie];
    const header = request.headers['x-csrf-token'];
    const originOk = typeof request.headers.origin === 'string' && environment.CORS_ORIGINS.includes(request.headers.origin);
    const session = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    const context = session ? await catalog.resolveStoreContext(session.userId, session.sessionId) : null;
    if (!session || !context || (context.role !== 'OWNER' && context.role !== 'ADMIN') || !originOk || !csrf || typeof header !== 'string' || !same(csrf, header) || !same(sha256(header), session.csrfTokenHash)) return reply.code(403).send(error(request, 'FORBIDDEN', 'Acesso negado.'));

    const image = await optimizedImage(request);
    if ('code' in image) return reply.code(400).send(error(request, image.code, image.message));
    const { output } = image;

    const saved = await storeImage(database, context.storeId, output, STORE_MEDIA_QUOTA_BYTES);
    if (!saved) return reply.code(413).send(error(request, 'MEDIA_QUOTA_EXCEEDED', 'Limite de imagens atingido. Remova imagens sem uso na biblioteca.'));
    const { filename } = saved;
    const base = environment.API_PUBLIC_URL?.replace(/\/$/, '') ?? '';
    return reply.code(201).send({ imageUrl: `${base}/media/${filename}`, bytes: output.length, width: image.width, height: image.height, format: 'webp' });
  });

  app.post('/admin/content/media', async (request, reply) => {
    const token = request.cookies[sessionCookie];
    const csrf = request.cookies[csrfCookie];
    const header = request.headers['x-csrf-token'];
    const originOk = typeof request.headers.origin === 'string' && environment.CORS_ORIGINS.includes(request.headers.origin);
    const session = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    if (!session || session.support || !hasPlatformPermission(session.user, 'content.manage') || !originOk || !csrf || typeof header !== 'string' || !same(csrf, header) || !same(sha256(header), session.csrfTokenHash)) return reply.code(403).send(error(request, 'FORBIDDEN', 'Acesso administrativo necessário.'));

    const image = await optimizedImage(request);
    if ('code' in image) return reply.code(400).send(error(request, image.code, image.message));
    const saved = await storeImage(database, null, image.output, PLATFORM_MEDIA_QUOTA_BYTES);
    if (!saved) return reply.code(413).send(error(request, 'MEDIA_QUOTA_EXCEEDED', 'Limite de imagens da plataforma atingido.'));
    const { filename } = saved;
    const base = environment.API_PUBLIC_URL?.replace(/\/$/, '') ?? '';
    return reply.code(201).send({ imageUrl: `${base}/media/${filename}`, bytes: image.output.length, width: image.width, height: image.height, format: 'webp' });
  });

  app.get<{ Params: { filename: string } }>('/media/:filename', async (request, reply) => {
    const filename = request.params.filename;
    if (!/^[0-9a-f-]{36}\.webp$/.test(filename)) return reply.code(404).send(error(request, 'NOT_FOUND', 'Imagem não encontrada.'));
    const asset = await database.mediaAsset.findUnique({ where: { filename }, select: { content: true } });
    if (!asset) return reply.code(404).send(error(request, 'NOT_FOUND', 'Imagem não encontrada.'));
    reply.header('Cache-Control', 'public, max-age=31536000, immutable').header('Cross-Origin-Resource-Policy', 'cross-origin').type('image/webp');
    // The filename is UUID-only and this content can only be created by optimizedImage as WebP.
    // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    return reply.send(asset.content);
  });
}
