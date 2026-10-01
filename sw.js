const CACHE = 'pet-meal-pwa-v1';
const ROOT = new URL('./', self.location.href);
const ASSETS = [
  './', './index.html', './cat/', './cat/index.html',
  './manifest.webmanifest', './cat/manifest.webmanifest', './pwa.js',
  './IMG_9853.jpeg', './IMG_9860.jpeg',
  './dog-icon.jpeg%20.jpg', './cat-icon.jpeg%20.jpg'
].map(path => new URL(path, ROOT).href);

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
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          return response;
        }
      } catch (_) { /* Use the saved page when offline. */ }
      return await cache.match(request) || Response.error();
    }
    return await cache.match(request) || fetch(request);
  })());
});
