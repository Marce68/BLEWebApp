const CACHE_NAME = 'tooa-ble-v1';
const urlsToCache = [
  '/BLEWebApp/',
  '/BLEWebApp/index.html',
  '/BLEWebApp/android-chrome-192x192.png',
  '/BLEWebApp/MproBlackMatt2-removebg-preview.png'
  // Aggiungi qui altri file CSS, JS, immagini che vuoi cachare
];

// Installazione del Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
  );
});

// Attivazione e pulizia cache vecchie
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Cancello cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Intercetta le richieste di rete
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - restituisce la risposta dalla cache
        if (response) {
          return response;
        }
        
        // Clona la richiesta
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(response => {
          // Controlla se la risposta è valida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clona la risposta
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});
