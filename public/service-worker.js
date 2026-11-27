const CACHE_VERSION = 'atlas-shell-static-v2';
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL_URLS)).catch(() => undefined));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'ATLAS_ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('atlas-shell-') && key !== CACHE_VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const pathname = url.pathname;
  if (pathname.startsWith('/api/') || pathname === '/quran' || pathname.startsWith('/quran/') ||
      pathname.startsWith('/fonts/') || /quran|tajweed|recitation/i.test(pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put('/index.html', response.clone()));
      return response;
    }).catch(async () => (await caches.match('/index.html')) || Response.error()));
    return;
  }

  if (/^\/assets\/.*-[A-Za-z0-9_-]{8,}\.(?:js|css)$/i.test(pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
      return response;
    })));
    return;
  }

  if (pathname.startsWith('/assets/brand/') || pathname.startsWith('/assets/fonts/')) {
    event.respondWith(caches.match(request).then(cached => {
      const fresh = fetch(request).then(response => {
        if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
        return response;
      });
      return cached || fresh;
    }));
  }
});
