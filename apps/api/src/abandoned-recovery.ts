import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaClient } from '@solid/database';
import { decryptSecret } from './shopify-crypto.js';

const MINUTE = 60_000;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!);
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

async function enqueue(database: PrismaClient): Promise<void> {
  const now = new Date();
  const configurations = await database.abandonedRecoverySettings.findMany({ where: { enabled: true, activatedAt: { not: null } }, select: { storeId: true, activatedAt: true, firstDelayMinutes: true, secondEnabled: true, secondDelayHours: true } });
  for (const configuration of configurations) {
    const steps = [{ step: 1, delayMinutes: configuration.firstDelayMinutes }, ...(configuration.secondEnabled ? [{ step: 2, delayMinutes: configuration.secondDelayHours * 60 }] : [])];
    for (const step of steps) {
      const cutoff = new Date(now.getTime() - step.delayMinutes * MINUTE);
      const sessions = await database.checkoutSession.findMany({
        where: {
          checkout: { storeId: configuration.storeId, status: 'PUBLISHED' },
          customerCapturedAt: { not: null, gte: configuration.activatedAt!, lte: cutoff }, customerDataEncrypted: { not: null }, status: { not: 'COMPLETED' },
          OR: [{ status: { in: ['EXPIRED', 'CANCELLED'] } }, { status: 'OPEN', expiresAt: { lte: now } }],
          NOT: { paymentAttempts: { some: { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } },
          abandonedRecoveryDeliveries: { none: { step: step.step } }
        },
        orderBy: { customerCapturedAt: 'asc' }, take: 100, select: { id: true, customerCapturedAt: true }
      });
      if (sessions.length) await database.abandonedRecoveryDelivery.createMany({ data: sessions.map(session => ({ storeId: configuration.storeId, checkoutSessionId: session.id, step: step.step, scheduledAt: new Date((session.customerCapturedAt ?? now).getTime() + step.delayMinutes * MINUTE) })), skipDuplicates: true });
    }
  }
}

async function send(environment: AppEnvironment, database: PrismaClient, deliveryId: string): Promise<string> {
  const delivery = await database.abandonedRecoveryDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      step: true, checkoutSessionId: true,
      checkoutSession: { select: {
        publicId: true, status: true, totalCents: true, discountCents: true, shippingPriceCents: true, customerDataEncrypted: true,
        paymentAttempts: { where: { status: { in: ['PENDING', 'PAID'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, expiresAt: true } },
        items: { select: { titleSnapshot: true, quantity: true } },
        checkout: { select: { slug: true, status: true, store: { select: { name: true, slug: true, customDomain: { select: { hostname: true, status: true } } } } } }
      } }
    }
  });
  if (!delivery) throw new Error('Entrega de recuperação não encontrada');
  const session = delivery.checkoutSession;
  const attempt = session.paymentAttempts[0];
  if (session.status === 'COMPLETED' || attempt?.status === 'PAID') return 'CANCELLED_COMPLETED';
  if (attempt?.status === 'PENDING' && (!attempt.expiresAt || attempt.expiresAt > new Date())) return 'CANCELLED_PENDING_PIX';
  if (session.checkout.status !== 'PUBLISHED') return 'CANCELLED_CHECKOUT';
  const domain = session.checkout.store.customDomain;
  if (!domain || domain.status !== 'ACTIVE') return 'CANCELLED_DOMAIN';
  if (delivery.step === 2) {
    const first = await database.abandonedRecoveryDelivery.findUnique({ where: { checkoutSessionId_step: { checkoutSessionId: delivery.checkoutSessionId, step: 1 } }, select: { status: true, lastError: true } });
    if (first?.status !== 'DELIVERED' || first.lastError) return 'CANCELLED_FIRST_NOT_SENT';
  }
  const customer = JSON.parse(decryptSecret(session.customerDataEncrypted!, environment.APP_ENCRYPTION_KEY!)) as { name?: string; email?: string };
  if (!customer.email || !/^\S+@\S+\.\S+$/.test(customer.email)) return 'CANCELLED_NO_EMAIL';
  const amount = session.totalCents - session.discountCents + session.shippingPriceCents;
  const checkoutUrl = `https://${domain.hostname}/#/c/${encodeURIComponent(session.checkout.store.slug)}/${encodeURIComponent(session.checkout.slug)}`;
  const product = session.items[0]?.titleSnapshot || 'seu pedido';
  const subject = delivery.step === 1 ? `Você esqueceu ${product} no carrinho` : `Seu carrinho na ${session.checkout.store.name} ainda está disponível`;
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${environment.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `solid-abandoned-${session.publicId}-${delivery.step}` }, body: JSON.stringify({ from: environment.EMAIL_FROM, to: [customer.email], subject, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17131f"><p style="color:#7047eb;font-weight:700">${escapeHtml(session.checkout.store.name)}</p><h1>Seu carrinho está esperando por você</h1><p>Olá, ${escapeHtml(customer.name || 'cliente')}. Você iniciou uma compra de <strong>${escapeHtml(product)}</strong> no valor de <strong>${money(amount)}</strong>, mas não concluiu.</p><p style="margin:28px 0"><a href="${checkoutUrl}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#7047eb;color:#fff;text-decoration:none;font-weight:700">Voltar ao checkout</a></p><p style="color:#686471;font-size:13px">Se você não quiser continuar, ignore este e-mail. Nenhuma cobrança foi realizada.</p></div>` }) });
  if (!response.ok) throw new Error(`Resend recusou o envio (${response.status})`);
  return 'DELIVERED';
}

export function startAbandonedRecovery(environment: AppEnvironment, database: PrismaClient, log: FastifyBaseLogger): () => void {
  if (!environment.RESEND_API_KEY || !environment.EMAIL_FROM || !environment.APP_ENCRYPTION_KEY) { log.info('abandoned_recovery_disabled'); return () => undefined; }
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await enqueue(database);
      for (let count = 0; count < 20; count += 1) {
        const now = new Date();
        const delivery = await database.abandonedRecoveryDelivery.findFirst({ where: { status: 'PENDING', scheduledAt: { lte: now }, attempts: { lt: 8 }, OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - 5 * MINUTE) } }] }, orderBy: { scheduledAt: 'asc' }, select: { id: true, attempts: true } });
        if (!delivery) break;
        const claim = await database.abandonedRecoveryDelivery.updateMany({ where: { id: delivery.id, status: 'PENDING', OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - 5 * MINUTE) } }] }, data: { status: 'PROCESSING', claimedAt: now } });
        if (!claim.count) continue;
        try {
          const result = await send(environment, database, delivery.id);
          await database.abandonedRecoveryDelivery.update({ where: { id: delivery.id }, data: { status: 'DELIVERED', deliveredAt: new Date(), claimedAt: null, lastError: result === 'DELIVERED' ? null : result } });
          log.info({ deliveryId: delivery.id, result }, 'abandoned_recovery_processed');
        } catch (error) {
          const attempts = delivery.attempts + 1;
          await database.abandonedRecoveryDelivery.update({ where: { id: delivery.id }, data: { status: attempts >= 8 ? 'DEAD' : 'PENDING', attempts: { increment: 1 }, claimedAt: null, scheduledAt: new Date(Date.now() + Math.min(360, 2 ** attempts) * MINUTE), lastError: (error instanceof Error ? error.message : 'Falha desconhecida').slice(0, 500) } });
          log.warn({ err: error, deliveryId: delivery.id, attempts }, 'abandoned_recovery_failed');
        }
      }
    } catch (error) { log.error({ err: error }, 'abandoned_recovery_job_failed'); } finally { running = false; }
  };
  const initial = setTimeout(() => void run(), 45_000); initial.unref();
  const interval = setInterval(() => void run(), 60_000); interval.unref();
  return () => { clearTimeout(initial); clearInterval(interval); };
}
