const CACHE_NAME = 'work-stats-v1.42';

// Install Event: Cache core assets opportunistically
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Critical: Cache the entry HTML AND the entry TSX/JS
      // Since we use <script type="module" src="./index.tsx">, we must cache index.tsx
      const urlsToCache = [
        './',
        './index.html',
        './manifest.json',
        './index.tsx'
      ];

      for (const url of urlsToCache) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (err) {
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
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Network First for fresh content
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            return networkResponse;
          }
          // If server returns 404/500, throw to trigger catch
          throw new Error("Bad network response");
        } catch (error) {
          // Fallback to Cache
          const cache = await caches.open(CACHE_NAME);
          
          // 1. Exact Match
          let cached = await cache.match(event.request);
          if (cached) return cached;

          // 2. index.html
          cached = await cache.match('./index.html');
          if (cached) return cached;

          // 3. root ./
          cached = await cache.match('./');
          if (cached) return cached;

          return new Response("Offline - Page not found.", { status: 404 });
        }
      })()
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
          }).catch(() => undefined);
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy 3: Local Assets (.tsx, .ts, etc) - Stale While Revalidate
  // This is critical for the "no-bundler" environment where source files are fetched at runtime.
  if (url.origin === self.location.origin) {
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

  // Strategy 4: Default fallback
  event.respondWith(fetch(event.request));
});