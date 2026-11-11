
const VERSION = 'lily-static-v1';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/lily-avatar.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable-512.png'
];

// Instalação e armazenamento inicial do aplicativo.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);

    let html = '';

    try {
      const response = await fetch('/', { cache: 'reload' });

      if (response.ok) {
        await cache.put('/', response.clone());
        await cache.put('/index.html', response.clone());
        html = await response.text();
      }
    } catch (error) {
      console.error('[LILY] Falha ao carregar o aplicativo:', error);
    }

    // Descobre os arquivos JS e CSS gerados pelo Vite.
    const references = [
      ...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)
    ].map(match => match[1]);

    const urls = new Set(SHELL);

    for (const reference of references) {
      try {
        const url = new URL(reference, self.registration.scope);

        if (
          url.origin === self.location.origin &&
          !url.pathname.startsWith('/api/') &&
          url.pathname !== '/sw.js'
        ) {
          urls.add(url.pathname);
        }
      } catch {
        // Ignora endereços inválidos.
      }
    }

    // Armazena os arquivos encontrados.
    for (const path of urls) {
      try {
        const response = await fetch(path);

        if (response.ok) {
          await cache.put(path, response);
        }
      } catch {
        console.warn('[LILY] Arquivo não armazenado:', path);
      }
    }

    await self.skipWaiting();
  })());
});

// Ativação sem apagar caches de modelos de IA.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key =>
            key.startsWith('lily-static-') &&
            key !== VERSION
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Estratégia de cache.
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Não intercepta APIs nem requisições externas.
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/sw.js'
  ) {
    return;
  }

  // Navegação: tenta a rede e usa o aplicativo salvo
  // quando não existe conexão.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(VERSION);
          await cache.put(request, response.clone());

          if (url.pathname === '/') {
            await cache.put('/index.html', response.clone());
          }
        }

        return response;
      } catch {
        return (
          await caches.match(request, { ignoreSearch: true }) ||
          await caches.match('/') ||
          await caches.match('/index.html')
        );
      }
    })());

    return;
  }

  // Arquivos estáticos: cache primeiro, rede depois.
  event.respondWith((async () => {
    const cached = await caches.match(request, {
      ignoreSearch: true
    });

    if (cached) return cached;

    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(VERSION);
      await cache.put(request, response.clone());
    }

    return response;
  })());
});
