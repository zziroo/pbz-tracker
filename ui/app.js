'use strict';
// pbz-tracker v0.4 window UI. Contract: docs/ui-api.md.
// Strict CSP: no inline scripts/styles, no style attributes. All server strings go through textContent.

(() => {
  const TOKEN = new URLSearchParams(location.search).get('t') || '';
  const TABS = ['warnings', 'journal', 'settings', 'about'];
  const HEARTBEAT_MS = 3000;

  // ---- Chrome strings (content strings come localized from the server) ----
  const I18N = {
    tr: {
      'tab.warnings': 'Uyarılar',
      'tab.journal': 'Günlük',
      'tab.settings': 'Ayarlar',
      'tab.about': 'Hakkında',
      'tabs.label': 'Bölümler',
      'lang.group': 'Arayüz dili',
      'conn.lost': 'Bağlantı koptu — pencereyi kapatıp aracı yeniden aç.',
      'conn.noToken': 'Bu sayfa erişim anahtarı olmadan açıldı. Aracı yeniden başlat.',
      'loading': 'Yükleniyor…',
      'refresh.label': 'Son yenileme: {ago}',
      'refresh.never': 'Son yenileme: —',
      'ago.now': 'az önce',
      'ago.s': '{n} sn önce',
      'ago.m': '{n} dk önce',
      'ago.h': '{n} sa önce',
      'err.openSettings': 'Ayarlar\'a git',
      'hdr.save': 'Kayıt',
      'hdr.play': 'oynama',
      'hdr.location': 'Konum',
      'warn.label': 'Uyarı',
      'info.label': 'Bilgi',
      'journal.notice': 'Spoiler içerebilir. Satıra tıklayınca o satır açılır.',
      'journal.showAll': 'Tümünü göster',
      'journal.hideAll': 'Tümünü gizle',
      'journal.confirm': 'Günlükteki tüm satırlar açılacak; spoiler içerebilir. Devam edilsin mi?',
      'journal.hidden': 'gizli, göstermek için tıkla',
      'journal.info': 'Bilgi',
      'journal.changes': 'Son okumadan beri değişenler',
      'journal.empty': 'Günlükte gösterilecek bir şey yok.',
      'journal.escHint': 'Esc: hepsini yeniden gizle',
      'set.paths': 'Oyun ve save',
      'set.game': 'Oyun klasörü',
      'set.save': 'Save dosyası',
      'set.pick': 'Seç…',
      'set.forget': 'Unut',
      'set.forgetHint': 'Yalnız kaydedilmiş bir seçim unutulabilir.',
      'set.notSet': 'ayarlı değil',
      'set.waiting': 'Seçim penceresi bekleniyor… (bu pencerenin arkasında açılmış olabilir)',
      'set.cancelled': 'Seçim iptal edildi.',
      'set.picked': 'Kaydedildi.',
      'set.pickFailed': 'Seçim yapılamadı.',
      'src.config': 'kayıtlı seçim',
      'src.auto': 'otomatik bulundu',
      'src.arg': 'komut satırından',
      'src.none': 'bulunamadı',
      'set.general': 'Genel',
      'set.uiLang': 'Arayüz dili',
      'set.names': 'Ad kaynağı',
      'set.interval': 'Yoklama aralığı (sn)',
      'set.intervalHint': '2–3600 sn. Save değişince araç zaten yeniler; bu yalnız yedek yoklama.',
      'set.intervalBad': 'Aralık 2 ile 3600 sn arasında bir tam sayı olmalı.',
      'set.saved': 'Kaydedildi.',
      'set.saveFailed': 'Kaydedilemedi.',
      'set.loadFailed': 'Ayarlar alınamadı.',
      'set.rules': 'Kurallar',
      'set.rulesSource': 'Kaynak',
      'set.rulesFile': 'Dosya',
      'set.rulesVersion': 'Sürüm',
      'rules.embedded': 'gömülü',
      'rules.sidecar': 'yanındaki dosya',
      'rules.explicit': 'belirtilen dosya',
      'set.config': 'Ayar dosyası',
      'lang.tr': 'Türkçe',
      'lang.en': 'English',
      'about.version': 'Sürüm',
      'about.tested': 'Doğrulandığı oyun build\'leri',
      'about.license': 'Lisans',
      'about.repo': 'Kaynak kod',
      'about.links': 'Bağlantılar',
      'about.linksHint': 'Bağlantılar varsayılan tarayıcında açılır.',
      'about.openFailed': 'Bağlantı açılamadı.',
      'about.loadFailed': 'Bilgiler alınamadı.',
      'about.keys': 'Kısayollar',
      'about.keysText': '1–4: sekmeler · Esc: günlüğü yeniden gizle',
      'about.readOnly': 'Salt okunur: save dosyasına, oyuna ya da yamalara hiçbir şey yazmaz.',
    },
    en: {
      'tab.warnings': 'Warnings',
      'tab.journal': 'Journal',
      'tab.settings': 'Settings',
      'tab.about': 'About',
      'tabs.label': 'Sections',
      'lang.group': 'Interface language',
      'conn.lost': 'Connection lost — close the window and start the tool again.',
      'conn.noToken': 'This page was opened without its access key. Start the tool again.',
      'loading': 'Loading…',
      'refresh.label': 'Last refresh: {ago}',
      'refresh.never': 'Last refresh: —',
      'ago.now': 'just now',
      'ago.s': '{n} s ago',
      'ago.m': '{n} min ago',
      'ago.h': '{n} h ago',
      'err.openSettings': 'Open Settings',
      'hdr.save': 'Save',
      'hdr.play': 'played',
      'hdr.location': 'Location',
      'warn.label': 'Warning',
      'info.label': 'Info',
      'journal.notice': 'May contain spoilers. Click a row to reveal it.',
      'journal.showAll': 'Show all',
      'journal.hideAll': 'Hide all',
      'journal.confirm': 'This reveals every row in the journal and may contain spoilers. Continue?',
      'journal.hidden': 'hidden, click to reveal',
      'journal.info': 'Info',
      'journal.changes': 'Changed since last read',
      'journal.empty': 'Nothing to show in the journal.',
      'journal.escHint': 'Esc: hide everything again',
      'set.paths': 'Game and save',
      'set.game': 'Game folder',
      'set.save': 'Save file',
      'set.pick': 'Choose…',
      'set.forget': 'Forget',
      'set.forgetHint': 'Only a saved choice can be forgotten.',
      'set.notSet': 'not set',
      'set.waiting': 'Waiting for the dialog… (it may have opened behind this window)',
      'set.cancelled': 'Selection cancelled.',
      'set.picked': 'Saved.',
      'set.pickFailed': 'Could not make the selection.',
      'src.config': 'saved choice',
      'src.auto': 'found automatically',
      'src.arg': 'from the command line',
      'src.none': 'not found',
      'set.general': 'General',
      'set.uiLang': 'Interface language',
      'set.names': 'Name source',
      'set.interval': 'Polling interval (s)',
      'set.intervalHint': '2–3600 s. The tool refreshes when the save changes anyway; this is only a fallback.',
      'set.intervalBad': 'The interval must be a whole number from 2 to 3600 s.',
      'set.saved': 'Saved.',
      'set.saveFailed': 'Could not save.',
      'set.loadFailed': 'Could not load the settings.',
      'set.rules': 'Rules',
      'set.rulesSource': 'Source',
      'set.rulesFile': 'File',
      'set.rulesVersion': 'Version',
      'rules.embedded': 'built-in',
      'rules.sidecar': 'file next to the app',
      'rules.explicit': 'given file',
      'set.config': 'Config file',
      'lang.tr': 'Türkçe',
      'lang.en': 'English',
      'about.version': 'Version',
      'about.tested': 'Tested game builds',
      'about.license': 'License',
      'about.repo': 'Source code',
      'about.links': 'Links',
      'about.linksHint': 'Links open in your default browser.',
      'about.openFailed': 'Could not open the link.',
      'about.loadFailed': 'Could not load this page.',
      'about.keys': 'Shortcuts',
      'about.keysText': '1–4: tabs · Esc: hide the journal again',
      'about.readOnly': 'Read-only: never writes to your save, the game or any patch.',
    },
  };

  const STATUSES = new Set(['open', 'notStarted', 'done', 'missed', 'unknown']);

  const app = {
    lang: 'en', // until the first state arrives (the server decides: English by default)
    tab: 'warnings',
    state: null,
    settings: null,
    settingsError: false,
    about: null,
    aboutLang: null,
    aboutError: false,
    aboutMsg: null,
    picking: null,          // 'game' | 'save' while the server-side dialog is open
    pickMsg: null,          // { what, kind: 'ok'|'muted'|'error', text }
    settingsMsg: null,      // { kind, text }
    sseOk: true,
    fetchOk: true,
  };

  function t(key, vars) {
    const dict = I18N[app.lang] || I18N.tr;
    let s = dict[key] !== undefined ? dict[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
    return s;
  }

  // ---- DOM helpers ----
  // h('div', { class: 'x', text: 'y', attrs: {...}, on: { click: fn } }, child, ...)
  function h(tag, opts, ...children) {
    const el = document.createElement(tag);
    if (opts) {
      if (opts.class) el.className = opts.class;
      if (opts.text !== undefined && opts.text !== null) el.textContent = String(opts.text);
      if (opts.attrs) {
        for (const [k, v] of Object.entries(opts.attrs)) {
          if (k === 'style' || v === null || v === undefined || v === false) continue;
          el.setAttribute(k, v === true ? '' : String(v));
        }
      }
      if (opts.on) for (const [ev, fn] of Object.entries(opts.on)) el.addEventListener(ev, fn);
    }
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    warn: ['M12 3 2 21h20L12 3z', 'M12 10v5', 'M12 18h.01'],
    info: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 11v6', 'M12 7.5h.01'],
    check: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M8 12.5l2.7 2.7L16.5 9.5'],
    eyeOff: ['M3 3l18 18', 'M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15.6 15.6 0 0 1-2.6 3.1', 'M6.5 7.6C4.4 9.1 3 12 3 12s4 6 9 6a8.9 8.9 0 0 0 3.9-.9', 'M9.9 10a3 3 0 0 0 4.1 4.1'],
    error: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7.5v6', 'M12 16.5h.01'],
    external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  };
  function icon(name, cls) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const d of ICONS[name] || []) {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      svg.append(p);
    }
    return svg;
  }

  const $ = (sel) => document.querySelector(sel);
  const panel = (name) => document.getElementById('panel-' + name);

  // ---- Network ----
  function setFetchOk(ok) {
    if (app.fetchOk !== ok) { app.fetchOk = ok; renderBanner(); }
  }
  function setSseOk(ok) {
    if (app.sseOk !== ok) { app.sseOk = ok; renderBanner(); }
  }

  async function api(method, path, body) {
    const headers = { 'X-PBZ-Token': TOKEN };
    const init = { method, headers, cache: 'no-store', credentials: 'same-origin' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(path, init);
    } catch (e) {
      setFetchOk(false);
      throw e;
    }
    setFetchOk(true);
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  function heartbeat() {
    api('POST', '/api/heartbeat', {}).catch(() => { /* banner handled in api() */ });
  }

  let es = null;
  function connectEvents() {
    if (es) es.close();
    es = new EventSource('/events?t=' + encodeURIComponent(TOKEN));
    es.addEventListener('open', () => setSseOk(true));
    es.addEventListener('state', (ev) => {
      setSseOk(true);
      let s;
      try { s = JSON.parse(ev.data); } catch { return; }
      applyState(s);
    });
    es.addEventListener('error', () => {
      setSseOk(false);
      // The browser retries on its own while CONNECTING; a CLOSED stream (e.g. non-200) does not, so retry here.
      if (es.readyState === EventSource.CLOSED) setTimeout(connectEvents, 3000);
    });
  }

  // ---- State ----
  function applyState(s) {
    if (!s || typeof s !== 'object') return;
    app.state = s;
    const lang = s.ui && (s.ui.lang === 'en' || s.ui.lang === 'tr') ? s.ui.lang : app.lang;
    const langChanged = lang !== app.lang;
    app.lang = lang;
    renderChrome();
    renderWarnings();
    renderJournal(); // re-creating the rows re-blurs everything
    renderRefresh();
    if (langChanged) {
      renderSettings();
      renderAbout();
      if (app.about || app.tab === 'about') loadAbout();
    }
    // Settings may have changed on the server (pick/forget/settings); refresh them unless the user is editing.
    if (app.tab === 'settings' && !isEditingSettings()) loadSettings();
  }

  function isEditingSettings() {
    const a = document.activeElement;
    return !!(a && panel('settings').contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT'));
  }

  async function loadState() {
    try { applyState(await api('GET', '/api/state')); } catch { /* SSE will deliver it */ }
  }

  async function loadSettings() {
    try {
      app.settings = await api('GET', '/api/settings');
      app.settingsError = false;
    } catch {
      app.settingsError = !app.settings;
    }
    renderSettings();
  }

  async function loadAbout() {
    const lang = app.lang;
    try {
      app.about = await api('GET', '/api/about');
      app.aboutLang = lang;
      app.aboutError = false;
    } catch {
      app.aboutError = !app.about;
    }
    renderAbout();
  }

  async function postSettings(patch) {
    try {
      const s = await api('POST', '/api/settings', patch);
      if (s && typeof s === 'object') {
        app.settings = s;
        if (s.uiLang === 'tr' || s.uiLang === 'en') {
          // Chrome switches at once; localized content follows with the pushed state.
          if (s.uiLang !== app.lang) {
            app.lang = s.uiLang;
            renderChrome();
            renderWarnings();
            renderJournal();
            renderRefresh();
            renderSettings();
            renderAbout();
            if (app.about || app.tab === 'about') loadAbout();
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  // ---- Tabs ----
  function setTab(name, focusTab) {
    if (!TABS.includes(name)) return;
    const prev = app.tab;
    if (prev === 'journal' && name !== 'journal') reblurJournal();
    if (prev === 'settings' && name !== 'settings') { app.pickMsg = null; app.settingsMsg = null; }
    app.tab = name;
    for (const btn of document.querySelectorAll('.tab')) {
      const on = btn.dataset.tab === name;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
      if (on && focusTab) btn.focus();
    }
    for (const n of TABS) panel(n).hidden = n !== name;
    if (name === 'settings' && prev !== 'settings') loadSettings();
    if (name === 'about' && (!app.about || app.aboutLang !== app.lang)) loadAbout();
    $('.content').scrollTop = 0;
  }

  // ---- Rendering: chrome ----
  function renderChrome() {
    document.documentElement.lang = app.lang;
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    $('#tablist').setAttribute('aria-label', t('tabs.label'));
    $('#lang-group').setAttribute('aria-label', t('lang.group'));
    for (const b of document.querySelectorAll('.lang-btn')) {
      b.setAttribute('aria-pressed', b.dataset.lang === app.lang ? 'true' : 'false');
      b.setAttribute('title', t('lang.' + b.dataset.lang));
    }
    renderBanner();
  }

  function renderBanner() {
    const b = $('#conn-banner');
    if (!TOKEN) {
      b.textContent = t('conn.noToken');
      b.hidden = false;
      return;
    }
    const lost = !app.sseOk || !app.fetchOk;
    b.textContent = lost ? t('conn.lost') : '';
    b.hidden = !lost;
  }

  function agoText(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 2) return t('ago.now');
    if (s < 60) return t('ago.s', { n: s });
    if (s < 3600) return t('ago.m', { n: Math.floor(s / 60) });
    return t('ago.h', { n: Math.floor(s / 3600) });
  }

  function renderRefresh() {
    const el = $('#refresh-line');
    const at = app.state && app.state.readAt ? Date.parse(app.state.readAt) : NaN;
    el.textContent = Number.isFinite(at) ? t('refresh.label', { ago: agoText(Date.now() - at) }) : t('refresh.never');
  }

  // ---- Rendering: Warnings ----
  function renderWarnings() {
    const p = panel('warnings');
    const s = app.state;
    if (!s) { p.replaceChildren(h('p', { class: 'loading', text: t('loading') })); return; }
    const out = [];

    if (s.ok === false) {
      out.push(h('div', { class: 'error-box', attrs: { role: 'alert' } },
        icon('error', 'icon-lg'),
        h('div', { class: 'error-body' },
          h('p', { class: 'error-text', text: s.error || '' }),
          h('button', { class: 'btn btn-primary', attrs: { type: 'button' }, text: t('err.openSettings'), on: { click: () => setTab('settings', true) } }))));
    }

    if (s.header) out.push(renderHeader(s.header));

    const warnings = Array.isArray(s.warnings) ? s.warnings : [];
    const info = Array.isArray(s.info) ? s.info : [];

    // Never claim "no risk" when the save could not be read.
    if (s.ok !== false && s.noRisk) {
      out.push(h('div', { class: 'norisk' }, icon('check', 'icon-xl'), h('p', { class: 'norisk-text', text: s.noRiskText || '' })));
    }

    if (warnings.length) {
      const list = h('div', { class: 'cards' });
      for (const w of warnings) {
        const items = Array.isArray(w.items) ? w.items : [];
        const ul = h('ul', { class: 'card-items' });
        for (const it of items) {
          ul.append(h('li', { class: 'card-item' },
            h('span', { class: 'item-text', text: it.text || '' }),
            it.note ? h('span', { class: 'item-note', text: it.note }) : null));
        }
        list.append(h('article', { class: 'card card-warn' },
          h('h2', { class: 'card-title' }, icon('warn'), h('span', { text: w.where || '' })),
          items.length ? ul : null));
      }
      out.push(list);
    }

    if (info.length) {
      const list = h('div', { class: 'cards cards-info' });
      for (const line of info) {
        list.append(h('div', { class: 'card card-info' }, icon('info'), h('p', { class: 'info-text', text: line })));
      }
      out.push(list);
    }

    p.replaceChildren(...out);
  }

  function renderHeader(hd) {
    const box = h('div', { class: 'header-block' });
    const first = h('p', { class: 'hdr-line' });
    if (hd.saveTime) first.append(t('hdr.save') + ' ', h('span', { class: 'mono', text: hd.saveTime }));
    if (hd.playTime) {
      if (hd.saveTime) first.append(h('span', { class: 'sep', text: ' · ' }));
      first.append(t('hdr.play') + ' ', h('span', { class: 'mono', text: hd.playTime }));
    }
    if (first.childNodes.length) box.append(first);
    if (hd.location) box.append(h('p', { class: 'hdr-line' }, t('hdr.location') + ': ', h('span', { class: 'hdr-strong', text: hd.location })));
    if (hd.build && hd.build.text) {
      box.append(h('p', { class: 'hdr-line' + (hd.build.tested === false ? ' hdr-untested' : ''), text: hd.build.text }));
    }
    for (const n of Array.isArray(hd.notices) ? hd.notices : []) box.append(h('p', { class: 'hdr-line hdr-notice', text: n }));
    return box;
  }

  // ---- Rendering: Journal ----
  function renderJournal() {
    const p = panel('journal');
    const s = app.state;
    if (!s) { p.replaceChildren(h('p', { class: 'loading', text: t('loading') })); return; }
    const j = s.journal || {};
    const sections = Array.isArray(j.sections) ? j.sections : [];
    const info = Array.isArray(j.info) ? j.info : [];
    const changes = Array.isArray(j.changes) ? j.changes : [];

    const toggleAll = h('button', { class: 'btn', attrs: { type: 'button', id: 'journal-toggle-all' }, text: t('journal.showAll'), on: { click: onToggleAll } });
    const out = [
      h('div', { class: 'journal-bar' },
        h('p', { class: 'journal-notice' }, icon('eyeOff'), h('span', { text: t('journal.notice') })),
        h('span', { class: 'journal-esc', text: t('journal.escHint') }),
        toggleAll),
    ];

    let total = 0;
    for (const sec of sections) {
      const rows = Array.isArray(sec.rows) ? sec.rows : [];
      const list = h('ul', { class: 'jrows' });
      for (const r of rows) {
        list.append(h('li', null, journalRow(r)));
        total++;
      }
      out.push(h('section', { class: 'jsection' }, h('h2', { class: 'jsection-title', text: sec.title || '' }), rows.length ? list : null));
    }
    const plain = (title, lines) => {
      const list = h('ul', { class: 'jrows' });
      for (const line of lines) { list.append(h('li', null, journalRow({ name: line }, true))); total++; }
      out.push(h('section', { class: 'jsection' }, h('h2', { class: 'jsection-title', text: title }), list));
    };
    if (info.length) plain(t('journal.info'), info);
    if (changes.length) plain(t('journal.changes'), changes);

    if (!total) out.push(h('p', { class: 'muted', text: t('journal.empty') }));
    if (j.legend) out.push(h('p', { class: 'legend', text: j.legend }));
    toggleAll.disabled = total === 0;
    p.replaceChildren(...out);
  }

  function journalRow(r, plain) {
    const text = h('span', { class: 'jtext', attrs: { 'aria-hidden': 'true' } },
      h('span', { class: 'jname', text: r.name || '' }),
      r.progress ? h('span', { class: 'jprogress mono', text: r.progress }) : null,
      r.note ? h('span', { class: 'jnote', text: r.note }) : null);
    const sr = h('span', { class: 'sr-only jhidden', text: t('journal.hidden') });
    const children = [];
    if (!plain) {
      const st = STATUSES.has(r.status) ? r.status : 'unknown';
      children.push(h('span', { class: 'badge st-' + st, text: r.statusText || st }));
    }
    children.push(text, sr);
    return h('button', {
      class: 'jrow' + (plain ? ' jrow-plain' : ''),
      attrs: { type: 'button', 'aria-pressed': 'false' },
      on: { click: (e) => setRowRevealed(e.currentTarget, !e.currentTarget.classList.contains('revealed')) },
    }, ...children);
  }

  function setRowRevealed(row, on) {
    row.classList.toggle('revealed', on);
    row.setAttribute('aria-pressed', on ? 'true' : 'false');
    const text = row.querySelector('.jtext');
    if (on) text.removeAttribute('aria-hidden'); else text.setAttribute('aria-hidden', 'true');
    const sr = row.querySelector('.jhidden');
    if (sr) sr.hidden = on;
    updateToggleAll();
  }

  function allRows() { return Array.from(panel('journal').querySelectorAll('.jrow')); }

  function updateToggleAll() {
    const btn = document.getElementById('journal-toggle-all');
    if (!btn) return;
    const rows = allRows();
    const allOpen = rows.length > 0 && rows.every((r) => r.classList.contains('revealed'));
    btn.textContent = allOpen ? t('journal.hideAll') : t('journal.showAll');
    btn.dataset.mode = allOpen ? 'hide' : 'show';
  }

  function onToggleAll(e) {
    const rows = allRows();
    if (e.currentTarget.dataset.mode === 'hide') { reblurJournal(); return; }
    if (!window.confirm(t('journal.confirm'))) return;
    for (const r of rows) setRowRevealed(r, true);
  }

  function reblurJournal() {
    for (const r of allRows()) if (r.classList.contains('revealed')) setRowRevealed(r, false);
    updateToggleAll();
  }

  // ---- Rendering: Settings ----
  function srcLabel(src) {
    return src === 'config' || src === 'auto' || src === 'arg' ? t('src.' + src) : t('src.none');
  }

  function renderSettings() {
    const p = panel('settings');
    const s = app.settings;
    if (!s) {
      p.replaceChildren(h('p', { class: app.settingsError ? 'error-inline' : 'loading', text: app.settingsError ? t('set.loadFailed') : t('loading') }));
      return;
    }
    const focusId = document.activeElement && p.contains(document.activeElement) ? document.activeElement.id : null;
    const busy = !!app.picking;

    const pathRow = (what, label, value, source) => {
      const canForget = source === 'config';
      const msg = app.pickMsg && app.pickMsg.what === what ? app.pickMsg : null;
      const waiting = app.picking === what;
      return h('div', { class: 'path-row' },
        h('div', { class: 'path-head' },
          h('span', { class: 'field-label', text: label }),
          h('span', { class: 'chip' + (source ? '' : ' chip-warn'), text: srcLabel(source) })),
        h('div', { class: 'path-value mono' + (value ? '' : ' muted'), text: value || t('set.notSet') }),
        h('div', { class: 'path-actions' },
          h('button', { class: 'btn', attrs: { type: 'button', id: 'pick-' + what, disabled: busy }, text: t('set.pick'), on: { click: () => pick(what) } }),
          h('button', { class: 'btn btn-quiet', attrs: { type: 'button', id: 'forget-' + what, disabled: busy || !canForget, title: canForget ? null : t('set.forgetHint') }, text: t('set.forget'), on: { click: () => forget(what) } })),
        waiting ? h('p', { class: 'status-line waiting', attrs: { role: 'status' } }, h('span', { class: 'spinner', attrs: { 'aria-hidden': 'true' } }), t('set.waiting')) : null,
        !waiting && msg ? h('p', { class: 'status-line ' + msg.kind, attrs: { role: 'status' }, text: msg.key ? t(msg.key) : msg.text }) : null);
    };

    const paths = h('section', { class: 'set-card' },
      h('h2', { class: 'set-title', text: t('set.paths') }),
      pathRow('game', t('set.game'), s.gameDir, s.gameDirSource),
      pathRow('save', t('set.save'), s.savePath, s.savePathSource));

    // General
    const langSel = h('select', { attrs: { id: 'set-uilang' }, on: { change: (e) => saveField({ uiLang: e.target.value }) } },
      ...['tr', 'en'].map((l) => h('option', { attrs: { value: l, selected: s.uiLang === l }, text: t('lang.' + l) })));

    const nameOpts = s.names && Array.isArray(s.names.options) ? s.names.options : [];
    const namesSel = h('select', { attrs: { id: 'set-names', disabled: nameOpts.length === 0 }, on: { change: (e) => saveField({ names: e.target.value }) } },
      ...nameOpts.map((o) => h('option', { attrs: { value: o.value, selected: s.names.current === o.value }, text: o.label })));

    const interval = h('input', {
      attrs: { id: 'set-interval', type: 'number', min: 2, max: 3600, step: 1, value: s.interval, inputmode: 'numeric', 'aria-describedby': 'set-interval-hint' },
      on: { change: onIntervalChange, keydown: (e) => { if (e.key === 'Enter') e.target.blur(); } },
    });

    const general = h('section', { class: 'set-card' },
      h('h2', { class: 'set-title', text: t('set.general') }),
      h('div', { class: 'field' }, h('label', { class: 'field-label', attrs: { for: 'set-uilang' }, text: t('set.uiLang') }), langSel),
      h('div', { class: 'field' }, h('label', { class: 'field-label', attrs: { for: 'set-names' }, text: t('set.names') }), namesSel),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', attrs: { for: 'set-interval' }, text: t('set.interval') }),
        h('div', { class: 'field-stack' }, interval, h('p', { class: 'hint', attrs: { id: 'set-interval-hint' }, text: t('set.intervalHint') }))),
      app.settingsMsg ? h('p', { class: 'status-line ' + app.settingsMsg.kind, attrs: { role: 'status' }, text: t(app.settingsMsg.key) }) : null);

    // Rules (read-only)
    const r = s.rules || {};
    const rulesSrc = ['embedded', 'sidecar', 'explicit'].includes(r.source) ? t('rules.' + r.source) : (r.source || '—');
    const rules = h('section', { class: 'set-card' },
      h('h2', { class: 'set-title', text: t('set.rules') }),
      h('dl', { class: 'kv' },
        h('dt', { text: t('set.rulesSource') }), h('dd', { text: rulesSrc }),
        r.file ? h('dt', { text: t('set.rulesFile') }) : null, r.file ? h('dd', { class: 'mono break', text: r.file }) : null,
        h('dt', { text: t('set.rulesVersion') }), h('dd', { class: 'mono', text: r.version !== undefined && r.version !== null ? String(r.version) : '—' })),
      h('p', { class: 'config-path' }, t('set.config') + ': ', h('span', { class: 'mono break', text: s.configPath || '—' })));

    p.replaceChildren(h('div', { class: 'set-grid' }, paths, general, rules));
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el && !el.disabled) el.focus();
    }
  }

  async function saveField(patch) {
    const ok = await postSettings(patch);
    app.settingsMsg = { kind: ok ? 'ok' : 'error', key: ok ? 'set.saved' : 'set.saveFailed' };
    renderSettings();
    clearSettingsMsgLater();
  }

  let settingsMsgTimer = 0;
  function clearSettingsMsgLater() {
    clearTimeout(settingsMsgTimer);
    settingsMsgTimer = setTimeout(() => { app.settingsMsg = null; if (!isEditingSettings()) renderSettings(); }, 4000);
  }

  function onIntervalChange(e) {
    const v = Number(e.target.value);
    if (!Number.isInteger(v) || v < 2 || v > 3600) {
      app.settingsMsg = { kind: 'error', key: 'set.intervalBad' };
      e.target.value = app.settings ? app.settings.interval : '';
      renderSettings();
      return;
    }
    if (app.settings && v === app.settings.interval) return;
    saveField({ interval: v });
  }

  async function pick(what) {
    if (app.picking) return;
    app.picking = what;
    app.pickMsg = null;
    renderSettings();
    let msg;
    try {
      const r = await api('POST', '/api/pick', { what });
      if (r && r.ok) msg = { what, kind: 'ok', key: 'set.picked' };
      else if (r && r.error) msg = { what, kind: 'error', text: r.error };
      else msg = { what, kind: 'muted', key: 'set.cancelled' };
    } catch {
      msg = { what, kind: 'error', key: 'set.pickFailed' };
    }
    app.picking = null;
    app.pickMsg = msg;
    await loadSettings();
    const btn = document.getElementById('pick-' + what);
    if (btn && app.tab === 'settings') btn.focus();
  }

  async function forget(what) {
    if (app.picking) return;
    try {
      const s = await api('POST', '/api/forget', { what });
      if (s && typeof s === 'object') app.settings = s;
      app.pickMsg = null;
    } catch {
      app.pickMsg = { what, kind: 'error', key: 'set.saveFailed' };
    }
    renderSettings();
  }

  // ---- Rendering: About ----
  function renderAbout() {
    const p = panel('about');
    const a = app.about;
    if (!a) {
      p.replaceChildren(h('p', { class: app.aboutError ? 'error-inline' : 'loading', text: app.aboutError ? t('about.loadFailed') : t('loading') }));
      return;
    }
    const linkBtn = (label, url) => h('button', {
      class: 'link-btn', attrs: { type: 'button', title: url },
      on: { click: () => openUrl(url) },
    }, h('span', { text: label }), icon('external', 'icon-sm'));

    const builds = Array.isArray(a.testedBuilds) ? a.testedBuilds : [];
    const links = Array.isArray(a.links) ? a.links : [];

    const facts = h('dl', { class: 'kv' },
      h('dt', { text: t('about.version') }), h('dd', { class: 'mono', text: a.version || '—' }),
      h('dt', { text: t('about.tested') }), h('dd', { class: 'mono', text: builds.length ? builds.join(', ') : '—' }),
      h('dt', { text: t('about.license') }), h('dd', { text: a.license || '—' }),
      a.repoUrl ? h('dt', { text: t('about.repo') }) : null,
      a.repoUrl ? h('dd', null, linkBtn(a.repoUrl, a.repoUrl)) : null);

    const card1 = h('section', { class: 'set-card' },
      h('h2', { class: 'set-title about-name' }, 'pbz-tracker'),
      facts,
      h('p', { class: 'about-note' }, icon('info'), h('span', { text: a.loopbackNote || '' })),
      h('p', { class: 'about-note' }, icon('check'), h('span', { text: t('about.readOnly') })));

    const linkList = h('ul', { class: 'link-list' });
    for (const l of links) if (l && l.url) linkList.append(h('li', null, linkBtn(l.label || l.url, l.url)));

    const card2 = links.length ? h('section', { class: 'set-card' },
      h('h2', { class: 'set-title', text: t('about.links') }),
      linkList,
      h('p', { class: 'hint', text: t('about.linksHint') }),
      app.aboutMsg ? h('p', { class: 'status-line error', attrs: { role: 'status' }, text: t(app.aboutMsg) }) : null) : null;

    const card3 = h('section', { class: 'set-card' },
      h('h2', { class: 'set-title', text: t('about.keys') }),
      h('p', { class: 'mono-ish', text: t('about.keysText') }));

    p.replaceChildren(h('div', { class: 'set-grid' }, card1, card2, card3));
  }

  async function openUrl(url) {
    app.aboutMsg = null;
    try {
      await api('POST', '/api/open-url', { url });
    } catch {
      app.aboutMsg = 'about.openFailed';
    }
    renderAbout();
  }

  // ---- Events ----
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (app.tab === 'journal') reblurJournal();
      return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const tg = e.target;
    const typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable);
    if (typing) return;
    if (e.key >= '1' && e.key <= '4') {
      e.preventDefault();
      setTab(TABS[Number(e.key) - 1], document.activeElement && document.activeElement.classList.contains('tab'));
    }
  }

  function onTablistKey(e) {
    const i = TABS.indexOf(app.tab);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    if (n >= 0) { e.preventDefault(); setTab(TABS[n], true); }
  }

  function init() {
    for (const btn of document.querySelectorAll('.tab')) btn.addEventListener('click', () => setTab(btn.dataset.tab, false));
    $('#tablist').addEventListener('keydown', onTablistKey);
    for (const b of document.querySelectorAll('.lang-btn')) {
      b.addEventListener('click', () => { if (b.dataset.lang !== app.lang) postSettings({ uiLang: b.dataset.lang }); });
    }
    document.addEventListener('keydown', onKeyDown);
    // Never let the app window navigate away (dropped files, stray links).
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (a) e.preventDefault();
    });

    renderChrome();
    renderWarnings();
    renderJournal();
    renderSettings();
    renderAbout();
    renderRefresh();
    if (!TOKEN) return;

    loadState();
    connectEvents();
    heartbeat();
    setInterval(heartbeat, HEARTBEAT_MS);
    setInterval(renderRefresh, 1000);
  }

  init();
})();
