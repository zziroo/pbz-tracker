'use strict';
// Entry of the web version (bundled by `node build/build.js --web` into web/dist/web.js, loaded before
// ui/app.js). Installs the in-browser transport for the shared page and registers the service worker
// that keeps the page's own files available offline. No network access beyond this site's own files.
const { createTransport } = require('./transport');
const { w } = require('./strings');

window.PBZ_TRANSPORT = createTransport();

// Offline/installable: the worker caches only this site's own files (web/sw.js). Service workers need
// a secure context (https, or localhost while testing).
if ('serviceWorker' in navigator && globalThis.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).then(watchUpdates).catch(() => { /* still works without it */ });
  });
}

// The browser re-checks sw.js by itself only on navigation (and about once a day), so a tab kept open
// for hours would keep running an old build. Ask for a check when the tab becomes visible or focused and
// every 10 minutes (a request for this site's own sw.js, nothing else). A new build is never applied to
// the open page by itself (the user may be mid-interaction): a bar above the footer offers a reload.
function watchUpdates(reg) {
  const check = () => { reg.update().catch(() => { /* offline or the site is unreachable: try again later */ }); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('focus', check);
  setInterval(check, 10 * 60 * 1000);

  const notice = updateNotice();
  // A new worker reached "installed" while an old one controls the page = a new build is ready (the very
  // first install has no controller: nothing to announce).
  reg.addEventListener('updatefound', () => {
    const sw = reg.installing;
    if (!sw) return;
    sw.addEventListener('statechange', () => {
      if (sw.state === 'installed' && navigator.serviceWorker.controller) notice.show();
    });
  });
  // The new worker takes over (skipWaiting + clients.claim in sw.js) but the page still runs the old
  // files until a reload. Not on the first install (no controller before).
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) notice.show();
    hadController = true;
  });
}

// "New version ready · Reload ✕" bar, created on first use and inserted above the footer (no inline
// styles: the CSP forbids them; classes from ui/style.css). ✕ hides it until the next show().
function updateNotice() {
  let bar = null;
  let text = null;
  let reload = null;
  let close = null;
  const texts = () => {
    text.textContent = w('update.ready');
    reload.textContent = w('update.reload');
    close.setAttribute('aria-label', w('update.dismiss'));
    close.setAttribute('title', w('update.dismiss'));
  };
  const build = () => {
    bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.setAttribute('role', 'status');
    text = document.createElement('span');
    text.className = 'update-text';
    reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'btn btn-primary';
    reload.addEventListener('click', () => location.reload());
    close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-quiet update-close';
    close.textContent = '✕';
    close.addEventListener('click', () => { bar.hidden = true; });
    bar.append(text, reload, close);
    texts();
    // Follow the page's language switch (ui/app.js sets <html lang> on every chrome render).
    new MutationObserver(texts).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    const footer = document.querySelector('footer');
    if (footer) footer.before(bar); else document.body.append(bar);
  };
  return {
    show() {
      if (!bar) build(); else texts();
      bar.hidden = false;
    },
  };
}
