import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { hashPassword } from './password.js';
import { verifyTurnstile } from './turnstile.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const verificationCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0');
const errorBody = (request: FastifyRequest, code: string, message: string) => ({ error: { code, message, requestId: request.id } });
const slug = (name: string) => `${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'loja'}-${randomBytes(4).toString('hex')}`;
const codeHash = (environment: AppEnvironment, email: string, code: string): string => createHmac('sha256', environment.APP_ENCRYPTION_KEY ?? 'solid-development-signup-code').update(`signup:${email}:${code}`).digest('hex');
const hashesMatch = (left: string, right: string): boolean => left.length === right.length && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));

async function sendVerification(environment: AppEnvironment, email: string, name: string, code: string): Promise<void> {
  if (!environment.RESEND_API_KEY || !environment.EMAIL_FROM || !environment.APP_URL) throw new Error('Serviço de cadastro por e-mail indisponível');
  const verificationUrl = `${environment.APP_URL.replace(/\/$/, '')}/#/verificar-email?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${environment.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `solid-signup-${codeHash(environment, email, code)}` }, body: JSON.stringify({ from: environment.EMAIL_FROM, to: [email], subject: `${code} é seu código de confirmação SOLID`, html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17131f"><p style="color:#7047eb;font-weight:700">SOLID CHECKOUT</p><h1>Confirme seu e-mail</h1><p>Olá, ${name.replace(/[<>&"']/g, '')}. Digite o código abaixo para liberar sua conta e criar sua loja:</p><p style="font-size:32px;letter-spacing:8px;font-weight:800;margin:28px 0">${code}</p><p><a href="${verificationUrl}" style="display:inline-block;padding:14px 20px;border-radius:10px;background:#7047eb;color:#fff;text-decoration:none;font-weight:700">Confirmar automaticamente</a></p><p style="color:#686471;font-size:13px">O código expira em 30 minutos e só pode ser usado uma vez. A equipe SOLID nunca pedirá esse código. Se você não solicitou o cadastro, ignore esta mensagem.</p></div>` }) });
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
    const code = verificationCode(); const passwordHash = await hashPassword(password); const now = new Date();
    await database.pendingSignup.upsert({ where: { email }, create: { email, name, passwordHash, storeSlug: slug(name), tokenHash: codeHash(environment, email, code), expiresAt: new Date(now.getTime() + 30 * 60_000) }, update: { name, passwordHash, storeSlug: slug(name), tokenHash: codeHash(environment, email, code), expiresAt: new Date(now.getTime() + 30 * 60_000), emailSentAt: null } });
    try { await sendVerification(environment, email, name, code); await database.pendingSignup.update({ where: { email }, data: { emailSentAt: new Date() } }); }
    catch (error) { request.log.error({ err: error }, 'signup_verification_email_failed'); return reply.code(503).send(errorBody(request, 'EMAIL_UNAVAILABLE', 'Não foi possível enviar a confirmação agora. Tente novamente.')); }
    return reply.code(202).send({ pending: true });
  });
  app.post<{ Body: { token?: unknown; email?: unknown; code?: unknown } }>('/auth/verify-email', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!authorized(request)) return reply.code(403).send(errorBody(request, 'CSRF_INVALID', 'Requisição não autorizada.'));
    const rawToken = typeof request.body?.token === 'string' ? request.body.token : '';
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const code = typeof request.body?.code === 'string' ? request.body.code.replace(/\D/g, '') : '';
    const legacy = rawToken.length >= 32 && rawToken.length <= 128;
    if (!legacy && (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320 || !/^\d{6}$/.test(code))) return reply.code(400).send(errorBody(request, 'CODE_INVALID', 'Código inválido ou expirado.'));
    const pending = legacy ? await database.pendingSignup.findFirst({ where: { tokenHash: sha256(rawToken), expiresAt: { gt: new Date() } } }) : await database.pendingSignup.findUnique({ where: { email } });
    const expectedHash = legacy ? sha256(rawToken) : codeHash(environment, email, code);
    if (!pending || pending.expiresAt <= new Date() || !hashesMatch(pending.tokenHash, expectedHash)) return reply.code(400).send(errorBody(request, 'CODE_INVALID', 'Código inválido ou expirado.'));
    await database.$transaction(async tx => { const current = await tx.pendingSignup.findUnique({ where: { id: pending.id } }); if (!current || !hashesMatch(current.tokenHash, expectedHash) || current.expiresAt <= new Date()) throw new Error('TOKEN_CONSUMED'); await tx.user.create({ data: { email: current.email, name: current.name, passwordHash: current.passwordHash, emailVerifiedAt: new Date(), accountStatus: 'APPROVED' } }); await tx.pendingSignup.delete({ where: { id: current.id } }); });
    return reply.send({ verified: true, activated: true });
  });
}
