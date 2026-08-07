// Kardex service worker — lets the app actually open with zero
// connectivity, instead of the browser just failing outright with no
// page to show at all.
//
// Deliberately NETWORK-FIRST, not cache-first: always try the real
// network first, and only fall back to a cached copy if that fails.
// This matters a lot here specifically — there's a separate, already-
// shipped fix (vercel.json's no-cache headers) for a real bug where the
// app would keep showing a stale version until reloaded 2-3 times. A
// cache-first service worker would quietly reintroduce that same bug at
// a deeper, much harder to diagnose layer (a stuck service-worker cache
// instead of a stuck HTTP cache). Network-first avoids that entirely —
// online, you always get the latest version, exactly like today;
// offline is the only time the cached copy ever gets used.

const CACHE_NAME = 'kardex-shell-v1';
const SHELL_URLS = ['kardex.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {}) // don't let a caching hiccup block install entirely
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only ever intercept simple GETs for the app shell and its static
  // assets. Anything else — POST uploads, Supabase REST calls, ImgBB,
  // the /api/upload-image function — passes straight through untouched.
  // Those need real network semantics (auth headers, POST bodies, live
  // responses) and must never be served from a stale cache.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't touch cross-origin (CDNs, Supabase, ImgBB) at all
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Network succeeded — this is the common, online case. Mirror a
        // copy into the cache for next time we're offline, but the
        // response the page actually gets is always this fresh one.
        if (res && res.status === 200){
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        // Network failed — genuinely offline (or the request otherwise
        // couldn't complete). Fall back to whatever's cached; for a page
        // navigation specifically, fall back to the app shell itself so
        // the app at least opens, even if this exact URL was never
        // cached before.
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('kardex.html');
          return new Response('', { status: 504, statusText: 'Offline and not cached' });
        })
      )
  );
});
