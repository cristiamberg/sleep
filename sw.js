const CACHE_NAME = 'sono-app-v1';
const urlsToCache = [
  './',
  './index.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna a versão em cache ou faz o download da rede
        return response || fetch(event.request);
      })
  );
});
