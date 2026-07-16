const CACHE_NAME = 'hawali-aburi-v16-translation';
// Never precache the HTML document. A cached index can keep pointing at an
// old JavaScript bundle after a new Cloudflare Pages deployment.
const APP_SHELL = ['/manifest.webmanifest', '/hawali-logo-96.webp', '/hawali-logo-192.png'];

function shouldBypass(request, url) {
  return request.method !== 'GET'
    || request.mode === 'navigate'
    || request.destination === 'document'
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
    caches.match(event.request).then(cached => cached || network.then(response => response || new Response('Offline', { status: 503 })))
  );
});
