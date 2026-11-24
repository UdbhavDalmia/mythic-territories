const CACHE_NAME = 'mythic-cache-v1';
const PRECACHE_URLS = [
  '/fonts/almendra-sc-latin.woff2',
  '/fonts/rye-latin.woff2',
  '/images/bg-game.webp',
  '/images/bg-game2.webp',
  '/images/menu-bg.webp',
  '/site.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('Pre-cache partial failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache-first for static fonts, images, and units
  if (
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/units/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for other requests
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
