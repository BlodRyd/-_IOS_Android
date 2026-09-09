const C = 'recipes-v3';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'index.html', 'app.js', 'config.js', 'manifest.json', 'icon.png'])));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(names => Promise.all(names.filter(n => n !== C).map(n => caches.delete(n)))).then(() => clients.claim())
));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('data.json')) {
    e.respondWith(Promise.resolve(new Response('[]', { status: 404 })));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(n => {
    if (n.ok && e.request.method === 'GET') {
      const cp = n.clone();
      caches.open(C).then(c => c.put(e.request, cp));
    }
    return n;
  }).catch(() => r)));
});
