const CACHE_NAME = 'gps-pea-tkt-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.jpg'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event with Network-First Strategy for CSV and assets
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // We handle normal requests and Google Sheets CSV request
  if (
    event.request.method === 'GET' &&
    (requestUrl.origin === self.location.origin || 
     requestUrl.hostname.includes('docs.google.com'))
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // If response is valid, clone and save to cache
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline, check cache
          console.log('[Service Worker] Offline fallback for:', event.request.url);
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If offline and CSV fetch, let's look for any matching sheets cache
            if (requestUrl.hostname.includes('docs.google.com')) {
              return caches.match(new Request(event.request.url, { ignoreSearch: true }));
            }
          });
        })
    );
  } else {
    // Standard bypass for other requests
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});
