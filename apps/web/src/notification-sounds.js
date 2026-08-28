const SOUND_KEY = 'solid:notification-sounds';
let audioContext;

export function notificationSoundsEnabled() {
  return typeof window !== 'undefined' && window.localStorage.getItem(SOUND_KEY) === 'on';
}
export function setNotificationSoundsEnabled(enabled) { window.localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off'); }
async function context() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  audioContext ||= new AudioContext();
  if (audioContext.state === 'suspended') await audioContext.resume();
  return audioContext;
}
function tone(ctx, frequency, start, duration, volume, type = 'sine') {
  const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination); oscillator.start(start); oscillator.stop(start + duration + 0.02);
}
export async function unlockNotificationSounds() { const ctx = await context(); if (!ctx) return false; tone(ctx, 660, ctx.currentTime, 0.045, 0.012); return ctx.state === 'running'; }
export async function playPendingSound() { if (!notificationSoundsEnabled()) return; const ctx = await context(); if (!ctx) return; const now = ctx.currentTime; tone(ctx, 174.61, now, 0.07, 0.045, 'square'); tone(ctx, 523.25, now + 0.06, 0.18, 0.038, 'triangle'); tone(ctx, 783.99, now + 0.15, 0.24, 0.034); }
export async function playSaleSound() { if (!notificationSoundsEnabled()) return; const ctx = await context(); if (!ctx) return; const now = ctx.currentTime; tone(ctx, 196, now, 0.07, 0.055, 'square'); tone(ctx, 523.25, now + 0.06, 0.24, 0.045, 'triangle'); tone(ctx, 659.25, now + 0.15, 0.3, 0.04, 'triangle'); tone(ctx, 1046.5, now + 0.24, 0.42, 0.045); }

export function deviceNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
}

export async function requestDeviceNotifications() {
  if (deviceNotificationPermission() === 'unsupported') return 'unsupported';
  if (window.Notification.permission === 'default') return window.Notification.requestPermission();
  return window.Notification.permission;
}

export async function showDeviceNotification(item, test = false) {
  if (deviceNotificationPermission() !== 'granted') return false;
  const options = {
    body: test ? 'Os alertas deste aparelho est\u00e3o funcionando.' : item.message,
    icon: '/brand/solid-symbol.png',
    badge: '/brand/solid-symbol.png',
    tag: test ? 'solid-notification-test' : `solid-${item.id}`,
    data: { destination: item.destination || 'orders' },
  };
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(test ? 'Teste de notifica\u00e7\u00e3o SOLID' : item.title, options);
    return true;
  }
  new window.Notification(test ? 'Teste de notifica\u00e7\u00e3o SOLID' : item.title, options);
  return true;
}
