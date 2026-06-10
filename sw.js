const CACHE_NAME = 'for-her-pwa-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/memory1.png',
  './assets/memory2.png',
  './assets/memory3.png',
  './assets/memory4.png',
  './assets/memory5.png',
  './assets/memory6.png',
  // Audio & video files (Cached so they can be loaded offline)
  './assets/bg_music.mp3',
  './assets/bgvideo.mp4',
  // External assets / CDNs
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap'
];

// Install Event - cache all specified assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell and media content...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper function to handle media range requests for offline audio/video
async function handleRangeRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  let cachedResponse = await cache.match(request.url);

  // If not found in cache, fetch it, cache it, and return the response
  if (!cachedResponse) {
    try {
      // Fetch the full resource from network without the range header to cache it in full
      const cleanRequest = new Request(request.url, { headers: {} });
      const networkResponse = await fetch(cleanRequest);
      if (networkResponse.ok) {
        await cache.put(request.url, networkResponse.clone());
        cachedResponse = networkResponse;
      } else {
        return networkResponse;
      }
    } catch (err) {
      console.error('[Service Worker] Failed to fetch and cache media resource:', err);
      return new Response('Network error and asset not cached', { status: 480 });
    }
  }

  const rangeHeader = request.headers.get('range');
  if (!rangeHeader) {
    return cachedResponse;
  }

  try {
    const buffer = await cachedResponse.arrayBuffer();
    const totalLength = buffer.byteLength;
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
    const chunksize = (end - start) + 1;

    const slicedBuffer = buffer.slice(start, end + 1);

    return new Response(slicedBuffer, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Range': `bytes ${start}-${end}/${totalLength}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': cachedResponse.headers.get('content-type') || 'application/octet-stream'
      }
    });
  } catch (err) {
    console.error('[Service Worker] Range request parsing failed:', err);
    return new Response('Internal range processing error', { status: 500 });
  }
}

// Fetch Event - intercept request and check cache
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // If it's a request with a range header (typical for video/audio elements)
  if (event.request.headers.get('range')) {
    event.respondWith(handleRangeRequest(event.request));
  } else {
    // Standard fetch strategy: Cache First, fallback to Network
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          // If it's a valid successful response, cache it dynamically
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Offline fallback can go here if needed
          return new Response('Offline content not available', { status: 503 });
        });
      })
    );
  }
});
