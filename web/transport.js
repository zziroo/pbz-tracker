'use strict';
// The web version's backend: implements the page transport of docs/ui-api.md (ui/app.js) entirely in
// the browser, on the same engine as the local tool (lib/core + the pure report modules). Mirrors
// lib/session.js (resolve inputs → key → names → evaluate/diff), lib/watch.js (re-read on change,
// retry a mid-write file) and lib/server.js (settings, about, link allow-list).
//
// Inputs ("slots"), each chosen in Settings, by a setup button or by drag and drop:
//   game  folder handle: the game folder or a Steam library (→ exe, Paks, saves, build id)
//   save  PBZSaveGame.sav: handle (polled) or File (read once)
//   exe   PBZ.exe: handle or File (only to derive the key; read in chunks, never whole)
//   paks  Paks folder handle, or the .pak Files of a folder input (text patches → names)
//   steam Steam library / steamapps handle (appmanifest → game build id)
// Handles are remembered in IndexedDB (web/store.js) and need a read permission once per visit (a
// "Continue with …" button: the prompt needs a click). Files are for this visit only.
// Strictly read-only: handles are opened with mode 'read' and only getFile()/listing is used.
// The quest timeline (lib/timeline.js) is kept in IndexedDB too (key 'timeline'), never in a file.
// No network: nothing here calls fetch, XHR, WebSocket or sendBeacon.
const core = require('../lib/core');
const i18n = require('../lib/i18n');
const { t } = i18n;
const { extract } = require('../lib/state');
const { build, statusMap, diff } = require('../lib/report');
const { toState } = require('../lib/viewmodel');
const { VERSION, TESTED_BUILDS, REPO_URL, LICENSE } = require('../lib/version');
const { LINKS, allowedUrls } = require('../lib/links');
const { validateRules, SCHEMA_VERSION } = require('../lib/rules-schema');
const { createTimeline, exportTimeline } = require('../lib/timeline');
const { collectDiagnostics, formatDiagnostics } = require('../lib/diagnostics');
const NAMES = require('../data/names.json');
const store = require('./store');
const gamefs = require('./gamefs');
const pickers = require('./pickers');
const { w } = require('./strings');

const RULES = validateRules(require('../data/rules.json'), 'data/rules.json');
const DATA_INFO = { rules: { source: 'embedded', file: null, rules: RULES }, nameFiles: [] };
const ALLOWED_URLS = allowedUrls(REPO_URL);
const SLOTS = ['game', 'save', 'exe', 'paks', 'steam'];
const RETRIES = 6;          // same as lib/savefile.js loadSave()
const RETRY_MS = 750;
const DEFAULT_INTERVAL = 3; // seconds; the web version polls (no file-change events)
const CANCELLED = { ok: false, path: null, error: null };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clampInterval = (v) => Math.min(3600, Math.max(2, Math.round(v)));
const isLang = (v) => v === 'tr' || v === 'en';
const sigOf = (f) => `${f.lastModified}:${f.size}`;
const endsWith = (name, ext) => String(name || '').toLowerCase().endsWith(ext);

function createTransport() {
  let cfg = {};                 // persisted settings: uiLang?, names?, interval?, mode?, account?, exact?, timeline?
  const slots = {};             // what → { kind: 'handle'|'file'|'files', handle?, file?, files?, name, how, persisted }
  let ctx = {};                 // what the last load resolved (for Settings)
  let names = null, gameBuild = null, patches = [];
  let view = null, readAt = null, ok = false, error = null, errorKind = 'busy', actions = [];
  let before = null, last = null; // status maps for "changed since the previous read"
  let watch = null;
  let gen = 0;
  let queue = Promise.resolve();
  let pending = null;           // slot waiting for a permission prompt ("Continue with …")
  const listeners = new Set();
  let current = null;
  // Quest timeline in this browser's storage. store.set() keeps the value in memory when IndexedDB
  // refuses it; that is reported as an error code in the diagnostics (never thrown into the read).
  const timeline = createTimeline({
    load: () => store.get('timeline'),
    remove: () => store.del('timeline'),
    save: async (d) => { if (!(await store.set('timeline', d))) { const e = new Error('not stored'); e.name = 'NotStored'; throw e; } },
  });
  const timelineOn = () => cfg.timeline !== false;

  const mode = () => (pickers.hasFsAccess() && cfg.mode !== 'files' ? 'fs' : 'files');
  const interval = () => (Number.isFinite(cfg.interval) ? clampInterval(cfg.interval) : DEFAULT_INTERVAL);
  const use = (what) => {
    const s = slots[what];
    if (!s) return null;
    if (s.kind === 'handle' && mode() !== 'fs') return null;
    return s;
  };

  // ---- state ----
  function push() {
    const s = toState({ ok, error, readAt, view });
    if (!ok) { s.errorKind = errorKind; s.actions = actions; }
    // No Steam manifest is normal here (the library is outside the chosen folder): say how to add it,
    // without the "untested" look.
    if (s.header && !s.header.build.id) s.header.build = { ...s.header.build, text: w('buildUnknown'), quiet: true };
    current = s;
    for (const fn of listeners) { try { fn(s); } catch { /* page error: keep the others */ } }
  }
  const setup = (text, acts = [], kind = 'setup') => { ok = false; error = text; errorKind = kind; actions = acts; push(); };
  const busy = (text) => setup(text, [], 'busy');
  const fail = (text) => setup(text, [], null);
  const withSettingsHint = (msg) => `${msg}${/[.!?]$/.test(msg) ? '' : '.'} ${t('ui.useSettings')}`;

  function startActions() {
    if (mode() === 'fs') {
      return [{ id: 'pickGame', label: w('act.pickGame'), primary: true }, { id: 'useFiles', label: w('act.pickFiles') }];
    }
    return [{ id: 'pickSave', label: w('act.pickSave'), primary: true }, { id: 'pickExe', label: w('act.pickExe') }];
  }

  // ---- inputs ----
  async function permission(handle) {
    if (typeof handle.queryPermission !== 'function') return 'granted';
    try { return await handle.queryPermission({ mode: 'read' }); } catch { return 'prompt'; }
  }

  async function getFileT(handle) {
    try { return await handle.getFile(); } catch (e) {
      // Replaced or locked while the game writes it: retry like ENOENT/EBUSY in lib/savefile.js.
      if (['NotFoundError', 'NotReadableError', 'InvalidStateError', 'NoModificationAllowedError'].includes(e.name)) {
        throw new core.TransientError(t('err.saveBusy', { code: e.name }));
      }
      throw e;
    }
  }

  // Text patches: listPaks/openReader over a directory handle or over .pak Files.
  function paksFromDir(dir) {
    const handles = new Map();
    return {
      list: async () => {
        const out = [];
        for await (const h of dir.values()) if (h.kind === 'file') { handles.set(h.name, h); out.push(h.name); }
        return out;
      },
      open: async (name) => core.readers.fromBlob(await handles.get(name).getFile(), name),
    };
  }
  function paksFromFiles(files) {
    const byName = new Map(files.map((f) => [f.name, f]));
    return { list: () => [...byName.keys()], open: (name) => core.readers.fromBlob(byName.get(name), name) };
  }

  async function keyFor(exeFile, my) {
    const cached = await store.get('key');
    if (exeFile) {
      const id = `${exeFile.size}:${exeFile.lastModified}`;
      if (cached && cached.id === id && cached.key) return { key: cached.key, remembered: false };
      busy(w('busy.key'));
      const key = await core.deriveKeyFromReader(core.readers.fromBlob(exeFile, exeFile.name), { label: exeFile.name });
      if (my === gen) await store.set('key', { id, key });
      return { key, remembered: false };
    }
    if (cached && cached.key) return { key: cached.key, remembered: true };
    return null;
  }

  function makeNames() {
    const n = core.createNamesFrom({ patches, uiLang: i18n.getLang(), names: cfg.names || undefined, tables: core.EMBEDDED_TABLES });
    return {
      source: n.source,
      quest: (id) => n.quest(id),
      region: (code) => (code ? n.region(code) : null),
      missable: (id) => n.missable(id),
      known: (id) => !!NAMES.quests?.[id],
      get notice() { return n.notice; },
    };
  }

  // build() + change list; again=true re-evaluates the same read (new language / names) without
  // advancing the "previous read" (lib/session.js evaluate()).
  function evaluate(st, { again = false } = {}) {
    const result = build(st, RULES, names, { exact: cfg.exact === true });
    const now = statusMap(result);
    if (!again) before = last;
    last = now;
    return { result, changes: diff(before, now) };
  }

  // ---- reading the save (lib/savefile.js + lib/watch.js) ----
  async function snapshot(src) {
    const f1 = src.file || await getFileT(src.handle);
    let buf;
    try { buf = new Uint8Array(await f1.arrayBuffer()); } catch (e) {
      if (!src.handle) throw e; // a File from an input/drop that changed on disk cannot be read again
      throw new core.TransientError(t('err.saveBusy', { code: e.name || 'read' }));
    }
    if (src.handle) {
      const f2 = await getFileT(src.handle);
      if (sigOf(f1) !== sigOf(f2) || buf.length !== f2.size) throw new core.TransientError(t('err.saveChanged'));
    }
    return { buf, sig: sigOf(f1) };
  }

  async function readSave(src, key) {
    let lastErr;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        const { buf, sig } = await snapshot(src);
        const { latest } = await core.decodeSave(buf, key);
        return { sig, latest };
      } catch (e) {
        lastErr = e;
        if (!(e instanceof core.TransientError) || attempt === RETRIES || !src.handle) break;
        await sleep(RETRY_MS);
      }
    }
    throw lastErr;
  }

  function stopWatch() {
    if (watch) { clearInterval(watch.timer); watch.closed = true; watch = null; }
  }

  function startWatch(my, src, key, rememberedKey) {
    let have = false, lastSig = '', reading = false, again = false;
    const sigNow = async () => { try { return sigOf(await src.handle.getFile()); } catch { return ''; } };
    const onRead = async (r) => {
      const st = extract(r.latest.data);
      const { result, changes } = evaluate(st);
      if (timelineOn()) await timeline.record(st); // never rejects
      if (my !== gen) return;
      view = { st, result, changes, names, build: gameBuild, data: DATA_INFO };
      readAt = new Date().toISOString(); ok = true; error = null; errorKind = null; actions = [];
      push();
    };
    const onError = (e) => {
      let msg = src.handle ? t('ui.readFail', { msg: e.message }) : w('readFailFiles', { msg: e.message });
      if (rememberedKey && e instanceof core.TransientError) msg += ` ${w('keyStale')}`;
      ok = false; error = msg; errorKind = null; actions = [];
      push();
    };
    const refresh = async (force) => {
      if (my !== gen || (w8.closed)) return;
      if (reading) { again = true; return; }
      const sig = src.handle ? await sigNow() : '';
      if (!force && have && sig === lastSig) return; // already showing these bytes
      reading = true;
      try {
        const r = await readSave(src, key);
        if (my !== gen) return;
        have = true;
        lastSig = r.sig;          // signature of the bytes actually decoded
        await onRead(r);
      } catch (e) {
        lastSig = sig;            // retry only when the file changes again
        if (my === gen && e && e.name === 'NotAllowedError' && src.handle) {
          // Read access was revoked: polling cannot recover on its own; ask for it again (needs a click).
          stopWatch();
          pending = src;
          setup(w('resume', { name: src.handle.name }), [
            { id: 'resume', label: w('act.resume', { name: src.handle.name }), primary: true },
            { id: 'useFiles', label: w('act.pickFiles') },
          ]);
        } else if (my === gen) onError(e);
      } finally {
        reading = false;
        if (again && my === gen) { again = false; refresh(false); }
      }
    };
    const w8 = { closed: false, src, refresh, timer: null, setInterval(sec) { clearInterval(this.timer); this.timer = src.handle ? setInterval(() => refresh(false), sec * 1000) : null; } };
    watch = w8;
    w8.setInterval(interval());
    return refresh(true);
  }

  // ---- load: resolve inputs → key → names → first read → watch (lib/session.js createSession) ----
  async function load() {
    const my = ++gen;
    stopWatch();
    view = null; readAt = null; before = null; last = null; pending = null; names = null;
    ctx = { mode: mode() };
    const stale = () => my !== gen;
    try {
      // 1. Remembered handles need the read permission again on a new visit (prompt = needs a click).
      for (const what of SLOTS) {
        const s = use(what);
        if (!s || s.kind !== 'handle') continue;
        if (await permission(s.handle) !== 'granted') {
          if (stale()) return;
          pending = s;
          ctx.waiting = what;
          setup(w('resume', { name: s.handle.name }), [
            { id: 'resume', label: w('act.resume', { name: s.handle.name }), primary: true },
            ...(what === 'game' ? [{ id: 'pickGame', label: w('act.otherFolder') }] : []),
          ]);
          return;
        }
      }
      if (stale()) return;

      // 2. Game folder (or a Steam library containing it).
      let game = null, info = null;
      const gs = use('game');
      if (gs) {
        busy(w('busy.load'));
        info = await gamefs.resolveGame(gs.handle);
        if (stale()) return;
        if (!info) { fail(withSettingsHint(w('notGame', { name: gs.handle.name }))); return; }
        game = info.game;
        ctx.game = game;
        ctx.gameLabel = info.apps
          ? [gs.handle.name, ...(info.apps !== gs.handle ? [info.apps.name] : []), 'common', game.name].join(' › ')
          : game.name;
      }

      // 3. PBZ.exe (explicit, else from the game folder).
      let exeFile = null;
      const es = use('exe');
      if (es) { exeFile = es.kind === 'file' ? es.file : await es.handle.getFile(); ctx.exeFrom = es.how; }
      else if (game) {
        const h = await gamefs.findExe(game);
        if (h) { exeFile = await h.getFile(); ctx.exeFrom = 'game'; }
      }
      if (exeFile) ctx.exeLabel = `${exeFile.name} · ${(exeFile.size / 1048576).toFixed(0)} MB`;

      // 4. Text patches (Paks folder) → automatic language, name choices.
      let paks = null;
      const ps = use('paks');
      if (ps) { paks = ps.kind === 'files' ? paksFromFiles(ps.files) : paksFromDir(ps.handle); ctx.paksFrom = ps.how; ctx.paksLabel = ps.name; }
      else if (game) {
        const d = await gamefs.paksDir(game);
        if (d) { paks = paksFromDir(d); ctx.paksFrom = 'game'; ctx.paksLabel = ['ProjectPBZ', 'Content', d.name].join(' › '); }
      }
      patches = paks ? await core.findTextPatchesFrom(paks.list, paks.open) : [];
      if (stale()) return;
      ctx.patches = patches.map((p) => p.name);
      // Default English; Turkish automatically only when the browser is Turkish AND a Turkish patch
      // was found, unless the language was chosen (lib/i18n.js applyAutoLang).
      if (!isLang(cfg.uiLang) && patches.some((p) => core.looksTurkish(p.map)) && /^tr\b/i.test(globalThis.navigator?.language || '')) i18n.setLang('tr');

      // 5. Save: explicit, else the newest (or chosen) account folder of the game.
      let src = null;
      const ss = use('save');
      if (ss) { src = ss.kind === 'file' ? { file: ss.file } : { handle: ss.handle }; ctx.saveFrom = ss.how; ctx.saveLabel = ss.name; }
      else if (game) {
        const accounts = await gamefs.saveCandidates(game);
        ctx.accounts = accounts.map((a) => ({ id: a.id, lastModified: a.lastModified }));
        const a = accounts.find((c) => c.id === cfg.account) || accounts[0];
        if (a) {
          src = { handle: a.handle };
          ctx.saveFrom = 'game';
          ctx.account = a.id;
          ctx.saveLabel = ['SaveGames', a.platform, a.id, a.handle.name].join(' › ');
        }
      }
      if (stale()) return;

      // 6. Game build: a chosen Steam library, else the library the game folder was found in.
      let buildId = info?.buildId || null;
      if (info?.buildId) ctx.steamFrom = 'library';
      const st = use('steam');
      if (st) {
        const m = await gamefs.readManifest(st.handle);
        if (m?.buildId) buildId = m.buildId;
        ctx.steamFrom = st.how;
      }
      ctx.buildId = buildId;
      gameBuild = { id: buildId, tested: !!buildId && TESTED_BUILDS.includes(buildId) };

      // 7. Something missing?
      const cachedKey = await store.get('key');
      ctx.keyCached = !!(cachedKey && cachedKey.key);
      if (stale()) return;
      if (!exeFile && !ctx.keyCached && !src) { setup(w(mode() === 'fs' ? 'start.fs' : 'start.files'), startActions()); return; }
      if (!src) {
        if (game) { fail(withSettingsHint(t('err.noSave', { p: `${game.name}\\ProjectPBZ\\Saved\\SaveGames\\Steam` }))); return; }
        setup(w('need.save'), [{ id: 'pickSave', label: w('act.pickSave'), primary: true }]);
        return;
      }
      if (!exeFile && !ctx.keyCached) {
        if (game) { fail(withSettingsHint(t('err.noExe', { p: `${game.name}\\platform\\steam\\PBZ.exe` }))); return; }
        setup(w('need.exe'), [{ id: 'pickExe', label: w('act.pickExe'), primary: true }]);
        return;
      }

      // 8. Key (cached in this browser by the exe's size + date).
      let k;
      try {
        k = await keyFor(exeFile, my);
      } catch (e) {
        if (!stale()) fail(`${e.message} ${t('err.keyBuild', { build: buildId || '?', tested: TESTED_BUILDS.join(', ') })}`);
        return;
      }
      if (stale()) return;
      ctx.keyRemembered = k.remembered;
      ctx.keyCached = true;

      // 9. Names, first read, then watch.
      names = makeNames();
      if (!view) busy(w('busy.read'));
      await startWatch(my, src, k.key, k.remembered);
    } catch (e) {
      if (!stale()) fail(withSettingsHint(e && e.message ? e.message : String(e)));
    }
  }
  const reload = () => (queue = queue.then(load, load));

  // Language / name source changed: rebuild the texts from the last decoded save (no re-read).
  async function relocalize() {
    if (!view || !names) return load(); // a setup or error text in the old language: start over (key is cached)
    names = makeNames();
    const { result, changes } = evaluate(view.st, { again: true });
    view = { ...view, result, changes, names };
    if (!ok && watch) watch.refresh(true); // an error text in the old language: try again
    push();
  }

  // ---- choosing inputs ----
  async function setSlot(what, slot) {
    slots[what] = slot;
    if (slot.kind === 'handle') slot.persisted = await store.set(`h.${what}`, { handle: slot.handle, how: slot.how });
    else { slot.persisted = false; await store.del(`h.${what}`); }
  }

  // Validate a handle for a slot; → error text or null.
  async function checkHandle(what, h) {
    if (what === 'game') return (h.kind === 'directory' && await gamefs.resolveGame(h)) ? null : w('notGame', { name: h.name });
    if (what === 'save') return h.kind === 'file' && endsWith(h.name, '.sav') ? null : w('notSave', { name: h.name });
    if (what === 'exe') return h.kind === 'file' && endsWith(h.name, '.exe') ? null : w('notExe', { name: h.name });
    if (what === 'paks') return h.kind === 'directory' && (await gamefs.listFileNames(h)).some((n) => endsWith(n, '.pak')) ? null : w('noPaks', { name: h.name });
    if (what === 'steam') return h.kind === 'directory' && await gamefs.readManifest(h) ? null : w('noAcf', { name: h.name });
    return 'bad slot';
  }

  async function applyHandle(what, h, how) {
    const err = await checkHandle(what, h);
    if (err) return { ok: false, path: h.name, error: err };
    await setSlot(what, { kind: 'handle', handle: h, name: h.name, how });
    await reload();
    return { ok: true, path: h.name, error: null };
  }

  async function applyFiles(what, files, how) {
    if (what === 'paks') {
      const paks = files.filter((f) => endsWith(f.name, '.pak'));
      const folder = String(files[0]?.webkitRelativePath || '').split('/')[0] || 'Paks';
      if (!paks.length) return { ok: false, path: folder, error: w('noPaks', { name: folder }) };
      await setSlot('paks', { kind: 'files', files: paks, name: `${folder} · ${paks.length} .pak`, how });
    } else {
      const f = files[0];
      if (what === 'save' && !endsWith(f.name, '.sav')) return { ok: false, path: f.name, error: w('notSave', { name: f.name }) };
      if (what === 'exe' && !endsWith(f.name, '.exe')) return { ok: false, path: f.name, error: w('notExe', { name: f.name }) };
      if (what !== 'save' && what !== 'exe') return { ok: false, path: f.name, error: w('pickUnsupported') };
      await setSlot(what, { kind: 'file', file: f, name: f.name, how });
    }
    await reload();
    return { ok: true, path: files[0]?.name || null, error: null };
  }

  // Opens the picker synchronously (user gesture), then validates and reloads.
  function pick(what) {
    if (!SLOTS.includes(what)) return Promise.reject(new Error('what'));
    try {
      if (mode() === 'fs') {
        const startIn = (what === 'save' || what === 'exe' || what === 'paks') && ctx.game ? ctx.game : undefined;
        const p = what === 'save' || what === 'exe'
          ? pickers.pickFileHandle(`pbz-${what}`, what, startIn)
          : pickers.pickDirectory(`pbz-${what}`, startIn);
        return p.then((h) => (h ? applyHandle(what, h, 'picked') : CANCELLED),
          (e) => ({ ok: false, path: null, error: w('pickFailed', { msg: e.message || e.name }) }));
      }
      if (what === 'game' || what === 'steam') return Promise.resolve({ ok: false, path: null, error: w('pickUnsupported') });
      const p = pickers.pickFilesWithInput(what === 'paks' ? { directory: true } : { accept: what === 'save' ? '.sav' : '.exe' });
      return p.then((files) => (files ? applyFiles(what, files, 'picked') : CANCELLED));
    } catch (e) {
      return Promise.resolve({ ok: false, path: null, error: w('pickFailed', { msg: e.message || e.name }) });
    }
  }

  // A pick started from a setup button: show its error in the page (Settings shows its own).
  function pickFromAction(what) {
    const acts = actions;
    return pick(what).then((r) => {
      if (r && r.error) { ok = false; error = r.error; errorKind = null; actions = acts; push(); }
      return r;
    });
  }

  // Drag and drop: folders (game, library, Paks, account folder) and files (.sav, PBZ.exe, .pak).
  function onDrop(e) {
    if (!e.dataTransfer) return;
    e.preventDefault();
    const items = Array.from(e.dataTransfer.items || []).filter((i) => i.kind === 'file');
    const fs = mode() === 'fs';
    // Everything must be taken from the DataTransfer before the first await.
    const handleP = items.map((i) => (fs && typeof i.getAsFileSystemHandle === 'function' ? i.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null)));
    const files = items.map((i) => i.getAsFile());
    (async () => {
      const handles = await Promise.all(handleP);
      const errors = [];
      const paks = [];
      let changed = false;
      for (let i = 0; i < items.length; i++) {
        const h = handles[i], f = files[i];
        const name = h?.name || f?.name || '?';
        if (h && h.kind === 'directory') {
          let what = null;
          if (await gamefs.resolveGame(h)) what = 'game';
          else if ((await gamefs.listFileNames(h)).some((n) => endsWith(n, '.pak'))) what = 'paks';
          else if (await gamefs.readManifest(h)) what = 'steam';
          else {
            const sav = await gamefs.child(h, 'PBZSaveGame.sav', 'file');
            if (sav) { await setSlot('save', { kind: 'handle', handle: sav, name: `${h.name} › ${sav.name}`, how: 'dropped' }); changed = true; continue; }
          }
          if (what) { await setSlot(what, { kind: 'handle', handle: h, name: h.name, how: 'dropped' }); changed = true; } else errors.push(w('dropUnknown', { name }));
        } else if (endsWith(name, '.sav')) {
          await setSlot('save', h ? { kind: 'handle', handle: h, name, how: 'dropped' } : { kind: 'file', file: f, name, how: 'dropped' }); changed = true;
        } else if (endsWith(name, '.exe')) {
          await setSlot('exe', h ? { kind: 'handle', handle: h, name, how: 'dropped' } : { kind: 'file', file: f, name, how: 'dropped' }); changed = true;
        } else if (endsWith(name, '.pak') && f) {
          paks.push(f);
        } else errors.push(w('dropUnknown', { name }));
      }
      if (paks.length) { await setSlot('paks', { kind: 'files', files: paks, name: `${paks.length} .pak`, how: 'dropped' }); changed = true; }
      if (changed) await reload();
      // Unrecognised items: shown while nothing is being tracked (a working page is left alone).
      if (errors.length && !view) { ok = false; error = errors.join(' '); errorKind = null; push(); }
    })().catch(() => {});
  }

  // ---- settings / about ----
  function nameOptions() {
    return [
      { value: '', label: t('ui.namesAuto') },
      ...(ctx.patches || []).map((p) => ({ value: p, label: t('ui.namesPatch', { pak: p }) })),
      ...Object.keys(core.EMBEDDED_TABLES).sort().map((l) => ({ value: l, label: t('ui.namesTable', { lang: l }) })),
    ];
  }

  const howText = (s) => w(s.how === 'dropped' ? 'src.dropped' : 'src.picked');
  function rowFor(what, value, { fromText = null, optional = false } = {}) {
    const s = slots[what] && use(what) ? slots[what] : null;
    let sourceText, warn = false;
    if (s) sourceText = s.persisted ? howText(s) : `${howText(s)} · ${w('src.visit')}`;
    else if (value && fromText) sourceText = fromText;
    else { sourceText = w(optional ? 'src.optional' : 'src.needed'); warn = !optional; }
    return {
      what, label: w(`row.${what}`), value: s ? (value || s.name) : value || null,
      source: s ? 'config' : value ? 'auto' : null, sourceText, warn,
      canForget: !!slots[what] || (what === 'exe' && !!ctx.keyCached),
    };
  }

  function settings() {
    const fsMode = mode() === 'fs';
    const hasGame = !!ctx.game;
    const paths = [];
    if (fsMode) paths.push(rowFor('game', ctx.gameLabel || slots.game?.name || null));
    paths.push(rowFor('save', ctx.saveLabel || null, { fromText: w('src.fromGame') }));
    const exeRow = rowFor('exe', ctx.exeLabel || null, { fromText: w('src.fromGame') });
    if (!ctx.exeLabel && ctx.keyCached && !slots.exe) { exeRow.sourceText = w('src.keyCached'); exeRow.warn = false; }
    paths.push(exeRow);
    paths.push(rowFor('paks', ctx.paksLabel || null, { fromText: w('src.fromGame'), optional: true }));
    if (fsMode) {
      const r = rowFor('steam', ctx.buildId ? `build ${ctx.buildId}` : null, { fromText: w('src.fromLibrary'), optional: true });
      if (slots.steam && ctx.buildId) r.value = `${slots.steam.name} · build ${ctx.buildId}`;
      paths.push(r);
    }
    const extraFields = [];
    if (fsMode && hasGame && !use('save') && (ctx.accounts || []).length > 1) {
      extraFields.push({
        id: 'account', label: w('field.account'), value: ctx.account || '',
        options: ctx.accounts.map((a) => ({ value: a.id, label: w('account', { id: a.id, date: a.lastModified ? new Date(a.lastModified).toLocaleString() : '?' }) })),
      });
    }
    if (pickers.hasFsAccess()) {
      extraFields.push({
        id: 'mode', label: w('field.mode'), value: mode(), hint: w('mode.hint'),
        options: [{ value: 'fs', label: w('mode.fs') }, { value: 'files', label: w('mode.files') }],
      });
    }
    return {
      gameDir: ctx.gameLabel || null,
      gameDirSource: slots.game ? 'config' : null,
      savePath: ctx.saveLabel || null,
      savePathSource: slots.save ? 'config' : ctx.saveLabel ? 'auto' : null,
      uiLang: i18n.getLang(),
      names: { current: cfg.names || '', options: nameOptions() },
      interval: interval(),
      intervalHint: w('intervalHint'),
      exact: cfg.exact === true,
      timeline: timelineOn(),
      timelineHint: w('timelineHint'),
      rules: { source: 'embedded', file: null, version: RULES.rulesVersion },
      configPath: w('storage'),
      configLabel: w('storageLabel'),
      paths,
      extraFields,
      pathsNote: w(fsMode ? 'note.fs' : 'note.files'),
    };
  }

  const saveCfg = () => store.set('cfg', { ...cfg });

  async function postSettings(body) {
    if (!body || typeof body !== 'object') throw new Error('body');
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
    const patch = {};
    if (has('uiLang')) { if (!isLang(body.uiLang)) throw new Error('uiLang'); patch.uiLang = body.uiLang; }
    if (has('names')) {
      if (typeof body.names !== 'string' || !nameOptions().some((o) => o.value === body.names)) throw new Error('names');
      patch.names = body.names;
    }
    if (has('interval')) {
      if (typeof body.interval !== 'number' || !Number.isFinite(body.interval)) throw new Error('interval');
      patch.interval = clampInterval(body.interval);
    }
    if (has('account')) {
      if (typeof body.account !== 'string' || !(ctx.accounts || []).some((a) => a.id === body.account)) throw new Error('account');
      patch.account = body.account;
    }
    if (has('exact')) { if (typeof body.exact !== 'boolean') throw new Error('exact'); patch.exact = body.exact; }
    if (has('timeline')) { if (typeof body.timeline !== 'boolean') throw new Error('timeline'); patch.timeline = body.timeline; }
    if (has('mode')) {
      if (body.mode !== 'fs' && body.mode !== 'files') throw new Error('mode');
      if (body.mode === 'fs' && !pickers.hasFsAccess()) throw new Error('mode');
      patch.mode = body.mode;
    }
    let texts = false, again = false, changed = false;
    if (patch.uiLang) { cfg.uiLang = patch.uiLang; if (patch.uiLang !== i18n.getLang()) { i18n.setLang(patch.uiLang); texts = true; } }
    if (has('names') && patch.names !== (cfg.names || '')) { cfg.names = patch.names || undefined; texts = true; }
    if (patch.interval && patch.interval !== interval()) { cfg.interval = patch.interval; watch?.setInterval(patch.interval); changed = true; }
    if (patch.account && patch.account !== ctx.account) { cfg.account = patch.account; again = true; }
    if (patch.mode && patch.mode !== mode()) { cfg.mode = patch.mode; again = true; }
    let exactChanged = false;
    if (has('exact') && patch.exact !== (cfg.exact === true)) { cfg.exact = patch.exact; exactChanged = true; }
    if (has('timeline')) cfg.timeline = patch.timeline; // takes effect with the next read
    if (Object.keys(patch).length) await saveCfg();
    // Every pushed state re-blurs the journal in the page: push only when something actually changed.
    if (again) await reload();
    else if (texts || exactChanged) await (queue = queue.then(relocalize, relocalize));
    else if (changed) push();
    return settings();
  }

  async function forget(what) {
    if (![...SLOTS, 'all'].includes(what)) throw new Error('what');
    const list = what === 'all' ? SLOTS : [what];
    for (const s of list) { delete slots[s]; await store.del(`h.${s}`); }
    if (what === 'exe' || what === 'all') await store.del('key'); // the derived key goes with the exe
    if (what === 'game' || what === 'all') { delete cfg.account; await saveCfg(); }
    if (what === 'all') await timeline.clear(); // "forget everything" includes the quest timeline
    await reload();
    return settings();
  }

  // Diagnostics (lib/diagnostics.js: no paths, account ids or user names) + the plain-text report.
  async function diagnostics() {
    await restored;
    const tl = await timeline.status();
    const d = collectDiagnostics({
      mode: 'web', version: VERSION, uiLang: i18n.getLang(), exact: cfg.exact === true,
      rules: { version: RULES.rulesVersion, schemaVersion: SCHEMA_VERSION, source: 'embedded' },
      keyMap: NAMES,
      namesSource: names ? names.source : null,
      nameFiles: [],
      patches: ctx.patches || [],
      build: gameBuild,
      st: view ? view.st : null, result: view ? view.result : null, ok,
      timeline: { enabled: timelineOn(), count: await timeline.count(), error: tl.error },
    });
    return { ...d, report: formatDiagnostics(d) };
  }

  const about = () => ({
    version: VERSION,
    testedBuilds: [...TESTED_BUILDS],
    license: LICENSE,
    repoUrl: REPO_URL,
    loopbackNote: w('privacy'),
    linksHint: w('linksHint'),
    links: LINKS.map((l) => ({ label: t(l.key), url: l.url })),
  });

  function openUrl(url) {
    if (typeof url !== 'string' || !ALLOWED_URLS.has(url)) return Promise.reject(new Error('url not allowed'));
    window.open(url, '_blank', 'noopener,noreferrer');
    return Promise.resolve(null);
  }

  // Setup buttons in the page (state.actions).
  function action(id) {
    if (id === 'pickGame') return pickFromAction('game');
    if (id === 'pickSave') return pickFromAction('save');
    if (id === 'pickExe') return pickFromAction('exe');
    if (id === 'useFiles') return postSettings({ mode: 'files' });
    if (id === 'resume' && pending) {
      const s = pending;
      // requestPermission must run inside the click: no await before it.
      const p = typeof s.handle.requestPermission === 'function' ? s.handle.requestPermission({ mode: 'read' }) : Promise.resolve('granted');
      const denied = () => {
        setup(w('denied', { name: s.handle.name }), [
          { id: 'pickGame', label: w('act.otherFolder') },
          { id: 'useFiles', label: w('act.pickFiles') },
        ]);
        return null;
      };
      return p.then((r) => (r === 'granted' ? reload() : denied()), denied);
    }
    return Promise.resolve(null);
  }

  // ---- start ----
  async function restore() {
    const c = await store.get('cfg');
    cfg = c && typeof c === 'object' ? { ...c } : {};
    if (isLang(cfg.uiLang)) i18n.setLang(cfg.uiLang);
    for (const what of SLOTS) {
      const v = await store.get(`h.${what}`);
      if (v && v.handle && v.handle.kind) slots[what] = { kind: 'handle', handle: v.handle, name: v.handle.name, how: v.how || 'picked', persisted: true };
    }
  }

  document.addEventListener('drop', onDrop);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && watch && watch.src.handle) watch.refresh(false); });
  busy(w('busy.start'));
  const restored = restore().catch(() => {});
  const ready = restored.then(reload).catch(() => {});

  const transport = {
    needsToken: false,
    getState: async () => current,
    subscribe: (fn) => { listeners.add(fn); },
    getSettings: async () => { await restored; return settings(); },
    postSettings,
    pick,
    forget,
    openUrl,
    getAbout: async () => about(),
    getDiagnostics: diagnostics,
    getTimeline: async () => exportTimeline(await timeline.records(), VERSION),
    // "Delete timeline" in Diagnostics (turning the switch off only stops recording).
    deleteTimeline: async () => { await timeline.clear(); return { ok: true, count: 0 }; },
    action,
  };

  // Test hook, on a local development host only (never on the published site): feed handles/Files
  // without the native pickers, which automation cannot click.
  if (['127.0.0.1', 'localhost', '[::1]'].includes(globalThis.location?.hostname)) {
    globalThis.__pbzTest = {
      ready,
      useHandle: (what, h) => applyHandle(what, h, 'picked'),
      useFiles: (what, files) => applyFiles(what, files, 'picked'),
      state: () => current,
      settings,
      refresh: () => watch && watch.refresh(false),
      idle: () => queue,
    };
  }
  return transport;
}

module.exports = { createTransport };
