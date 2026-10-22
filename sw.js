/* 262RB Rollout - offline worker.
   Bump VERSION whenever index.html changes, or phones keep the old copy. */
const VERSION = "v2";
const CACHE   = "rb262-" + VERSION;
const SHELL   = ["./", "./index.html", "./checklist.txt", "./manifest.webmanifest",
                 "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;

  // The checklist goes network-first, so an edit on GitHub reaches the
  // phone as soon as it has signal, and the cached copy covers offline.
  if (url.origin === location.origin && url.pathname.endsWith("/checklist.txt")) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // A navigation always gets the app shell, so a cold start works offline.
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("./index.html").then(hit => hit || fetch(req))
    );
    return;
  }

  // Everything else: serve from cache, fill the cache in the background.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
