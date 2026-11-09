// Service worker: pages and data come from the network when online (and are
// saved as they load); when offline, the last saved copies are served.
// Pinned libraries and fonts from CDNs never change, so they are served from the cache first.

const CACHE = "tracker-v2";
const SHELL = [
  "./", "index.html", "browse.html", "trends.html",
  "assets/style.css", "assets/app.js", "assets/today.js", "assets/browse.js", "assets/trends.js", "assets/scene.js",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
  "data/history.csv", "data/status.json",
];
const THREE = "https://cdn.jsdelivr.net/npm/three@0.160.0/";
const LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js",
  THREE + "build/three.module.js",
  THREE + "examples/jsm/controls/OrbitControls.js",
  THREE + "examples/jsm/geometries/RoundedBoxGeometry.js",
  THREE + "examples/jsm/environments/RoomEnvironment.js",
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap",
];
const CDN_HOSTS = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Libraries are best effort: a CDN hiccup must not stop the app installing.
    await Promise.all(LIBS.map(u => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // This site: network first, fall back to the saved copy.
  event.respondWith(
    fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("index.html")))
  );
});
