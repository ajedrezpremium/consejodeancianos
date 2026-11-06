const CACHE_NAME = 'cma-v3';
const PRECACHE = [
    '/',
    '/favicon.svg',
    '/manifest.webmanifest',
    '/data/posts.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Excluir llamadas dinÃ¡micas (functions, forms)
    if (url.pathname.startsWith('/.netlify/')) return;

    // Solo mismo origen + assets clave
    if (url.origin !== location.origin) return;

    // posts.json y shell: red primero, cachÃ© de respaldo (para conexiones dÃ©biles)
    event.respondWith(
        fetch(event.request)
            .then(response => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
                return response;
            })
            .catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
    );
});
