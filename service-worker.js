const CACHE_NAME = 'mapmaker-v2';
const OFFLINE_CACHE = 'mapmaker-offline-v2';
const STATIC_FILES = [
  './',
  './index.html',
  './base.css',
  './baselist.html',
  './cmapmaker.js',
  './initialize.js',
  './offline-sync.js',
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
  './data/config-user.jsonc',
  './data/config-system.jsonc',
  './data/config-activities.jsonc',
  './data/marker.jsonc',
  './data/category-ja.jsonc',
  './data/category-en.jsonc',
  './data/listtable-ja.jsonc',
  './data/listtable-en.jsonc',
  './data/overpass-system.jsonc',
  './data/overpass-custom.jsonc',
  './data/glot-custom.jsonc',
  './data/glot-system.jsonc'
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
