const VERSION = 'lily-v3';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/main.js', 'js/ui.js', 'js/store.js', 'js/services/lily-service.js', 'js/services/research-service.js', 'js/services/device-capabilities.js',
  'js/views/chat.js', 'js/views/study.js', 'js/views/organize.js', 'js/views/history.js', 'js/views/settings.js',
  'assets/lily-avatar.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // API (IA, status) nunca passa pelo cache: só arquivos estáticos ficam offline
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : undefined))
  );
});
