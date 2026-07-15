const CACHE_NAME = 'hawali-aburi-v12-fast-news';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];

function shouldBypass(request, url) {
  return request.method !== 'GET'
    || url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/src/')
    || url.pathname.startsWith('/@vite')
    || url.pathname.includes('/node_modules/')
    || url.hostname === 'localhost'
    || url.hostname === '127.0.0.1';
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (shouldBypass(event.request, url)) return;

  const network = fetch(event.request).then(async response => {
    if (response.ok && url.origin === self.location.origin) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, response.clone());
    }
    return response;
  }).catch(() => null);

  event.waitUntil(network.then(() => undefined));
  event.respondWith(
    caches.match(event.request).then(cached => cached || network.then(response => response || caches.match('/')))
  );
});
