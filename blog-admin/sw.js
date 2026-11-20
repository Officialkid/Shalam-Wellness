/* ============================================
   SHALAM WELLNESS STUDIO — Service Worker (PWA)
   ============================================ */
const CACHE_NAME = 'shalam-blog-studio-v2';
const ASSETS = [
  '/blog-admin/',
  '/blog-admin/index.html',
  '/blog-admin/admin.css',
  '/blog-admin/admin.js',
  '/blog-admin/manifest.json',
  '/blog-config.js',
  '/image/Shalaam-wellness-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Always hit network for API calls
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
