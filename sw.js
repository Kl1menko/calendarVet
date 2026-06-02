const CACHE = "ultravet-v1";
const STATIC = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Supabase API — тільки мережа, не кешуємо
  if (e.request.url.includes("supabase.co")) {
    return;
  }

  // Для решти — спочатку кеш, потім мережа
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (!res || res.status !== 200 || res.type === "opaque") return res;
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, clone));
        return res;
      });
    })
  );
});
