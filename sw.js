
const CACHE_NAME = "pairhi-cache-v2";

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Do not intercept Supabase or other external websites.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);

        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;

      } catch (error) {
        const cached = await caches.match(request);

        if (cached) return cached;

        if (request.mode === "navigate") {
          const homePage = await caches.match("./index.html");
          if (homePage) return homePage;
        }

        throw error;
      }
    })()
  );
});
