/* CelVerkenner 3D – service worker.
 *
 * Strategy:
 *  - the app shell (index.html, manifest, icons) is cached on install;
 *  - hashed build files under /assets/ are cached the first time they load
 *    (they never change, Vite gives them a new name instead);
 *  - navigations (/viewer/..., /vergelijk, ...) go to the network first and
 *    fall back to the cached index.html, so the app opens without internet;
 *  - API answers and Google Fonts are served from cache while a fresh copy is
 *    fetched in the background (stale-while-revalidate).
 * The frontend also carries a built-in copy of all data, so the 3D viewer
 * works offline even if no API answer was ever cached.
 */

const VERSION = 'celverkenner-v3';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const isFont = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
const isApi = (url, request) =>
  url.origin !== self.location.origin && !isFont(url) && request.headers.get('accept')?.includes('application/json');

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('/index.html', response.clone());
    return response;
  } catch {
    return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  } else if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else if (url.origin === self.location.origin && SHELL.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (isFont(url) || isApi(url, request)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
