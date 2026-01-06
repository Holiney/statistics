const CACHE_NAME = 'work-stats-v1.25';
// Only precache the absolute essentials. 
// DO NOT include index.tsx here as it might cause 404s in some environments, breaking the PWA install.
const PRECACHE_URLS = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // If any of these fail, the SW installation fails. Kept list minimal.
        return cache.addAll(PRECACHE_URLS);
      })
      .catch((err) => {
        console.error('Cache install failed:', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy 1: Navigation (HTML) - Network First, fallback to Cache (SPA Support)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If the server returns 404 (common on some hosts for root URLs), return the cached index.html
          if (!response || response.status === 404) {
             return caches.match('./index.html');
          }
          return response;
        })
        .catch(() => {
          // Network failure (offline)
          return caches.match('./index.html');
        })
    );
    return;
  }

  // Strategy 2: External Dependencies (esm.sh, tailwind) - Stale While Revalidate
  if (url.hostname === 'esm.sh' || url.hostname === 'cdn.tailwindcss.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => undefined);
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy 3: Runtime Caching for everything else (including index.tsx)
  // This prevents installation failure if a file is missing
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
  );
});