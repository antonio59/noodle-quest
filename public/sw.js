/* Noodle Quest service worker.
 *
 * Conservative caching strategy so deploys are never stale:
 *  - navigations: network-first, falling back to the cached app shell
 *  - hashed build assets (/assets/*): cache-first (immutable by name)
 *  - dictionary, icons + game art: stale-while-revalidate
 *  - everything else (Convex API, fonts, etc.): untouched
 */
const CACHE = 'nq-v5';
const APP_SHELL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([APP_SHELL, '/manifest.webmanifest'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigations: try the network so new deploys land immediately,
  // fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(APP_SHELL, copy));
          return res;
        })
        .catch(() => caches.match(APP_SHELL)),
    );
    return;
  }

  // Hashed build assets never change for a given name: cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Big static extras: serve from cache, refresh in the background.
  if (url.pathname.startsWith('/dict/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/art/') || url.pathname === '/favicon.svg') {
    event.respondWith(
      caches.match(request).then((hit) => {
        const refresh = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      }),
    );
  }
});
