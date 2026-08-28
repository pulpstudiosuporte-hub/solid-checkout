const PUSH_KEY = 'solid:web-push';

export function webPushEnabled() { return window.localStorage.getItem(PUSH_KEY) === 'on'; }
export function setWebPushEnabled(enabled) { window.localStorage.setItem(PUSH_KEY, enabled ? 'on' : 'off'); }
export function webPushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }

function applicationServerKey(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(character => character.charCodeAt(0)));
}

export async function ensureWebPushSubscription(publicKey) {
  if (!webPushSupported()) throw new Error('Este aparelho n\u00e3o oferece suporte a Web Push.');
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing.toJSON();
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
  return subscription.toJSON();
}

export async function currentWebPushSubscription() {
  if (!webPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function disableWebPushOnThisDevice(subscription) {
  try { if (subscription) await subscription.unsubscribe(); }
  finally { setWebPushEnabled(false); }
}
