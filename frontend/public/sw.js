const CACHE   = 'stock-app-v1';
const SHELL   = '/index.html';

// Hostname del backend — sus respuestas nunca se cachean
const API_HOST = 'backend-production-63370.up.railway.app';

function isApiRequest(url) {
  return url.hostname === API_HOST || url.pathname.startsWith('/auth/') ||
         url.pathname.startsWith('/bots/') || url.pathname.startsWith('/markets/');
}

// ── Install: precachea solo el shell mínimo ───────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.add(SHELL))
  );
  self.skipWaiting();
});

// ── Activate: elimina TODAS las cachés anteriores ────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first para todo ───────────────────────────────────────────
// El usuario siempre recibe la versión más reciente mientras tenga red.
// Solo se usa la caché cuando la red falla (modo offline).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Ignorar esquemas no-http (chrome-extension://, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // API → network only, sin caché
  if (isApiRequest(url)) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Guardar en caché solo respuestas válidas del mismo origen
        if (res.ok && res.type !== 'opaque' && url.origin === self.location.origin) {
          const resClone = res.clone(); // clone before body is consumed
          caches.open(CACHE).then(c => c.put(e.request, resClone).catch(() => {}));
        }
        return res;
      })
      .catch(() =>
        // Sin red → caché local; si no hay, devuelve el shell SPA
        caches.match(e.request).then(cached => cached || caches.match(SHELL))
      )
  );
});
