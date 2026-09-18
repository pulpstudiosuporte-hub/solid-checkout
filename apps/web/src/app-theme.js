import { useSyncExternalStore } from 'react';

const key = 'pirat-appearance-v1';
const listeners = new Set();
let preference;

function savedTheme() {
  try {
    const value = localStorage.getItem(key);
    return value === 'dark' || value === 'light' ? value : null;
  } catch { return null; }
}

export function getAppTheme() {
  return preference ?? savedTheme() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function notify() { listeners.forEach(listener => listener()); }
function subscribe(listener) {
  listeners.add(listener);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const storage = event => {
    if (event.key === key || event.key === null) { preference = undefined; notify(); }
  };
  media.addEventListener('change', notify);
  window.addEventListener('storage', storage);
  return () => { listeners.delete(listener); media.removeEventListener('change', notify); window.removeEventListener('storage', storage); };
}

export function useAppTheme() {
  const theme = useSyncExternalStore(subscribe, getAppTheme, () => 'light');
  const toggleTheme = () => {
    preference = getAppTheme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(key, preference); } catch { /* Still works for this visit when storage is unavailable. */ }
    notify();
  };
  return { theme, toggleTheme };
}
