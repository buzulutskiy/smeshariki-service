// Service worker для офлайн-работы.
// data.js версионируется через ?v=N (см. index.html) — при обновлении данных бампай и там, и в ASSETS.
// index.html обновляется сам: навигация идёт network-first (свежий html онлайн, кэш — офлайн).
const CACHE = 'smesh-v5';
const ASSETS = [
  './',
  './index.html',
  './data.js?v=4',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Внешние запросы (например, синхронизация с api.github.com) не перехватываем —
  // пусть идут в сеть напрямую и падают штатно, когда сети/VPN нет.
  if (url.origin !== location.origin) return;

  // Навигация → network-first: онлайн берём свежий html и обновляем кэш,
  // офлайн/без VPN — отдаём оболочку из кэша.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Остальное: сначала кэш, иначе сеть (с дозагрузкой в кэш).
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return resp;
      });
    })
  );
});
