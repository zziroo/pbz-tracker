'use strict';
// Service worker of the pbz-tracker web version (template; build/build.js fills in the version, a hash
// of the built files and the file list). Caches only the site's own files, so the page also works
// offline and can be installed. It never touches other requests and makes no request to any other origin.
// A new build (new hash) changes this file, so the browser installs the new worker, which replaces the
// old cache; the page then uses the new files from its next load.
const VERSION = '__PBZ_VERSION__';
const BUILD = '__PBZ_BUILD__';
const FILES = __PBZ_FILES__;
const CACHE = `pbz-tracker-${VERSION}-${BUILD}`;
const scopeUrl = new URL(self.registration.scope);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(FILES.map((f) => new Request(new URL(f, scopeUrl).href, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pbz-tracker-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;
  let rel = url.pathname.slice(scopeUrl.pathname.length);
  if (rel === '') rel = 'index.html';
  if (!FILES.includes(rel)) return; // not one of ours: the browser handles it as usual
  const key = new URL(rel, scopeUrl).href;
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(key).then((hit) => hit || fetch(req))));
});
