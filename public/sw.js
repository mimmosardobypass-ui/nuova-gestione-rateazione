/**
 * Service Worker - Cache Prevention
 * 
 * This service worker prevents aggressive browser caching during development
 * and ensures users always get the latest version of the application.
 */

// Skip waiting and activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

// Take control of all clients immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('[SW] Service worker activated and claimed clients');
    })
  );
});

// Intercept fetch requests - always fetch from network (no caching)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before returning it
        return response.clone();
      })
      .catch((error) => {
        console.error('[SW] Fetch failed:', error);
        throw error;
      })
  );
});
