
// Service Worker tối giản
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Cho phép ứng dụng hoạt động online bình thường
  event.respondWith(fetch(event.request));
});
