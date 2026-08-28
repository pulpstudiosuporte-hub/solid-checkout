const CACHE = 'solid-shell-v1'; const SHELL = ['/', '/manifest.webmanifest', '/brand/solid-symbol.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request; if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') { event.respondWith(fetch(request).catch(() => caches.match('/'))); return; }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if (response.ok && ['style', 'script', 'image', 'font'].includes(request.destination)) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); } return response; })));
});
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { title: 'Novo alerta SOLID', message: event.data?.text() || 'Abra o aplicativo para conferir.' }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'Novo alerta SOLID', {
    body: payload.message || 'Abra o aplicativo para conferir.',
    icon: '/brand/solid-symbol.png',
    badge: '/brand/solid-symbol.png',
    tag: payload.tag || 'solid-alert',
    renotify: true,
    data: { destination: payload.destination || 'Pedidos', targetId: payload.targetId || null },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => 'focus' in client);
    return existing ? existing.focus() : self.clients.openWindow('/');
  }));
});
