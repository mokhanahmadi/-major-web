// core2 PWA Service Worker
const CACHE_NAME = 'core2-pwa-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './renderer-web.js',
  './web-shim.js',
  './libs/xlsx.full.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
].filter(Boolean);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((resp) => {
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => { try { cache.put(request, respClone);} catch(e){} });
        return resp;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
      })
    })
  );
});
