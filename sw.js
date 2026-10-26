/* KlemmmosaikBase Service Worker: App offline verfügbar machen.
   Bei Änderungen an Dateien VERSION hochzählen, damit Geräte die neue Fassung laden. */
const VERSION = "kmb-1.2.1";
const EXTRA = "kmb-extern"; // Schriften
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/palette.js", "js/availability.js", "js/shapes.js", "js/mosaic.js", "js/store.js", "js/projects.js", "js/install.js", "js/render.js", "js/export.js", "js/app.js", "js/vendor/jspdf.umd.min.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== EXTRA).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const ext = ["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname);
  if (ext) {
    e.respondWith(caches.open(EXTRA).then(async (c) => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then((r) => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((m) => m || caches.match("index.html")))
  );
});
