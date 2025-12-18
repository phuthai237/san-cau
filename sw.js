
const CACHE_NAME = 'badminton-pro-final-cache';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/index.tsx',
  '/App.tsx',
  '/types.ts',
  '/utils.ts',
  '/Court.tsx',
  '/BookingModal.tsx',
  '/BookingDetailModal.tsx',
  '/ProductModal.tsx'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Xử lý yêu cầu điều hướng (mở trang)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Nếu mất mạng hoặc lỗi server, trả về index.html từ cache
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // Xử lý các tài nguyên khác (ảnh, script, css)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
        }
        return networkResponse;
      }).catch(() => {
        // Fallback cho file không tìm thấy
        if (event.request.url.endsWith('.tsx') || event.request.url.endsWith('.html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
