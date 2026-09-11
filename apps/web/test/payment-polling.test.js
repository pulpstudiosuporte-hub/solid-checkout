import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergePaymentUpdate, pollPaymentStatus } from '../src/payment-polling';

afterEach(() => vi.useRealTimers());
function visibility() { const target = new EventTarget(); target.visibilityState = 'visible'; return target; }
describe('consulta de pagamento', () => {
  it('não volta ao Pix pendente quando uma consulta antiga termina após a confirmação', () => {
    const paid = { publicId: 'pix', status: 'PAID', amountCents: 100 };
    expect(mergePaymentUpdate(paid, { status: 'PENDING' })).toBe(paid);
    expect(mergePaymentUpdate(paid, { status: 'EXPIRED' })).toBe(paid);
    const refunded = mergePaymentUpdate(paid, { status: 'REFUNDED' });
    expect(refunded.status).toBe('REFUNDED');
    expect(mergePaymentUpdate(refunded, paid)).toBe(refunded);
    expect(mergePaymentUpdate({ status: 'PENDING', pixCode: 'code' }, paid)).toMatchObject({ status: 'PAID', pixCode: 'code' });
  });
  it('espera a resposta anterior antes de agendar outra consulta', async () => {
    vi.useFakeTimers();
    let resolve;
    const fetchStatus = vi.fn(() => new Promise(done => { resolve = done; }));
    const stop = pollPaymentStatus({ fetchStatus, onPayment: vi.fn(), visibility: visibility() });
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    resolve({ payment: { status: 'pending' } });
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    stop();
  });
  it('pausa em aba oculta, retoma ao voltar e encerra após pagamento', async () => {
    vi.useFakeTimers();
    const tab = visibility(); tab.visibilityState = 'hidden';
    const fetchStatus = vi.fn().mockResolvedValue({ payment: { status: 'paid' } });
    const onPayment = vi.fn();
    const stop = pollPaymentStatus({ fetchStatus, onPayment, visibility: tab });
    await vi.advanceTimersByTimeAsync(30000); expect(fetchStatus).not.toHaveBeenCalled();
    tab.visibilityState = 'visible'; tab.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(30000);
    expect(fetchStatus).toHaveBeenCalledTimes(1); expect(onPayment).toHaveBeenCalledWith({ status: 'paid' });
    stop();
  });
  it('aborta a consulta e ignora resposta tardia ao sair da tela', async () => {
    vi.useFakeTimers(); let resolve;
    const fetchStatus = vi.fn(() => new Promise(done => { resolve = done; }));
    const onPayment = vi.fn();
    const stop = pollPaymentStatus({ fetchStatus, onPayment, visibility: visibility() });
    stop();
    resolve({ payment: { status: 'paid' } }); await vi.advanceTimersByTimeAsync(10000);
    expect(onPayment).not.toHaveBeenCalled(); expect(fetchStatus.mock.calls[0][0].aborted).toBe(true);
  });
});
