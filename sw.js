const CACHE_NAME = 'pharm-ckd-v10';
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
  // Network first for Firebase, cache first for app assets
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebase')) {
    return; // Let Firebase handle its own requests
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
