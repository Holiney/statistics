const CACHE_NAME = 'work-stats-v1.41';

// Install Event: Cache core assets opportunistically
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Try to cache both root and index.html to cover all bases.
      // We do not abort if one fails.
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
          }
        } catch (err) {
          // Log but continue
          console.log(`[SW] Could not pre-cache ${url}`, err);
        }
      }
    })
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Robust Handling
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy 1: Navigation (HTML)
  // Network First -> Cache (Specific) -> Cache (Fallback to index.html/root)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If server returns 404 for a nav request, check cache
          if (!response || response.status === 404) {
            throw new Error("Navigate 404");
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          
          // 1. Try exact match
          const exactMatch = await cache.match(event.request);
          if (exactMatch) return exactMatch;

          // 2. Try ./index.html
          const indexHtml = await cache.match('./index.html');
          if (indexHtml) return indexHtml;

          // 3. Try ./ (root)
          const root = await cache.match('./');
          if (root) return root;

          return new Response("Offline - Page not found in cache.", { status: 404 });
        })
    );
    return;
  }

  // Strategy 2: External Dependencies (Stale-While-Revalidate)
  if (
      url.hostname === 'esm.sh' || 
      url.hostname === 'cdn.tailwindcss.com' || 
      url.hostname === 'placehold.co'
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => undefined); // Swallow network errors if background update fails
          
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy 3: Default (Cache First, fallback to Network)
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((netRes) => {
        // Optional: Cache other successful local GET requests
        if (netRes.ok && url.origin === self.location.origin && event.request.method === 'GET') {
             const clone = netRes.clone();
             caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return netRes;
      });
    })
  );
});