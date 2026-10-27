const CACHE_NAME = 'gestion-classe-v7.1-progression';
const ASSETS = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/app.js', './js/core/AbsenceApp.js', './js/core/database.js', './js/modules/lifecycle-profile.js', './js/modules/data-backup.js', './js/modules/ui-navigation.js', './js/modules/dashboard-search.js', './js/modules/attendance-schedule.js', './js/modules/students-classes.js', './js/modules/pedagogical-followup.js', './js/modules/progression.js', './js/modules/curriculum-data.js', './js/modules/calendar-journal.js', './js/modules/activities.js', './js/modules/statistics-history.js', './js/extensions/v47-enhancements.js', './js/extensions/v50-initialization.js', './js/extensions/v51-activity-settings.js', './js/extensions/collective-activity.js', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Navigation : réseau d'abord pour détecter rapidement une nouvelle version,
  // puis fallback hors connexion vers l'application en cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => Response.error()))
  );
});
