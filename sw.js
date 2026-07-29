/* 小圆助手 Service Worker —— 离线缓存 + 可安装到主屏 */
const CACHE = 'xiaoyuan-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/db.js',
  './js/store.js',
  './js/chart.js',
  './js/icons.js',
  './js/home.js',
  './js/weight.js',
  './js/period.js',
  './js/bjd.js',
  './js/app.js',
  './assets/favicon-64.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png'
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
  if (url.origin !== self.location.origin) return; // 只处理同源（照片在 IndexedDB，不涉及网络）

  if (req.mode === 'navigate') {
    // 页面导航：网络优先，离线时回退到缓存的 index.html
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  // 静态资源：缓存优先，缺失则网络拉取并写入缓存
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => hit)
    )
  );
});
