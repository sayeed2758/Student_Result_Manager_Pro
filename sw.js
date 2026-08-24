const CACHE_NAME = 'ezee-result-manager-v15-smooth-reliability';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './assets/style.css',
  './assets/image.svg.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async url => {
      try { await cache.add(url); } catch (_) { /* keep install alive if one asset is temporarily unavailable */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isAppShell = url.origin === self.location.origin &&
    (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/app.js') || url.pathname.endsWith('/style.css'));

  if (!isAppShell) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => caches.match('./assets/image.svg.png'));
      })
    );
    return;
  }

  // Prefer the latest deployed app files; fall back to the offline cache.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
