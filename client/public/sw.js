const CACHE_NAME = "paperclip-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and API calls (let browser handle them)
  if (request.method !== "GET" || url.pathname.startsWith("/api")) {
    return;
  }

  // Network-first for everything — cache is only an offline fallback.
  // Never resolve to `undefined`: that throws "Failed to convert value to 'Response'".
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        if (request.mode === "navigate") {
          const page = await caches.match("/");
          return page ?? new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
        const cached = await caches.match(request);
        return cached ?? new Response("Unavailable", { status: 503, headers: { "Content-Type": "text/plain" } });
      })
  );
});
