// FitAI service worker — minimal app-shell cache.
// Bump CACHE_VERSION to invalidate old caches on deploy.
const CACHE_VERSION = 'fitai-v1';
const APP_SHELL = [
  '/fitai/',
  '/fitai/index.html',
  '/fitai/manifest.json',
];

// Pre-cache the shell so the landing page works offline.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Drop stale caches from previous versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first for navigations (always prefer fresh HTML), falling back to
// the cached shell when offline. Other GETs use cache-first with background
// refresh. Non-GET and cross-origin API/CDN calls pass straight through.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (sameOrigin) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/fitai/index.html')))
    );
    return;
  }

  if (!sameOrigin) return; // let the network handle Supabase / CDN / GitHub assets

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
