export function createEditorHistory(config) {
  return { present: config, past: [], future: [], lastKey: null, lastAt: 0 };
}

export function checkoutEditorHistory(state, action) {
  if (action.type === 'checkpoint') return { ...state, lastKey: null };
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return { ...state, present: state.past.at(-1), past: state.past.slice(0, -1), future: [state.present, ...state.future], lastKey: null };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return { ...state, present: state.future[0], past: [...state.past, state.present], future: state.future.slice(1), lastKey: null };
  }
  if (action.type !== 'change') return state;
  const next = typeof action.value === 'function' ? action.value(state.present) : action.value;
  if (next === state.present) return state;
  const coalesce = action.key && action.key === state.lastKey && action.at - state.lastAt < 650 && !state.future.length;
  return { present: next, past: coalesce ? state.past : [...state.past.slice(-49), state.present], future: [], lastKey: action.key || null, lastAt: action.at };
}
