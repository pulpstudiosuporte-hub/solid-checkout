import { describe, expect, it } from 'vitest';
import { notificationContent } from '../src/notification-content.js';

describe('notification content', () => {
  it('includes the pending Pix amount formatted in BRL', () => {
    expect(notificationContent('payment.pix_created', { provider: 'ROAS', amountCents: 13467 })).toMatchObject({
      title: 'Novo Pix pendente · R$\u00a0134,67',
      message: 'Um cliente gerou um Pix de R$\u00a0134,67 via ROAS.',
    });
  });

  it('includes the confirmed sale amount formatted in BRL', () => {
    expect(notificationContent('payment.webhook_verified', { provider: 'WESTPAY', providerStatus: 'PAID', amountCents: 500 })).toMatchObject({
      title: 'Venda paga · R$\u00a05,00',
      message: 'Uma venda de R$\u00a05,00 foi confirmada via WESTPAY.',
    });
  });

  it('keeps old audit events without an amount readable', () => {
    expect(notificationContent('payment.pix_created', { provider: 'ROAS' }).title).toBe('Novo Pix pendente');
  });
});
