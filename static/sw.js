/* RideInsight service worker.
 *
 * Deliberately conservative. This is a social app behind a login, so the
 * cardinal rule is: NEVER cache anything user-specific. A stale feed is
 * annoying; serving one user's cached page to another is a data leak. So only
 * fingerprint-free static assets are cached, everything else goes to the
 * network, and a signed-in HTML page is never stored.
 *
 * Strategies:
 *   /static/...      cache-first   (CSS, JS, icons — versioned by CACHE below)
 *   navigations      network-first, falling back to the offline page
 *   everything else  network only  (APIs, uploads, auth — never cached)
 *
 * Bump CACHE on every deploy that changes a static asset, or returning users
 * keep the old CSS and JS.
 */

const CACHE = "rideinsight-v2";

// Code is fetched network-first; media is cache-first.
//
// Cache-first on everything under /static/ meant a deployed CSS or JS change
// was invisible until CACHE was bumped by hand — and forgetting looks exactly
// like a broken feature (a screen stuck on "Loading…" because the old script
// has no such function). Images and models don't change under the same name,
// so they stay cache-first where the speed is worth it.
const CODE_ASSET = /\.(?:js|css)$/i;

// Small, stable things worth having before they are asked for. Deliberately
// excludes the .glb models — they are megabytes each and would blow the cache
// budget on a phone for a page most visitors never open.
const PRECACHE = [
    "/static/style.css",
    "/static/script.js",
    "/static/brand/icon-192.png",
    "/static/brand/icon-512.png",
    "/offline",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE)
            // addAll fails the whole install if any single file 404s, which
            // would leave the app with no worker at all. Add them individually
            // and let stragglers fail quietly.
            .then(cache => Promise.allSettled(PRECACHE.map(url => cache.add(url))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const { request } = event;

    // Only ever touch GETs from our own origin. POSTs change server state and
    // must never be replayed from a cache.
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // User uploads are private-ish and can be large — always go to network.
    if (url.pathname.startsWith("/uploads/")) return;

    if (url.pathname.startsWith("/static/")) {
        const store = (resp) => {
            if (resp && resp.ok && resp.status === 200) {
                const copy = resp.clone();
                caches.open(CACHE).then(c => c.put(request, copy));
            }
            return resp;
        };

        // JS and CSS: network first, cache only as an offline fallback. A
        // deploy is picked up on the next load instead of whenever someone
        // remembers to change the cache name.
        if (CODE_ASSET.test(url.pathname)) {
            event.respondWith(
                fetch(request).then(store).catch(() => caches.match(request))
            );
            return;
        }

        // Images, fonts, models: cache first. These are effectively immutable
        // and are the ones worth having instantly.
        event.respondWith(
            caches.match(request).then(hit => hit || fetch(request).then(store))
        );
        return;
    }

    // Page navigations: always try the network so the feed is current. If the
    // device is offline, show the offline page rather than the browser's error.
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).catch(() => caches.match("/offline"))
        );
        return;
    }

    // Everything else (APIs, JSON, auth) — network only, never cached.
});
