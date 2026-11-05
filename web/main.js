'use strict';
// Entry of the web version (bundled by `node build/build.js --web` into web/dist/web.js, loaded before
// ui/app.js). Installs the in-browser transport for the shared page and registers the service worker
// that keeps the page's own files available offline. No network access beyond this site's own files.
const { createTransport } = require('./transport');

window.PBZ_TRANSPORT = createTransport();

// Offline/installable: the worker caches only this site's own files (web/sw.js). Service workers need
// a secure context (https, or localhost while testing).
if ('serviceWorker' in navigator && globalThis.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => { /* still works without it */ });
  });
}
