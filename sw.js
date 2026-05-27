const CARD_CORTEX_CACHE = "cardcortex-shell-v27-cortex-universe";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./vault.html",
  "./scanner.html",
  "./pricing.html",
  "./reports.html",
  "./upgrade.html",
  "./grading.html",
  "./marketplace.html",
  "./assistant.html",
  "./auth.html",
  "./styles.css",
  "./data.js",
  "./billing.js",
  "./supabase-config.js",
  "./supabase-client.js",
  "./app.js",
  "./auth.js",
  "./brand3d.js",
  "./hero3d.js",
  "./page3d.js",
  "./app-icon.svg",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CARD_CORTEX_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CARD_CORTEX_CACHE).map((key) => caches.delete(key))))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CARD_CORTEX_CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match("./index.html")))
  );
});
