const CACHE_NAME = 'mapmaker-v1';
const OFFLINE_CACHE = 'mapmaker-offline-v1';
const STATIC_FILES = [
  './',
  './index.html',
  './base.css',
  './cmapmaker.js',
  './initialize.js',
  './lib/basiclib.js',
  './lib/geolib.js',
  './lib/gsheetlib.js',
  './lib/listtable.js',
  './lib/osmtogeojson.js',
  './lib/overpasslib.js',
  './lib/poilib.js',
  './lib/winlib.js',
  './modal/modal_activities.js',
  './modal/modal_osmbasic.js',
  './modal/modal_wikipedia.js',
  './drive-upload.js',
  './sheets-db.js',
  'https://unpkg.com/maplibre-gl@4.3.1/dist/maplibre-gl.js',
  'https://unpkg.com/maplibre-gl@4.3.1/dist/maplibre-gl.css'
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((name) => {
        if (name !== CACHE_NAME && name !== OFFLINE_CACHE) {
          return caches.delete(name);
        }
      })
    ))
  );
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.url.includes('googleapis.com') || request.url.includes('google.com/gsi')) return;
  if (request.url.includes('/tiles/') || request.url.includes('tile.openstreetmap')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(OFFLINE_CACHE).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        return response;
      });
    }).catch(() => {
      if (request.destination === 'document') {
        return caches.match('./index.html');
      }
    })
  );
});
