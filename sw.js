
const CACHE_NAME = 'badminton-pro-v10';
const ASSETS = [
  'index.html',
  'manifest.json',
  'index.tsx',
  'App.tsx',
  'types.ts',
  'utils.ts',
  'Court.tsx',
  'BookingModal.tsx',
  'BookingDetailModal.tsx',
  'ProductModal.tsx'
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
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Nếu kết quả trả về là 404 (file không tồn tại trên server)
        // và yêu cầu là trang (navigate), trả về index.html từ cache
        if (response.status === 404 && event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
        
        if (response.status === 200) {
          const cacheCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
        }
        return response;
      })
      .catch(() => {
        // Xử lý khi offline hoàn toàn
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('index.html');
        });
      })
  );
});
