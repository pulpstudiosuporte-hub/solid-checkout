import { describe, expect, it } from 'vitest';
import { pixPresentation } from '../src/PixPaymentPanel';

describe('Pix payment states', () => {
  const pending = { status: 'pending', pixCode: 'test-pix' };
  it('stops offering the QR code when the local deadline passes without asserting a financial status', () => {
    expect(pixPresentation(pending, 60).payable).toBe(true);
    expect(pixPresentation(pending, 0)).toMatchObject({ payable: false, title: 'Este Pix expirou' });
    expect(pending.status).toBe('pending');
  });
  it.each(['EXPIRED', 'FAILED', 'CANCELLED', 'REFUNDED', 'UNKNOWN'])('never offers payment for %s', status => {
    expect(pixPresentation({ ...pending, status }, 600).payable).toBe(false);
  });
  it('gives confirmed payment precedence over the elapsed timer', () => {
    expect(pixPresentation({ ...pending, status: 'PAID' }, 0)).toMatchObject({ payable: false, title: 'Pagamento confirmado' });
  });
  it('does not invent an expiry for a missing or invalid deadline', () => {
    expect(pixPresentation(pending, NaN).payable).toBe(true);
    expect(pixPresentation({ status: 'PENDING' }, 600).payable).toBe(false);
  });
});
