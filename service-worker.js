const CACHE_NAME = 'mapmaker-v3';
const OFFLINE_CACHE = 'mapmaker-offline-v3';
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
  './data/glot-system.jsonc',
  // CDN resources (cache for offline)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@4.6.1/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/gridjs@6.0.6/dist/theme/mermaid.min.css',
  'https://unpkg.com/maplibre-gl@4.3.1/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@4.3.1/dist/maplibre-gl.js',
  'https://www.unpkg.com/pmtiles@3.0.5/dist/pmtiles.js',
  'https://cdn.jsdelivr.net/npm/gridjs@6.0.6/dist/gridjs.production.min.js',
  'https://unpkg.com/json5@^2.0.0/dist/index.min.js',
  'https://code.jquery.com/jquery-3.3.1.min.js',
  'https://cdn.jsdelivr.net/npm/moment@2.24.0/moment.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.6/umd/popper.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/chroma-js/2.1.0/chroma.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@4.6.1/dist/js/bootstrap.bundle.min.js',
  'https://unpkg.com/glottologist@2.0.3/dist/glottologist.min.js',
  'https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js'
];
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
      STATIC_FILES.map(async (url) => {
        try {
          // cache.add は内部で fetch+put を行う（opaqueも可）
          await cache.add(url);
        } catch (e) {
          // 一部のCDNが失敗しても全体は継続
          console.warn('[SW] cache add failed:', url, e);
        }
      })
    );
    self.skipWaiting();
  })());
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
