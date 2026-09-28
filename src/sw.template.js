// Offline service worker. scripts/service-worker-plugin.mjs fills in the cache name and file list at build time.
const CACHE = __CACHE__;
/** Paths relative to the service worker's scope (the app's base URL). */
const PRECACHE = __PRECACHE__;

const scoped = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map(scoped)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('orbit-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only this app's own files; the leaderboard and other origins always go to the network.
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  if (req.mode === 'navigate') {
    // Network first so a new deploy shows up; the cached page when offline.
    event.respondWith(fetch(req).catch(() => caches.match(scoped('./'), { ignoreVary: true })));
    return;
  }
  // Module scripts send an Origin header; ignore Vary so they still match the precached copies.
  event.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit ?? fetch(req)));
});
