// service-worker.js
const CACHE_NAME = "lastation-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/menu.html",
  "/mentions-legales.html",
  "/style.css",
  "/images/logo.png",
  "/images/favicon.png"
];

// Installation du service worker et mise en cache initiale
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Mise en cache des ressources initiales");
      return cache.addAll(urlsToCache);
    })
  );
});

// Activation et nettoyage des anciens caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
});

// Interception des requêtes pour servir le cache
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return (
        response ||
        fetch(event.request).then(response => {
          // On met en cache les nouvelles ressources
          if (event.request.url.startsWith(self.location.origin)) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
      );
    })
  );
});