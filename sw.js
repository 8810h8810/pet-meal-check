const CACHE = 'pet-meal-pwa-v4';
const ROOT = new URL('./', self.location.href);
const ASSETS = [
  './', './index.html', './cat/', './cat/index.html',
  './manifest.webmanifest', './cat/manifest.webmanifest', './pwa.js', './check-sync.js',
  './IMG_9853.jpeg', './IMG_9860.jpeg',
  './dog-icon.jpeg%20.jpg', './cat-icon.jpeg%20.jpg'
].map(path => new URL(path, ROOT).href);

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('pet-meal-pwa-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !ASSETS.includes(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Serve HTML and scripts from the same installed release, including offline.
    return await cache.match(request) || fetch(request);
  })());
});
