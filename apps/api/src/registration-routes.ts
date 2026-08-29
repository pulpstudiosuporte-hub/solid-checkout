import { createHash, randomBytes } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { hashPassword } from './password.js';
import { verifyTurnstile } from './turnstile.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const slug = (name: string) => `${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'loja'}-${randomBytes(4).toString('hex')}`;

async function sendVerification(environment: AppEnvironment, email: string, name: string, rawToken: string): Promise<void> {
  if (!environment.RESEND_API_KEY || !environment.EMAIL_FROM || !environment.APP_URL) throw new Error('Serviço de cadastro por e-mail indisponível');
  const verificationUrl = `${environment.APP_URL.replace(/\/$/, '')}/#/verificar-email?token=${encodeURIComponent(rawToken)}`;
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${environment.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: environment.EMAIL_FROM, to: [email], subject: 'Confirme sua conta no SOLID Checkout', html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17131f"><p style="color:#7047eb;font-weight:700">SOLID CHECKOUT</p><h1>Confirme seu e-mail</h1><p>Olá, ${name.replace(/[<>&"']/g, '')}. Confirme seu cadastro para criar sua loja.</p><p><a href="${verificationUrl}" style="display:inline-block;padding:14px 20px;border-radius:10px;background:#7047eb;color:#fff;text-decoration:none;font-weight:700">Confirmar minha conta</a></p><p style="color:#686471;font-size:13px">O link expira em 30 minutos. Se você não solicitou o cadastro, ignore esta mensagem.</p></div>` }) });
  if (!response.ok) throw new Error(`Resend recusou o envio (${response.status})`);
}

export function registerRegistrationRoutes(app: FastifyInstance, environment: AppEnvironment, database: PrismaClient): void {
  const secure = environment.NODE_ENV === 'production'; const csrfCookie = secure ? '__Host-solid_auth_csrf' : 'solid_auth_csrf';
  const authorized = (request: FastifyRequest) => typeof request.headers.origin === 'string' && environment.CORS_ORIGINS.includes(request.headers.origin) && typeof request.headers['x-csrf-token'] === 'string' && request.cookies[csrfCookie] === request.headers['x-csrf-token'];
  app.post<{ Body: { name?: unknown; email?: unknown; password?: unknown; termsAccepted?: unknown; turnstileToken?: unknown } }>('/auth/register', { config: { rateLimit: { max: 3, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!authorized(request)) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    if (!await verifyTurnstile(environment, request.body?.turnstileToken, request.ip, 'register')) return reply.code(403).send(errorBody(request, 'BOT_CHALLENGE_FAILED', 'Não foi possível validar que você é uma pessoa. Atualize o desafio e tente novamente.'));
    const name = typeof request.body?.name === 'string' ? request.body.name.trim().replace(/\s+/g, ' ') : ''; const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''; const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (name.length < 3 || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 320 || password.length < 14 || password.length > 128 || request.body?.termsAccepted !== true) return reply.code(400).send(errorBody(request, 'VALIDATION_ERROR', 'Revise os dados e aceite os termos para continuar.'));
    if (await database.user.findUnique({ where: { email }, select: { id: true } })) return reply.code(202).send({ pending: true });
    const rawToken = token(); const passwordHash = await hashPassword(password); const now = new Date();
    await database.pendingSignup.upsert({ where: { email }, create: { email, name, passwordHash, storeSlug: slug(name), tokenHash: sha256(rawToken), expiresAt: new Date(now.getTime() + 30 * 60_000) }, update: { name, passwordHash, storeSlug: slug(name), tokenHash: sha256(rawToken), expiresAt: new Date(now.getTime() + 30 * 60_000), emailSentAt: null } });
    try { await sendVerification(environment, email, name, rawToken); await database.pendingSignup.update({ where: { email }, data: { emailSentAt: new Date() } }); }
    catch (error) { request.log.error({ err: error }, 'signup_verification_email_failed'); return reply.code(503).send(errorBody(request, 'EMAIL_UNAVAILABLE', 'Não foi possível enviar a confirmação agora. Tente novamente.')); }
    return reply.code(202).send({ pending: true });
  });
  app.post<{ Body: { token?: unknown } }>('/auth/verify-email', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!authorized(request)) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const rawToken = typeof request.body?.token === 'string' ? request.body.token : ''; if (rawToken.length < 32 || rawToken.length > 128) return reply.code(400).send(errorBody(request, 'TOKEN_INVALID', 'Link inválido ou expirado.'));
    const pending = await database.pendingSignup.findFirst({ where: { tokenHash: sha256(rawToken), expiresAt: { gt: new Date() } } }); if (!pending) return reply.code(400).send(errorBody(request, 'TOKEN_INVALID', 'Link inválido ou expirado.'));
    await database.$transaction(async tx => { const current = await tx.pendingSignup.findUnique({ where: { id: pending.id } }); if (!current || current.tokenHash !== sha256(rawToken) || current.expiresAt <= new Date()) throw new Error('TOKEN_CONSUMED'); const user = await tx.user.create({ data: { email: current.email, name: current.name, passwordHash: current.passwordHash, emailVerifiedAt: new Date() } }); const store = await tx.store.create({ data: { name: `${current.name.split(' ')[0]} Store`, slug: current.storeSlug } }); await tx.storeMember.create({ data: { userId: user.id, storeId: store.id, role: 'OWNER' } }); await tx.pendingSignup.delete({ where: { id: current.id } }); });
    return reply.send({ verified: true });
  });
}
