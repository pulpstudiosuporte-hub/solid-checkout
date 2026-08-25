import type { AppEnvironment } from '@solid/config';
import type { PrismaClient } from '@solid/database';
import type { FastifyBaseLogger } from 'fastify';
import { decryptSecret } from './shopify-crypto.js';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!);
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

function nextSession(database: PrismaClient) {
  const now = new Date();
  return database.checkoutSession.findFirst({ where: { status: 'COMPLETED', customerDataEncrypted: { not: null }, confirmationEmailSentAt: null, confirmationEmailAttempts: { lt: 8 }, OR: [{ confirmationEmailNextAttemptAt: null }, { confirmationEmailNextAttemptAt: { lte: now } }], AND: [{ OR: [{ confirmationEmailClaimedAt: null }, { confirmationEmailClaimedAt: { lt: new Date(now.getTime() - 5 * 60_000) } }] }] }, orderBy: { completedAt: 'asc' }, select: { id: true, publicId: true, totalCents: true, discountCents: true, couponCode: true, shippingPriceCents: true, customerDataEncrypted: true, confirmationEmailAttempts: true, checkout: { select: { store: { select: { name: true } } } }, paymentAttempts: { where: { status: 'PAID' }, orderBy: { paidAt: 'desc' }, take: 1, select: { amountCents: true } }, items: { select: { titleSnapshot: true, quantity: true, totalCents: true, product: { select: { fulfillmentType: true, externalDeliveryUrl: true } } } } } });
}

type EmailSession = NonNullable<Awaited<ReturnType<typeof nextSession>>>;

async function sendConfirmation(environment: AppEnvironment, session: EmailSession): Promise<void> {
  if (!environment.RESEND_API_KEY || !environment.EMAIL_FROM || !environment.APP_ENCRYPTION_KEY) return;
  const customer = JSON.parse(decryptSecret(session.customerDataEncrypted!, environment.APP_ENCRYPTION_KEY)) as { name?: string; email?: string };
  if (!customer.email || !/^\S+@\S+\.\S+$/.test(customer.email)) throw new Error('E-mail do cliente indisponível');
  const access = session.items.flatMap(item => item.product.fulfillmentType === 'DIGITAL' && item.product.externalDeliveryUrl ? [{ title: item.titleSnapshot, url: item.product.externalDeliveryUrl }] : []);
  const itemRows = session.items.map(item => `<tr><td style="padding:8px 0;color:#34313d">${item.quantity}× ${escapeHtml(item.titleSnapshot)}</td><td style="padding:8px 0;text-align:right;font-weight:700">${money(item.totalCents)}</td></tr>`).join('');
  const paidCents = session.paymentAttempts[0]?.amountCents ?? session.totalCents - session.discountCents + session.shippingPriceCents;
  const totalsHtml = `<table style="width:100%;margin-top:12px;border-top:1px solid #e8e6ed"><tr><td style="padding:12px 0 4px;color:#686471">Subtotal</td><td style="padding:12px 0 4px;text-align:right">${money(session.totalCents)}</td></tr>${session.discountCents > 0 ? `<tr><td style="padding:4px 0;color:#138b50">Desconto${session.couponCode ? ` (${escapeHtml(session.couponCode)})` : ''}</td><td style="padding:4px 0;text-align:right;color:#138b50">- ${money(session.discountCents)}</td></tr>` : ''}${session.shippingPriceCents > 0 ? `<tr><td style="padding:4px 0;color:#686471">Frete</td><td style="padding:4px 0;text-align:right">${money(session.shippingPriceCents)}</td></tr>` : ''}<tr><td style="padding:10px 0 4px;font-weight:700">Total pago</td><td style="padding:10px 0 4px;text-align:right;font-weight:700">${money(paidCents)}</td></tr></table>`;
  const accessHtml = access.length ? `<div style="margin:24px 0;padding:20px;border-radius:14px;background:#f2efff"><h2 style="margin:0 0 12px;font-size:18px">Seu acesso foi liberado</h2>${access.map(item => `<p style="margin:10px 0"><a href="${escapeHtml(item.url)}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#7047eb;color:#fff;text-decoration:none;font-weight:700">Acessar ${escapeHtml(item.title)}</a></p>`).join('')}</div>` : '';
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${environment.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `solid-payment-${session.publicId}` }, body: JSON.stringify({ from: environment.EMAIL_FROM, to: [customer.email], subject: `Pagamento confirmado — pedido #${session.publicId.slice(-8).toUpperCase()}`, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17131f"><p style="color:#7047eb;font-weight:700">SOLID CHECKOUT</p><h1>Pagamento confirmado</h1><p>Olá, ${escapeHtml(customer.name || 'cliente')}. Recebemos seu pagamento de <strong>${money(paidCents)}</strong>.</p><table style="width:100%;border-collapse:collapse">${itemRows}</table>${totalsHtml}${accessHtml}<p style="margin-top:28px;color:#686471;font-size:13px">Este é um e-mail automático de confirmação da ${escapeHtml(session.checkout.store.name)}.</p></div>` }) });
  if (!response.ok) throw new Error(`Resend recusou o envio (${response.status})`);
}

export function startConfirmationEmailDelivery(environment: AppEnvironment, database: PrismaClient, log: FastifyBaseLogger): () => void {
  if (!environment.RESEND_API_KEY || !environment.EMAIL_FROM || !environment.APP_ENCRYPTION_KEY) { log.info('confirmation_email_delivery_disabled'); return () => undefined; }
  let running = false;
  const run = async () => {
    if (running) return; running = true;
    try {
      for (let count = 0; count < 20; count += 1) {
        const session = await nextSession(database); if (!session) break;
        const claimedAt = new Date();
        const claim = await database.checkoutSession.updateMany({ where: { id: session.id, confirmationEmailSentAt: null, OR: [{ confirmationEmailClaimedAt: null }, { confirmationEmailClaimedAt: { lt: new Date(claimedAt.getTime() - 5 * 60_000) } }] }, data: { confirmationEmailClaimedAt: claimedAt } });
        if (!claim.count) continue;
        try {
          await sendConfirmation(environment, session);
          await database.checkoutSession.update({ where: { id: session.id }, data: { confirmationEmailSentAt: new Date(), confirmationEmailClaimedAt: null, confirmationEmailLastError: null } });
          log.info({ checkoutSessionId: session.publicId }, 'confirmation_email_sent');
        } catch (error) {
          const attempts = session.confirmationEmailAttempts + 1; const delayMinutes = Math.min(360, 2 ** attempts);
          const message = error instanceof Error ? error.message.slice(0, 500) : 'Falha desconhecida';
          await database.checkoutSession.update({ where: { id: session.id }, data: { confirmationEmailAttempts: { increment: 1 }, confirmationEmailClaimedAt: null, confirmationEmailNextAttemptAt: new Date(Date.now() + delayMinutes * 60_000), confirmationEmailLastError: message } });
          log.warn({ err: error, checkoutSessionId: session.publicId, attempts }, 'confirmation_email_failed');
        }
      }
    } catch (error) { log.error({ err: error }, 'confirmation_email_delivery_failed'); } finally { running = false; }
  };
  void run(); const interval = setInterval(() => void run(), 30_000); interval.unref(); return () => clearInterval(interval);
}
