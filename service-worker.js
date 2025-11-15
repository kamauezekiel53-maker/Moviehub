const CACHE_NAME = 'pm-cache-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/movies.json',
  '/mockup.html',
  '/service-worker.js',
  'https://cdn.jsdelivr.net/npm/hls.js@1.4.5/dist/hls.min.js',
  // add demo MP4 to cache so playback is fast/offline after first visit:
  'https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  // network-first for API/large files? We'll use cache-first for shell, network-first for others:
  evt.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(networkRes => {
        // optionally cache GET requests
        if(req.method === 'GET' && networkRes && networkRes.status === 200){
          const cl = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, cl));
        }
        return networkRes;
      }).catch(()=> {
        // fallback: if request for html return cached index
        if(req.headers.get('accept') && req.headers.get('accept').includes('text/html')){
          return caches.match('/index.html');
        }
      });
    })
  );
});