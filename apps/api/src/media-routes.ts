import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import multipart from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { AuthRepository } from './auth-repository.js';
import type { CatalogRepository } from './catalog-repository.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const same = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(sha256(left), 'hex'), Buffer.from(sha256(right), 'hex'));
const error = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });

export function registerMediaRoutes(app: FastifyInstance, environment: AppEnvironment, auth: AuthRepository, catalog: CatalogRepository, database: PrismaClient): void {
  const secure = environment.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-solid_session' : 'solid_session';
  const csrfCookie = secure ? '__Host-solid_csrf' : 'solid_csrf';

  void app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 2 } });

  app.post('/media/images', async (request, reply) => {
    const token = request.cookies[sessionCookie];
    const csrf = request.cookies[csrfCookie];
    const header = request.headers['x-csrf-token'];
    const originOk = typeof request.headers.origin === 'string' && environment.CORS_ORIGINS.includes(request.headers.origin);
    const session = token ? await auth.findActiveSession(sha256(token), new Date()) : null;
    const context = session ? await catalog.resolveStoreContext(session.userId, session.sessionId) : null;
    if (!session || !context || (context.role !== 'OWNER' && context.role !== 'ADMIN') || !originOk || !csrf || typeof header !== 'string' || !same(csrf, header) || !same(sha256(header), session.csrfTokenHash)) return reply.code(403).send(error(request, 'FORBIDDEN', 'Acesso negado.'));

    const file = await request.file();
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return reply.code(400).send(error(request, 'INVALID_IMAGE', 'Envie uma imagem JPG, PNG ou WebP de até 10 MB.'));
    const input = await file.toBuffer();
    if (file.file.truncated || input.length === 0) return reply.code(400).send(error(request, 'INVALID_IMAGE', 'A imagem é muito grande ou inválida.'));

    let output: Buffer;
    try {
      output = await sharp(input, { limitInputPixels: 25_000_000 }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
    } catch {
      return reply.code(400).send(error(request, 'INVALID_IMAGE', 'Não foi possível processar esta imagem.'));
    }
    if (output.length > 3 * 1024 * 1024) output = await sharp(output).webp({ quality: 68, effort: 4 }).toBuffer();

    const filename = `${randomUUID()}.webp`;
    await database.mediaAsset.create({ data: { filename, content: Uint8Array.from(output), sizeBytes: output.length } });
    const base = environment.API_PUBLIC_URL?.replace(/\/$/, '') ?? '';
    return reply.code(201).send({ imageUrl: `${base}/media/${filename}`, bytes: output.length, width: 1600, format: 'webp' });
  });

  app.get<{ Params: { filename: string } }>('/media/:filename', async (request, reply) => {
    const filename = request.params.filename;
    if (!/^[0-9a-f-]{36}\.webp$/.test(filename)) return reply.code(404).send(error(request, 'NOT_FOUND', 'Imagem não encontrada.'));
    const asset = await database.mediaAsset.findUnique({ where: { filename }, select: { content: true } });
    if (!asset) return reply.code(404).send(error(request, 'NOT_FOUND', 'Imagem não encontrada.'));
    reply.header('Cache-Control', 'public, max-age=31536000, immutable').header('Cross-Origin-Resource-Policy', 'cross-origin').type('image/webp');
    return reply.send(asset.content);
  });
}
