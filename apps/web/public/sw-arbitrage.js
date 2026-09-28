/* Service worker de l'arbitrage hors ligne : page et ressources statiques mises en cache.
   Portée limitée à /arbitrage/ (et /en/arbitrage/). Aucune donnée personnelle n'est mise en cache ici :
   les appariements sont stockés par la page dans IndexedDB. */
const CACHE = "chesspirit-arbitrage-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Ressources statiques versionnées : cache d'abord.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/")) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  // Page d'arbitrage : réseau d'abord, copie en cache pour le mode hors ligne.
  if (req.mode === "navigate" && /^\/(en\/)?arbitrage\//.test(url.pathname)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error())),
    );
  }
});
