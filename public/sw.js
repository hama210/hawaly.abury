const CACHE_NAME = 'hawali-aburi-v9-shell';
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
  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      if (response.ok && (url.origin === self.location.origin)) caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
  );
});
