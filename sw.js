const VERSION = 'despensa-v2';
const CORE = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/db.js',
  './js/store.js',
  './js/ui.js',
  './js/util.js',
  './js/components.js',
  './js/ocr.js',
  './js/parser.js',
  './js/views/home.js',
  './js/views/inventory.js',
  './js/views/shopping.js',
  './js/views/more.js',
  './js/sheets/product.js',
  './js/sheets/scan.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== location.origin) {
    e.respondWith(
      caches.open(VERSION + '-cdn').then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        } catch (err) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  // Red primero para el código propio (JS/CSS/HTML): así una actualización del
  // sitio se ve de inmediato en vez de servir para siempre lo que ya quedó en
  // caché. Si no hay red, cae a la copia guardada para que siga funcionando
  // offline.
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(VERSION).then((c) => c.put(req, clone));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
