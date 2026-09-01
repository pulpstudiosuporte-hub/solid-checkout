import { describe, expect, it } from 'vitest';
import { normalizeChromaSenseEvent } from '../src/chromasense-routes.js';

describe('eventos do ChromaSense', () => {
  it('aceita coordenadas normalizadas e limita campos enviados pelo navegador', () => {
    expect(normalizeChromaSenseEvent({ type: 'CLICK', x: 1.8, y: -1, target: 'button.checkout-button', targetLabel: 'Finalizar compra', interactive: true, rage: true })).toMatchObject({
      type: 'CLICK', x: 1, y: 0, target: 'button.checkout-button', targetLabel: 'Finalizar compra', interactive: true, rage: true,
    });
  });

  it('não aceita tipos arbitrários nem dados fora do contrato', () => {
    expect(normalizeChromaSenseEvent({ type: 'KEYSTROKE', value: 'dado sensível' })).toBeNull();
    expect(normalizeChromaSenseEvent(null)).toBeNull();
  });

  it('limita duração e profundidade de rolagem', () => {
    expect(normalizeChromaSenseEvent({ type: 'ATTENTION', x: .5, y: .5, durationMs: 99_000 })).toMatchObject({ durationMs: 30_000 });
    expect(normalizeChromaSenseEvent({ type: 'SCROLL', scrollPercent: 140 })).toMatchObject({ scrollPercent: 100 });
  });
});
