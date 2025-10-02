const buildTag = new URL(self.location.href).searchParams.get('build') || 'PWA-20240427';
const CACHE_PREFIX = 'muscle-app-cache';
const CACHE_NAME = `${CACHE_PREFIX}-${buildTag}`;
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  'https://cdn.tailwindcss.com?plugins=forms',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];
const OFFLINE_FALLBACK_URL = new URL('./index.html', self.registration.scope).href;

const createRequest = (asset) => {
  const url = new URL(asset, self.registration.scope).href;
  if (url.startsWith(self.location.origin)) {
    return new Request(url, { cache: 'reload' });
  }
  return new Request(url, { mode: 'no-cors' });
};

const respondFromCache = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  return cache.match(OFFLINE_FALLBACK_URL);
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(STATIC_ASSETS.map(async (asset) => {
      try {
        const request = createRequest(asset);
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) {
          await cache.put(request, response.clone());
        }
      } catch (error) {
        console.warn('[sw] cache error', asset, error);
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        const cached = await respondFromCache(request);
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    try {
      const networkResponse = await fetch(request);
      if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      const fallback = await respondFromCache(request);
      if (fallback) return fallback;
      throw error;
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
