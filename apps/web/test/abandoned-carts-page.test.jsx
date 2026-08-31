import { describe, expect, it } from 'vitest';
import { normalizeAbandonedCartsResponse } from '../src/AbandonedCartsPage.jsx';

describe('normalização dos carrinhos abandonados', () => {
  it('aceita uma resposta vazia ou antiga sem derrubar a página', () => {
    expect(normalizeAbandonedCartsResponse()).toMatchObject({ items: [], total: 0, page: 1, pages: 1, metrics: { totalCents: 0, averageCents: 0 } });
    expect(normalizeAbandonedCartsResponse({ total: 2 })).toMatchObject({ items: [], total: 2, metrics: { totalCents: 0, averageCents: 0 } });
  });

  it('preserva os dados válidos e corrige métricas inválidas', () => {
    const item = { publicId: 'cart-a', totalCents: 5600 };
    expect(normalizeAbandonedCartsResponse({ items: [item], total: 1, page: 2, pages: 3, metrics: { totalCents: 5600, averageCents: 5600 } })).toMatchObject({ items: [item], total: 1, page: 2, pages: 3, metrics: { totalCents: 5600, averageCents: 5600 } });
    expect(normalizeAbandonedCartsResponse({ items: [item], metrics: { totalCents: 'inválido' } })).toMatchObject({ total: 1, metrics: { totalCents: 0, averageCents: 0 } });
  });

  it('completa registros antigos sem itens ou etapa', () => {
    expect(normalizeAbandonedCartsResponse({ items: [{ publicId: 'legacy-a', totalCents: '1200' }] }).items[0]).toMatchObject({ publicId: 'legacy-a', totalCents: 1200, lastStage: 'IDENTIFICATION', customer: {}, items: [] });
  });
});
