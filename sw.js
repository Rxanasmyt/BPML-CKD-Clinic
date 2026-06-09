const CACHE_NAME = 'pharm-ckd-v31';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vendor/react.js',
  '/vendor/react-dom.js',
  '/vendor/babel.min.js',
  '/vendor/firebase-app-compat.js',
  '/vendor/firebase-firestore-compat.js',
  '/app/drug_db.jsx',
  '/app/herb_db.jsx',
  '/app/drp_engine.jsx',
  '/app/data.jsx',
  '/app/theme.jsx',
  '/app/tweaks-panel.jsx',
  '/app/firebase.jsx',
  '/app/settings.jsx',
  '/app/login.jsx',
  '/app/dashboard.jsx',
  '/app/patients.jsx',
  '/app/lab_trend.jsx',
  '/app/form.jsx',
  '/app/calendar.jsx',
  '/app/reports.jsx',
  '/app/app.jsx',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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
  const url = event.request.url;
  // Let Firebase handle its own requests
  if (url.includes('firestore.googleapis.com') || url.includes('firebase')) return;

  // Network-first for app code + HTML (avoids serving a stale mix of .jsx files
  // that causes a white screen during deploys). Cache-first only for vendor libs.
  const isVendor = url.includes('/vendor/');
  if (isVendor) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // Network-first: fresh app code when online, cached fallback when offline
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
      }
      return res;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});
