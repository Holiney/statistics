const CACHE_NAME = 'work-stats-v1.38';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Try to cache these individually. 
      // If one fails (e.g. 404), log it but don't crash the whole SW installation.
      const urlsToCache = [
        './', 
        './index.html',
        './manifest.json'
      ];

      for (const url of urlsToCache) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
          } else {
            console.warn(`[SW] Failed to cache ${url}: ${response.status}`);
          }
        } catch (err) {
          console.warn(`[SW] Network error caching ${url}`, err);
        }
      }
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
             return caches.match('./index.html').then(r => r || caches.match('./'));
          }
          return response;
        })
        .catch(() => {
          // Network failure (offline).
          // Try to match the exact request first.
          // Fallback to index.html or root if offline.
          return caches.match(event.request)
            .then(response => response || caches.match('./index.html'))
            .then(response => response || caches.match('./'));
        })
    );
    return;
  }

  // Strategy 2: External Dependencies (esm.sh, tailwind, telegram, images) - Stale While Revalidate
  if (
      url.hostname === 'esm.sh' || 
      url.hostname === 'cdn.tailwindcss.com' || 
      url.hostname === 'telegram.org' ||
      url.hostname === 'placehold.co' // Cache the new icons
  ) {
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

  // Strategy 3: Runtime Caching for everything else
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