'use strict';
// pbz-tracker page (web version). Contract with its backend (window.PBZ_TRANSPORT): docs/ui-api.md.
// Strict CSP: no inline scripts/styles, no style attributes. All transport strings go through textContent.

(() => {
  const TABS = ['warnings', 'journal', 'settings', 'about'];

  // ---- Chrome strings (content strings come localized from the transport) ----
  const I18N = {
    tr: {
      'tab.warnings': 'Uyarılar',
      'tab.journal': 'Günlük',
      'tab.settings': 'Ayarlar',
      'tab.about': 'Hakkında',
      'tabs.label': 'Bölümler',
      'lang.group': 'Arayüz dili',
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
      'hdr.location': 'Bölge',
      'warn.label': 'Uyarı',
      'info.label': 'Bilgi',
      'locks.title': 'Haritada açık kilitler',
      'journal.notice': 'Spoiler içerebilir. Satıra tıklayınca o satır açılır.',
      'journal.showAll': 'Tümünü göster',
      'journal.hideAll': 'Tümünü gizle',
      'journal.confirm': 'Günlükteki tüm satırlar açılacak; spoiler içerebilir. Devam edilsin mi?',
      'journal.hidden': 'gizli, göstermek için tıkla',
      'journal.detailsHidden': 'ayrıntılar gizli, göstermek için tıkla',
      'journal.info': 'Bilgi',
      'journal.changes': 'Son okumadan beri değişenler',
      'journal.empty': 'Günlükte gösterilecek bir şey yok.',
      'journal.escHint': 'Esc: hepsini yeniden gizle',
      'kind.quest': 'Görev',
      'kind.item': 'Eşya',
      'kind.accessory': 'Aksesuar',
      'kind.flower': 'Anı çiçeği yaprağı',
      'kind.chest': 'Sandık',
      'kind.weapon': 'Silah',
      'kind.info': 'İpucu',
      'set.paths': 'Oyun ve save',
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
      'src.none': 'bulunamadı',
      'set.general': 'Genel',
      'set.uiLang': 'Arayüz dili',
      'set.names': 'Ad kaynağı',
      'set.interval': 'Yoklama aralığı (sn)',
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
      'about.openFailed': 'Bağlantı açılamadı.',
      'about.loadFailed': 'Bilgiler alınamadı.',
      'about.keys': 'Kısayollar',
      'about.keysText': '1–4: sekmeler · Esc: günlüğü yeniden gizle',
      'about.readOnly': 'Salt okunur: save dosyasına, oyuna ya da yamalara hiçbir şey yazmaz.',
      'set.exact': 'Uyarılarda yer ve boss adlarını göster',
      'set.exactHint': 'Ulaştığın bölgelerde yer ve boss adlarını yazar.',
      'diag.title': 'Tanılama',
      'diag.countTitle': 'Eşleşmemiş görev sayısı',
      'diag.loadFailed': 'Tanılama bilgisi alınamadı.',
      'diag.note': 'Hata bildirimi için. Görev ve kural kimlikleri spoiler içerebilir. Rapor yol, Steam hesap kimliği ya da kullanıcı adı içermez.',
      'diag.tool': 'Araç',
      'diag.uiLang': 'Arayüz dili',
      'diag.rules': 'Kurallar',
      'diag.schema': 'biçim {v}',
      'diag.names': 'Ad tablosu',
      'diag.namesQuests': 'names.json: {n} görev',
      'diag.nameSource': 'Ad kaynağı',
      'diag.srcPatch': 'yama: {name}',
      'diag.srcTable': 'ad tablosu: {name}',
      'diag.patch': 'Metin yaması',
      'diag.none': 'yok',
      'diag.build': 'Oyun build',
      'diag.buildUnknown': 'bilinmiyor',
      'diag.tested': 'doğrulandı',
      'diag.untested': 'doğrulanmadı',
      'diag.save': 'Save',
      'diag.saveDate': 'tarih {d} · seviye {l} · harita {m} · {n} görev',
      'diag.saveNone': 'okunmadı',
      'diag.unmatched': 'Eşleşmemiş görevler ({n})',
      'diag.unmatchedHint': 'Save\'de olup ad tablosunun tanımadığı görevler (ör. oyun güncellemesiyle gelen yeni bir yan görev). Bunlara bağlı kurallar "belirsiz" görünebilir.',
      'diag.undetectable': 'Bu save\'in menzilindeki, algılanamayan kurallar ({n})',
      'diag.reason.detectFalse': 'save\'den okunamıyor',
      'diag.reason.noQuestId': 'görev kimliği bilinmiyor',
      'diag.itemsNone': 'Eşyalar: bu save\'de envanter (Inventory) yok.',
      'diag.items': 'Save\'den önceki 24 saatte alınan eşyalar ({n}, kodlar)',
      'diag.itemsHint': 'En yenisi üstte; süre, save\'in kendi saatine göre (−s:dd:ss önce). Adlar gösterilmez; bilinmeyen bir kod yeni bir eşyayı eşlemeye yarar.',
      'diag.copy': 'Raporu kopyala',
      'diag.copied': 'Kopyalandı.',
      'diag.copyFailed': 'Kopyalanamadı.',
      'diag.timeline': 'Zaman çizelgesi',
      'diag.timelineOn': 'Görev zaman çizelgesini kaydet',
      'diag.deleteTimeline': 'Zaman çizelgesini sil',
      'diag.deleteConfirm': 'Zaman çizelgesindeki bütün kayıtlar silinecek. Geri alınamaz. Devam edilsin mi?',
      'diag.deleted': 'Zaman çizelgesi silindi.',
      'diag.deleteFailed': 'Zaman çizelgesi silinemedi.',
      'diag.timelineCount': '{n} kayıt',
      'diag.timelineError': 'kaydedilemiyor ({code})',
      'diag.export': 'Zaman çizelgesini indir',
      'diag.copyTimeline': 'Zaman çizelgesini kopyala',
      'diag.exportFailed': 'Zaman çizelgesi alınamadı.',
    },
    en: {
      'tab.warnings': 'Warnings',
      'tab.journal': 'Journal',
      'tab.settings': 'Settings',
      'tab.about': 'About',
      'tabs.label': 'Sections',
      'lang.group': 'Interface language',
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
      'hdr.location': 'Area',
      'warn.label': 'Warning',
      'info.label': 'Info',
      'locks.title': 'Open map locks',
      'journal.notice': 'May contain spoilers. Click a row to reveal it.',
      'journal.showAll': 'Show all',
      'journal.hideAll': 'Hide all',
      'journal.confirm': 'This reveals every row in the journal and may contain spoilers. Continue?',
      'journal.hidden': 'hidden, click to reveal',
      'journal.detailsHidden': 'details hidden, click to reveal',
      'journal.info': 'Info',
      'journal.changes': 'Changed since last read',
      'journal.empty': 'Nothing to show in the journal.',
      'journal.escHint': 'Esc: hide everything again',
      'kind.quest': 'Quest',
      'kind.item': 'Item',
      'kind.accessory': 'Accessory',
      'kind.flower': 'Memory flower petal',
      'kind.chest': 'Chest',
      'kind.weapon': 'Weapon',
      'kind.info': 'Tip',
      'set.paths': 'Game and save',
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
      'src.none': 'not found',
      'set.general': 'General',
      'set.uiLang': 'Interface language',
      'set.names': 'Name source',
      'set.interval': 'Polling interval (s)',
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
      'about.openFailed': 'Could not open the link.',
      'about.loadFailed': 'Could not load this page.',
      'about.keys': 'Shortcuts',
      'about.keysText': '1–4: tabs · Esc: hide the journal again',
      'about.readOnly': 'Read-only: never writes to your save, the game or any patch.',
      'set.exact': 'Show place and boss names in warnings',
      'set.exactHint': 'Names places and bosses only in areas you have reached.',
      'diag.title': 'Diagnostics',
      'diag.countTitle': 'Unmatched quests',
      'diag.loadFailed': 'Could not load the diagnostics.',
      'diag.note': 'For bug reports. Quest and rule ids may contain spoilers. The report contains no paths, Steam account ids or user names.',
      'diag.tool': 'Tool',
      'diag.uiLang': 'Interface language',
      'diag.rules': 'Rules',
      'diag.schema': 'format {v}',
      'diag.names': 'Name table',
      'diag.namesQuests': 'names.json: {n} quests',
      'diag.nameSource': 'Name source',
      'diag.srcPatch': 'patch: {name}',
      'diag.srcTable': 'name table: {name}',
      'diag.patch': 'Text patch',
      'diag.none': 'none',
      'diag.build': 'Game build',
      'diag.buildUnknown': 'unknown',
      'diag.tested': 'tested',
      'diag.untested': 'not tested',
      'diag.save': 'Save',
      'diag.saveDate': 'date {d} · level {l} · map {m} · {n} quests',
      'diag.saveNone': 'not read',
      'diag.unmatched': 'Unmatched quests ({n})',
      'diag.unmatchedHint': 'Quests in your save that the name table does not know (e.g. a new side quest after a game update). Rules tied to them may show as "unknown".',
      'diag.undetectable': 'Undetectable rules in range for this save ({n})',
      'diag.reason.detectFalse': 'not readable from the save',
      'diag.reason.noQuestId': 'quest id not known',
      'diag.itemsNone': 'Items: no Inventory in this save.',
      'diag.items': 'Items acquired in the 24 h before the save ({n}, codes)',
      'diag.itemsHint': 'Newest first; the time is relative to the save\'s own clock (−h:mm:ss before). No names; an unknown code helps to map a new item.',
      'diag.copy': 'Copy report',
      'diag.copied': 'Copied.',
      'diag.copyFailed': 'Could not copy.',
      'diag.timeline': 'Timeline',
      'diag.timelineOn': 'Record the quest timeline',
      'diag.deleteTimeline': 'Delete timeline',
      'diag.deleteConfirm': 'This deletes every record of the timeline. It cannot be undone. Continue?',
      'diag.deleted': 'Timeline deleted.',
      'diag.deleteFailed': 'Could not delete the timeline.',
      'diag.timelineCount': '{n} records',
      'diag.timelineError': 'cannot be saved ({code})',
      'diag.export': 'Export timeline',
      'diag.copyTimeline': 'Copy timeline',
      'diag.exportFailed': 'Could not get the timeline.',
    },
  };

  const STATUSES = new Set(['open', 'notStarted', 'done', 'missed', 'unknown']);
  const KINDS = new Set(['quest', 'item', 'accessory', 'flower', 'chest', 'weapon', 'info']);

  const app = {
    lang: 'en', // until the first state arrives (the transport decides: English by default)
    tab: 'warnings',
    state: null,
    settings: null,
    settingsError: false,
    about: null,
    aboutLang: null,
    aboutError: false,
    aboutMsg: null,
    picking: null,          // a path row's id while the transport's picker is open
    pickMsg: null,          // { what, kind: 'ok'|'muted'|'error', text }
    settingsMsg: null,      // { kind, text }
    diag: null,             // diagnostics object (docs/ui-api.md), loaded with the settings
    diagError: false,
    diagOpen: false,        // the collapsible panel survives re-renders
    diagMsg: null,          // { kind, key }
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
    lock: ['M7 11V8a5 5 0 0 1 10 0v3', 'M5 11h14v10H5z', 'M12 15v3'],
    // Journal row kinds (what a row is about): scroll, pouch, ring, petal, chest, sword, lantern.
    quest: ['M7 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7', 'M7 4a2 2 0 0 0-2 2v10a2 2 0 0 1-2 2h4', 'M7 4v14a2 2 0 0 1-2 2', 'M10 9h6', 'M10 13h6'],
    item: ['M8 7h8l3 4v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7l3-4z', 'M9 7a3 3 0 0 1 6 0', 'M5 11h14'],
    accessory: ['M12 9a6 6 0 1 0 0 12a6 6 0 1 0 0-12z', 'M9.5 9.6 8 5.5h8l-1.5 4.1', 'M8 5.5 12 3l4 2.5'],
    flower: ['M12 21c-4-3-6-6-6-9a6 6 0 0 1 12 0c0 3-2 6-6 9z', 'M12 21V9', 'M12 13c1.5-1 3-1.2 4.5-.5', 'M12 16.5c-1.5-1-3-1.2-4.5-.5'],
    chest: ['M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z', 'M4 10a8 4 0 0 1 16 0', 'M10 13h4v3h-4z'],
    weapon: ['M14.5 4 20 9.5 10.5 19 5 13.5 14.5 4z', 'M8 16l-4 4', 'M6 11l7 7'],
    hint: ['M9 3h6', 'M12 3v2', 'M8 5h8l1.5 3-1.5 9a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3L6.5 8 8 5z', 'M9 21h6', 'M10 10c1 1 3 1 4 0'],
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

  // ---- Transport ----
  // Everything the page needs from its backend goes through one object that the web version installs as
  // window.PBZ_TRANSPORT (web/transport.js, loaded before this file). Interface: docs/ui-api.md.
  const T = window.PBZ_TRANSPORT;
  if (!T) throw new Error('pbz-tracker: window.PBZ_TRANSPORT is missing (web.js must load before app.js)');

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
    // Settings may have changed in the transport (pick/forget/settings); refresh them unless the user is editing.
    // (loadSettings also refreshes the diagnostics: unmatched quests and the timeline count follow the save.)
    if (app.tab === 'settings' && !isEditingSettings()) loadSettings();
  }

  function isEditingSettings() {
    const a = document.activeElement;
    return !!(a && panel('settings').contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT'));
  }

  async function loadState() {
    try { applyState(await T.getState()); } catch { /* subscribe() will deliver it */ }
  }

  async function loadSettings() {
    const diag = loadDiagnostics(false);
    try {
      app.settings = await T.getSettings();
      app.settingsError = false;
    } catch {
      app.settingsError = !app.settings;
    }
    await diag;
    renderSettings();
  }

  async function loadDiagnostics(render) {
    if (typeof T.getDiagnostics !== 'function') return;
    try {
      app.diag = await T.getDiagnostics();
      app.diagError = false;
    } catch {
      app.diagError = !app.diag;
    }
    if (render) renderSettings();
  }

  async function loadAbout() {
    const lang = app.lang;
    try {
      app.about = await T.getAbout();
      app.aboutLang = lang;
      app.aboutError = false;
    } catch {
      app.aboutError = !app.about;
    }
    renderAbout();
  }

  async function postSettings(patch) {
    try {
      const s = await T.postSettings(patch);
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
      // Optional: buttons offered by the transport, and a calmer "setup" look for the first-visit /
      // permission messages.
      const actions = Array.isArray(s.actions) && typeof T.action === 'function' ? s.actions : [];
      const setup = s.errorKind === 'setup' || s.errorKind === 'busy';
      const settingsBtn = h('button', { class: 'btn' + (actions.length ? '' : ' btn-primary'), attrs: { type: 'button' }, text: t('err.openSettings'), on: { click: () => setTab('settings', true) } });
      let controls = settingsBtn;
      if (actions.length) {
        controls = h('div', { class: 'error-actions' },
          ...actions.map((a) => h('button', {
            class: 'btn' + (a.primary ? ' btn-primary' : ''), attrs: { type: 'button' }, text: a.label || '',
            on: { click: () => { Promise.resolve(T.action(a.id)).catch(() => {}); } },
          })),
          settingsBtn);
      }
      out.push(h('div', { class: 'error-box' + (setup ? ' setup-box' : ''), attrs: { role: setup ? 'status' : 'alert' } },
        s.errorKind === 'busy' ? h('span', { class: 'spinner spinner-lg', attrs: { 'aria-hidden': 'true' } }) : icon(setup ? 'info' : 'error', 'icon-lg'),
        h('div', { class: 'error-body' },
          h('p', { class: 'error-text', text: s.error || '' }),
          s.errorKind === 'busy' ? null : controls)));
    }

    if (s.header) out.push(renderHeader(s.header));

    const warnings = Array.isArray(s.warnings) ? s.warnings : [];
    const info = Array.isArray(s.info) ? s.info : [];

    // Never claim "no risk" when the save could not be read.
    if (s.ok !== false && s.noRisk) {
      out.push(h('div', { class: 'norisk' }, icon('check', 'icon-xl'), h('p', { class: 'norisk-text', text: s.noRiskText || '' })));
    }

    // Per-cutoff cards and info rows; `titleTag` is h3 inside a region group (whose heading is the h2).
    const warnCards = (list, titleTag) => {
      const grid = h('div', { class: 'cards' });
      for (const w of list) {
        const items = Array.isArray(w.items) ? w.items : [];
        const ul = h('ul', { class: 'card-items' });
        for (const it of items) {
          ul.append(h('li', { class: 'card-item' },
            h('span', { class: 'item-text', text: it.text || '' }),
            it.note ? h('span', { class: 'item-note', text: it.note }) : null,
            it.hint ? h('span', { class: 'item-hint', text: it.hint }) : null));
        }
        grid.append(h('article', { class: 'card card-warn' },
          h(titleTag, { class: 'card-title' }, icon('warn'), h('span', { text: w.where || '' })),
          items.length ? ul : null));
      }
      return grid;
    };
    const infoCards = (list) => {
      const grid = h('div', { class: 'cards cards-info' });
      for (const line of list) grid.append(h('div', { class: 'card card-info' }, icon('info'), h('p', { class: 'info-text', text: line })));
      return grid;
    };

    // Grouped by game region when the transport provides it (State.groups): the region the player is in,
    // other reached regions, the "until the final bell" block (region.endgame), then one anonymous "later"
    // block. Headings come from the transport (g.title). Older transports: the flat lists.
    const groups = Array.isArray(s.groups) ? s.groups.filter((g) => g && ((Array.isArray(g.warnings) && g.warnings.length) || (Array.isArray(g.info) && g.info.length))) : [];
    if (groups.length) {
      for (const g of groups) {
        const r = g.region || {};
        const kind = r.current ? 'current' : r.reached ? 'reached' : r.endgame ? 'endgame' : 'later';
        const sec = h('section', { class: 'group group-' + kind },
          h('h2', { class: 'group-title' }, h('span', { class: 'group-dot', attrs: { 'aria-hidden': 'true' } }), h('span', { text: g.title || '' })));
        if (Array.isArray(g.warnings) && g.warnings.length) sec.append(warnCards(g.warnings, 'h3'));
        if (Array.isArray(g.info) && g.info.length) sec.append(infoCards(g.info));
        out.push(sec);
      }
    } else {
      if (warnings.length) out.push(warnCards(warnings, 'h2'));
      if (info.length) out.push(infoCards(info));
    }

    // Map locks still closed in reached regions (State.mapLocks): one small card, a line per region, texts
    // already localized by the transport. Missing (older transport) or empty → no card.
    const locks = Array.isArray(s.mapLocks) ? s.mapLocks.filter((r) => r && Array.isArray(r.items) && r.items.length) : [];
    if (locks.length) {
      const ul = h('ul', { class: 'locks-list' });
      for (const r of locks) {
        const items = r.items.map((it) => it.text || [it.type, it.need].filter(Boolean).join(' ')).join(', ');
        ul.append(h('li', { class: 'locks-row' }, h('span', { class: 'locks-region', text: r.region || '' }), h('span', { class: 'locks-items', text: items })));
      }
      out.push(h('section', { class: 'cards cards-info' },
        h('div', { class: 'card card-locks' }, icon('lock'), h('div', { class: 'locks-body' }, h('h2', { class: 'locks-title', text: t('locks.title') }), ul))));
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
    if (hd.location) box.append(h('p', { class: 'hdr-line' }, t('hdr.location') + ': ', h('span', { class: 'hdr-strong', text: hd.location }),
      hd.locationNote ? h('span', { class: 'muted', text: ' (' + hd.locationNote + ')' }) : null));
    if (hd.build && hd.build.text) {
      // build.quiet: an unknown build is not an "untested" warning.
      box.append(h('p', { class: 'hdr-line' + (hd.build.tested === false && !hd.build.quiet ? ' hdr-untested' : ''), text: hd.build.text }));
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
    const plain = (title, lines, kind) => {
      const list = h('ul', { class: 'jrows' });
      for (const line of lines) { list.append(h('li', null, journalRow({ name: line, kind }, true))); total++; }
      out.push(h('section', { class: 'jsection' }, h('h2', { class: 'jsection-title', text: title }), list));
    };
    if (info.length) plain(t('journal.info'), info, 'info');
    if (changes.length) plain(t('journal.changes'), changes, null);

    if (!total) out.push(h('p', { class: 'muted', text: t('journal.empty') }));
    if (j.legend) out.push(h('p', { class: 'legend', text: j.legend }));
    toggleAll.disabled = total === 0;
    p.replaceChildren(...out);
  }

  // Blur per row part (docs/ui-api.md): nameBlur → the whole row (badge, name + details) is blurred;
  // otherwise badge and name are readable and only the details (step counter, note) are blurred when detailBlur.
  // A field missing from an older transport counts as blurred. Plain rows (info, changes) are always blurred.
  // Every blurred part carries `.blur` and aria-hidden until the row is revealed.
  function journalRow(r, plain) {
    const nameBlur = plain || r.nameBlur !== false;
    const detailBlur = r.detailBlur !== false;
    const hasDetail = !!(r.progress || r.note);
    const detail = hasDetail
      ? h('span', { class: 'jdetail' + (!nameBlur && detailBlur ? ' blur' : '') },
        r.progress ? h('span', { class: 'jprogress mono', text: r.progress }) : null,
        r.note ? h('span', { class: 'jnote', text: r.note }) : null)
      : null;
    const text = h('span', { class: 'jtext' + (nameBlur ? ' blur' : '') },
      h('span', { class: 'jname', text: r.name || '' }), detail);
    const children = [];
    // What the row is about (docs/ui-api.md rows[].kind; info rows are 'info'): a small icon with a title, never
    // blurred (it names a kind, not the thing). Rows without a kind (changes) leave the column out.
    const kind = KINDS.has(r.kind) ? r.kind : null;
    const kindEl = kind ? h('span', { class: 'jkind jkind-' + kind, attrs: { role: 'img', 'aria-label': t('kind.' + kind), title: t('kind.' + kind) } }, icon(kind === 'info' ? 'hint' : kind)) : null;
    const blurred = nameBlur ? [text] : (detail && detailBlur ? [detail] : []);
    if (!plain) {
      // The badge belongs to the "whole row": blurred (in a neutral colour, see style.css) with the name.
      const st = STATUSES.has(r.status) ? r.status : 'unknown';
      const badge = h('span', { class: 'badge st-' + st + (nameBlur ? ' blur' : ''), text: r.statusText || st });
      if (nameBlur) blurred.push(badge);
      children.push(badge);
    }
    for (const el of blurred) el.setAttribute('aria-hidden', 'true');
    const sr = blurred.length ? h('span', { class: 'sr-only jhidden', text: t(nameBlur ? 'journal.hidden' : 'journal.detailsHidden') }) : null;
    if (kindEl) children.push(kindEl);
    children.push(text, sr);
    return h('button', {
      class: 'jrow' + (plain ? ' jrow-plain' : '') + (kind ? '' : ' jrow-nokind'),
      attrs: { type: 'button', 'aria-pressed': 'false' },
      on: { click: (e) => setRowRevealed(e.currentTarget, !e.currentTarget.classList.contains('revealed')) },
    }, ...children);
  }

  function setRowRevealed(row, on) {
    row.classList.toggle('revealed', on);
    row.setAttribute('aria-pressed', on ? 'true' : 'false');
    for (const el of row.querySelectorAll('.blur')) {
      if (on) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true');
    }
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
    return src === 'config' || src === 'auto' ? t('src.' + src) : t('src.none');
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

    // extra: { sourceText, warn, canForget } override the chip and the Forget button.
    const pathRow = (what, label, value, source, extra) => {
      const canForget = extra && extra.canForget !== undefined ? !!extra.canForget : source === 'config';
      const warn = extra && extra.warn !== undefined ? !!extra.warn : !source;
      const msg = app.pickMsg && app.pickMsg.what === what ? app.pickMsg : null;
      const waiting = app.picking === what;
      return h('div', { class: 'path-row' },
        h('div', { class: 'path-head' },
          h('span', { class: 'field-label', text: label }),
          h('span', { class: 'chip' + (warn ? ' chip-warn' : ''), text: extra && extra.sourceText ? extra.sourceText : srcLabel(source) })),
        h('div', { class: 'path-value mono' + (value ? '' : ' muted'), text: value || t('set.notSet') }),
        h('div', { class: 'path-actions' },
          h('button', { class: 'btn', attrs: { type: 'button', id: 'pick-' + what, disabled: busy }, text: t('set.pick'), on: { click: () => pick(what) } }),
          h('button', { class: 'btn btn-quiet', attrs: { type: 'button', id: 'forget-' + what, disabled: busy || !canForget, title: canForget ? null : t('set.forgetHint') }, text: t('set.forget'), on: { click: () => forget(what) } })),
        waiting ? h('p', { class: 'status-line waiting', attrs: { role: 'status' } }, h('span', { class: 'spinner', attrs: { 'aria-hidden': 'true' } }), t('set.waiting')) : null,
        !waiting && msg ? h('p', { class: 'status-line ' + msg.kind, attrs: { role: 'status' }, text: msg.key ? t(msg.key) : msg.text }) : null);
    };

    // The transport's path rows, extra selects (account, file access) and a note.
    const rows = (Array.isArray(s.paths) ? s.paths : []).map((r) => pathRow(r.what, r.label || '', r.value, r.source, r));
    const extraFields = (Array.isArray(s.extraFields) ? s.extraFields : []).map((f) => {
      const id = 'set-x-' + f.id;
      const opts = Array.isArray(f.options) ? f.options : [];
      return h('div', { class: 'field field-extra' },
        h('label', { class: 'field-label', attrs: { for: id }, text: f.label || '' }),
        h('div', { class: 'field-stack' },
          h('select', { attrs: { id, disabled: busy || opts.length < 2 }, on: { change: (e) => saveField({ [f.id]: e.target.value }) } },
            ...opts.map((o) => h('option', { attrs: { value: o.value, selected: f.value === o.value }, text: o.label }))),
          f.hint ? h('p', { class: 'hint', text: f.hint }) : null));
    });
    const paths = h('section', { class: 'set-card' },
      h('h2', { class: 'set-title', text: t('set.paths') }),
      ...rows,
      ...extraFields,
      s.pathsNote ? h('p', { class: 'hint paths-note', text: s.pathsNote }) : null);

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

    // Exact mode (off by default): place and boss names in the warnings, only for areas already reached.
    const exact = typeof s.exact === 'boolean'
      ? h('div', { class: 'field-check' }, checkRow('set-exact', t('set.exact'), t('set.exactHint'), s.exact, (v) => saveField({ exact: v })))
      : null;

    const general = h('section', { class: 'set-card' },
      h('h2', { class: 'set-title', text: t('set.general') }),
      h('div', { class: 'field' }, h('label', { class: 'field-label', attrs: { for: 'set-uilang' }, text: t('set.uiLang') }), langSel),
      h('div', { class: 'field' }, h('label', { class: 'field-label', attrs: { for: 'set-names' }, text: t('set.names') }), namesSel),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', attrs: { for: 'set-interval' }, text: t('set.interval') }),
        h('div', { class: 'field-stack' }, interval, h('p', { class: 'hint', attrs: { id: 'set-interval-hint' }, text: s.intervalHint || '' }))),
      exact,
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
      h('p', { class: 'config-path' }, (s.configLabel || t('set.config')) + ': ', h('span', { class: 'mono break', text: s.configPath || '—' })));

    p.replaceChildren(h('div', { class: 'set-grid' }, paths, general, rules), renderDiagnostics(s));
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el && !el.disabled) el.focus();
    }
  }

  // <label> with a checkbox, a label line and a hint line.
  function checkRow(id, label, hint, checked, onChange) {
    return h('label', { class: 'check-row', attrs: { for: id } },
      h('input', { attrs: { id, type: 'checkbox', checked: !!checked, 'aria-describedby': id + '-hint' }, on: { change: (e) => onChange(e.target.checked) } }),
      h('span', { class: 'check-text' },
        h('span', { class: 'check-label', text: label }),
        h('span', { class: 'hint', attrs: { id: id + '-hint' }, text: hint })));
  }

  // ---- Diagnostics (collapsible, bottom of Settings) ----
  // Seconds before the save → "-1:05:20" (same as lib/diagnostics.js fmtAgo).
  function fmtAgo(s) {
    if (typeof s !== 'number' || !isFinite(s)) return '?';
    const a = Math.abs(Math.round(s));
    return (s < 0 ? '+' : '-') + Math.floor(a / 3600) + ':' + String(Math.floor((a % 3600) / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
  }
  function renderDiagnostics(s) {
    if (typeof T.getDiagnostics !== 'function') return null;
    const d = app.diag;
    const unmatched = d && Array.isArray(d.unmatched) ? d.unmatched : [];
    const undet = d && Array.isArray(d.undetectable) ? d.undetectable : [];
    const items = d && Array.isArray(d.recentItems) ? d.recentItems : null;
    const count = h('span', { class: 'diag-count' + (unmatched.length ? ' warn' : ''), attrs: { title: t('diag.countTitle'), 'aria-label': t('diag.countTitle') + ': ' + unmatched.length }, text: d ? String(unmatched.length) : '–' });
    const summary = h('summary', { class: 'diag-summary' }, h('span', { text: t('diag.title') }), count);
    const details = h('details', { class: 'set-card diag', attrs: { id: 'diag', open: app.diagOpen } }, summary);
    details.addEventListener('toggle', () => { app.diagOpen = details.open; });
    if (!d) {
      details.append(h('div', { class: 'diag-body' }, h('p', { class: app.diagError ? 'error-inline' : 'loading', text: app.diagError ? t('diag.loadFailed') : t('loading') })));
      return details;
    }
    const str = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
    const tool = d.tool || {}, rules = d.rules || {}, names = d.names || {}, build = d.build || {}, save = d.save || {}, tl = d.timeline;
    const src = names.source === 'patch' ? t('diag.srcPatch', { name: names.sourceName })
      : names.source === 'table' ? t('diag.srcTable', { name: names.sourceName }) : '—';
    const patches = Array.isArray(d.patches) ? d.patches : [];
    const kv = h('dl', { class: 'kv' },
      h('dt', { text: t('diag.tool') }), h('dd', { class: 'mono', text: str(tool.version) + ' (' + str(tool.mode) + ')' }),
      h('dt', { text: t('diag.uiLang') }), h('dd', { class: 'mono', text: str(tool.uiLang) }),
      h('dt', { text: t('diag.rules') }), h('dd', { class: 'mono', text: str(rules.version) + ' · ' + t('diag.schema', { v: str(rules.schemaVersion) }) }),
      h('dt', { text: t('diag.names') }), h('dd', { text: t('diag.namesQuests', { n: str(names.keyMapQuests) }) + (Array.isArray(names.sidecars) && names.sidecars.length ? ' · ' + names.sidecars.join(', ') : '') }),
      h('dt', { text: t('diag.nameSource') }), h('dd', { class: 'break', text: src }),
      h('dt', { text: t('diag.patch') }), h('dd', { class: 'mono break', text: patches.length ? patches.join(', ') : t('diag.none') }),
      h('dt', { text: t('diag.build') }), h('dd', { class: 'mono', text: build.id ? build.id + ' · ' + t(build.tested ? 'diag.tested' : 'diag.untested') : t('diag.buildUnknown') }),
      h('dt', { text: t('diag.save') }), h('dd', { class: 'mono', text: save.date || save.read ? t('diag.saveDate', { d: str(save.date), l: str(save.level), m: str(save.map), n: str(save.quests) }) : t('diag.saveNone') }));

    const list = (items, fmt) => (items.length ? h('ul', { class: 'diag-list mono' }, ...items.map((x) => h('li', { text: fmt(x) }))) : h('p', { class: 'muted', text: t('diag.none') }));
    const body = h('div', { class: 'diag-body' },
      h('p', { class: 'hint', text: t('diag.note') }),
      kv,
      h('h3', { class: 'diag-sub', text: t('diag.unmatched', { n: unmatched.length }) }),
      list(unmatched, (q) => q.id + ' — ' + str(q.folder) + ' · ' + str(q.completion)),
      h('p', { class: 'hint', text: t('diag.unmatchedHint') }),
      h('h3', { class: 'diag-sub', text: t('diag.undetectable', { n: undet.length }) }),
      list(undet, (r) => r.id + ' — ' + str(r.cutoff) + ' · ' + (r.reason === 'detectFalse' || r.reason === 'noQuestId' ? t('diag.reason.' + r.reason) : str(r.reason)) + (r.status ? ' · ' + r.status : '')),
      items ? h('h3', { class: 'diag-sub', text: t('diag.items', { n: items.length }) }) : null,
      items ? list(items, (x) => x.code + '  ' + fmtAgo(x.ago)) : null,
      items ? h('p', { class: 'hint', text: t('diag.itemsHint') }) : null,
      !items && save.inventory === false ? h('p', { class: 'muted', text: t('diag.itemsNone') }) : null,
      h('div', { class: 'diag-actions' },
        h('button', { class: 'btn', attrs: { type: 'button', id: 'diag-copy' }, text: t('diag.copy'), on: { click: () => copyReport() } })));

    if (tl && typeof s.timeline === 'boolean') {
      const hasTimeline = typeof T.getTimeline === 'function';
      body.append(
        h('h3', { class: 'diag-sub', text: t('diag.timeline') }),
        checkRow('set-timeline', t('diag.timelineOn'), s.timelineHint || '', s.timeline, (v) => saveField({ timeline: v }).then(() => loadDiagnostics(true))),
        h('p', { class: 'hint mono', text: t('diag.timelineCount', { n: str(tl.count) }) + (tl.error ? ' · ' + t('diag.timelineError', { code: tl.error }) : '') }),
        hasTimeline ? h('div', { class: 'diag-actions' },
          h('button', { class: 'btn', attrs: { type: 'button', id: 'diag-export', disabled: !tl.count }, text: t('diag.export'), on: { click: () => exportTimeline() } }),
          h('button', { class: 'btn btn-quiet', attrs: { type: 'button', id: 'diag-copy-timeline', disabled: !tl.count }, text: t('diag.copyTimeline'), on: { click: () => copyTimeline() } }),
          typeof T.deleteTimeline === 'function'
            ? h('button', { class: 'btn btn-quiet', attrs: { type: 'button', id: 'diag-delete-timeline', disabled: !tl.count }, text: t('diag.deleteTimeline'), on: { click: () => deleteTimeline() } })
            : null) : null);
    }
    if (app.diagMsg) body.append(h('p', { class: 'status-line ' + app.diagMsg.kind, attrs: { role: 'status' }, text: t(app.diagMsg.key) }));
    details.append(body);
    return details;
  }

  let diagMsgTimer = 0;
  function setDiagMsg(kind, key) {
    app.diagMsg = { kind, key };
    renderSettings();
    clearTimeout(diagMsgTimer);
    diagMsgTimer = setTimeout(() => { app.diagMsg = null; if (!isEditingSettings()) renderSettings(); }, 4000);
  }

  // Clipboard: the async API (needs a secure context: https, or localhost while testing), else a hidden textarea.
  async function copyText(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') { await navigator.clipboard.writeText(text); return true; }
    } catch { /* fall back */ }
    const ta = h('textarea', { class: 'copy-buffer', attrs: { readonly: true, 'aria-hidden': 'true', tabindex: '-1' } });
    ta.value = text;
    document.body.append(ta);
    let ok = false;
    try { ta.select(); ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }

  async function copyReport() {
    await loadDiagnostics(false); // the latest read
    const text = app.diag && typeof app.diag.report === 'string' ? app.diag.report : '';
    const ok = text ? await copyText(text) : false;
    setDiagMsg(ok ? 'ok' : 'error', ok ? 'diag.copied' : 'diag.copyFailed');
  }

  async function timelineText() {
    const data = await T.getTimeline();
    return JSON.stringify(data, null, 1) + '\n';
  }

  async function exportTimeline() {
    let text;
    try { text = await timelineText(); } catch { setDiagMsg('error', 'diag.exportFailed'); return; }
    // A Blob URL and a detached <a download>: no navigation, no inline script, nothing leaves the machine.
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pbz-tracker-timeline.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Deleting is the only way to remove records; the switch above only stops recording.
  async function deleteTimeline() {
    if (!window.confirm(t('diag.deleteConfirm'))) return;
    let ok = false;
    try { const r = await T.deleteTimeline(); ok = !!(r && r.ok); } catch { ok = false; }
    await loadDiagnostics(false);
    setDiagMsg(ok ? 'ok' : 'error', ok ? 'diag.deleted' : 'diag.deleteFailed');
  }

  async function copyTimeline() {
    let text;
    try { text = await timelineText(); } catch { setDiagMsg('error', 'diag.exportFailed'); return; }
    const ok = await copyText(text);
    setDiagMsg(ok ? 'ok' : 'error', ok ? 'diag.copied' : 'diag.copyFailed');
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
      const r = await T.pick(what);
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
      const s = await T.forget(what);
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
      a.linksHint ? h('p', { class: 'hint', text: a.linksHint }) : null,
      app.aboutMsg ? h('p', { class: 'status-line error', attrs: { role: 'status' }, text: t(app.aboutMsg) }) : null) : null;

    const card3 = h('section', { class: 'set-card' },
      h('h2', { class: 'set-title', text: t('about.keys') }),
      h('p', { class: 'mono-ish', text: t('about.keysText') }));

    p.replaceChildren(h('div', { class: 'set-grid' }, card1, card2, card3));
  }

  async function openUrl(url) {
    app.aboutMsg = null;
    try {
      await T.openUrl(url);
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
    // Never let the page navigate away (dropped files, stray links).
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

    loadState();
    T.subscribe(applyState);
    setInterval(renderRefresh, 1000);
  }

  init();
})();
