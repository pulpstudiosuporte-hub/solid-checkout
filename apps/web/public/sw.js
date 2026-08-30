const CACHE = 'solid-shell-v3';
const STATIC_ASSETS = ['/', '/manifest.webmanifest', '/brand/solid-symbol.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Navigation is network-first so a new deploy cannot remain stuck behind
  // an outdated index.html. The cached shell is only an offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (!['style', 'script', 'image', 'font'].includes(request.destination)) return;

  // Vite assets are content-hashed. Refresh them in the background while
  // retaining the cached response for fast repeat loads.
  event.respondWith(
    caches.match(request).then(cached => {
      const fresh = fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
      return cached || fresh;
    }),
  );
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {
      title: 'Novo alerta SOLID',
      message: event.data?.text() || 'Abra o aplicativo para conferir.',
    };
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'Novo alerta SOLID', {
    body: payload.message || 'Abra o aplicativo para conferir.',
    icon: '/brand/solid-symbol.png',
    badge: '/brand/solid-symbol.png',
    tag: payload.tag || 'solid-alert',
    renotify: true,
    data: {
      destination: payload.destination || 'Pedidos',
      targetId: payload.targetId || null,
    },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => 'focus' in client);
    return existing ? existing.focus() : self.clients.openWindow('/');
  }));
});
