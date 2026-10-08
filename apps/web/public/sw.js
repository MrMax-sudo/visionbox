/**
 * VisionBox — Service Worker do Portal do Cliente (PWA /rastreio)
 *
 * Estratégia conservadora, pensada para leitura pública em celular:
 * - Navegações (HTML): network-first → fallback para o shell cacheado (offline = portal abre).
 *   Online o comportamento é idêntico ao sem SW (a rede sempre vence).
 * - Assets estáticos (/assets/*, manifest): cache-first com revalidação em segundo plano.
 * - API (/api/**), cross-origin e métodos não-GET: pass-through, NUNCA cacheados
 *   (nada de dado de cliente/token guardado no cache do navegador).
 *
 * Registrado apenas pelo Portal do Cliente em produção (ver src/lib/pwa.ts).
 * CACHE_VERSION: bump obrigatório ao mudar shell/manifest.
 */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `visionbox-portal-${CACHE_VERSION}`;

const SHELL = [
  '/',
  '/rastreio',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/maskable-512.png',
  '/assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Promise.allSettled: uma URL que falhar não derruba a instalação
        Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('visionbox-portal-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isApiOrCrossOrigin(url) {
  if (url.origin !== self.location.origin) return true;
  return url.pathname.startsWith('/api');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isApiOrCrossOrigin(url)) return; // pass-through: rede sempre

  // Navegações (SPA: /rastreio, /rastreio/:token) → network-first com shell offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => undefined);
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/rastreio')) || (await caches.match('/'))),
    );
    return;
  }

  // Assets estáticos → cache-first + revalidação em segundo plano
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => undefined);
      return cached || network.then((res) => res || Response.error());
    }),
  );
});
