/**
 * Minimal Service Worker (safe default).
 * - Installs/activates immediately
 * - No aggressive caching (prevents stale assets bugs)
 *
 * Replace with a proper cache strategy when you actually need offline support.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
