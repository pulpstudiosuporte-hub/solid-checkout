import { describe, expect, it } from 'vitest';
import { checkoutEditorHistory as reduce, createEditorHistory } from '../src/checkout-editor-history';

describe('checkout editor history', () => {
  it('groups continuous typing and preserves a complete undo/redo step', () => {
    let state = createEditorHistory({ title: 'Original' });
    for (const [at, title] of [[1000, 'N'], [1100, 'No'], [1200, 'Novo']]) {
      state = reduce(state, { type: 'change', key: 'title', at, value: { title } });
    }
    expect(state.past).toHaveLength(1);
    state = reduce(state, { type: 'undo' });
    expect(state.present.title).toBe('Original');
    expect(reduce(state, { type: 'redo' }).present.title).toBe('Novo');
  });
  it('restores all template fields together and invalidates redo after a new edit', () => {
    const initial = { primary: '#000000', radius: 10, title: 'Minha loja' };
    let state = reduce(createEditorHistory(initial), { type: 'change', at: 1, value: old => ({ ...old, primary: '#ffffff', radius: 20 }) });
    state = reduce(state, { type: 'undo' });
    expect(state.present).toEqual(initial);
    state = reduce(state, { type: 'change', key: 'title', at: 2, value: old => ({ ...old, title: 'Outro título' }) });
    expect(state.future).toEqual([]);
    expect(reduce(state, { type: 'redo' })).toBe(state);
  });
  it('separates paused typing and field changes and limits retained history to 50 steps', () => {
    let state = createEditorHistory({ title: '' });
    for (let i = 0; i < 60; i++) state = reduce(state, { type: 'change', key: 'title', at: i * 1000, value: { title: String(i) } });
    expect(state.past).toHaveLength(50);
    state = reduce(state, { type: 'change', key: 'radius', at: 59001, value: old => ({ ...old, radius: 12 }) });
    expect(reduce(state, { type: 'undo' }).present).toEqual({ title: '59' });
  });
  it('does not record no-op updates', () => {
    const state = createEditorHistory({ title: 'Original' });
    expect(reduce(state, { type: 'change', value: old => old })).toBe(state);
    expect(reduce(state, { type: 'undo' })).toBe(state);
  });
  it('keeps typing after saving in a separate undo step', () => {
    let state = createEditorHistory({ title: 'Original' });
    state = reduce(state, { type: 'change', key: 'title', at: 1000, value: { title: 'Salvo' } });
    state = reduce(state, { type: 'checkpoint' });
    state = reduce(state, { type: 'change', key: 'title', at: 1100, value: { title: 'Salvo mais edição' } });
    expect(reduce(state, { type: 'undo' }).present.title).toBe('Salvo');
  });
});
