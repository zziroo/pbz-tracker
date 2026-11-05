'use strict';
// Window mode: a tiny HTTP server on 127.0.0.1 (random port) that serves the page in ui/ and the
// State JSON of docs/ui-api.md. Nothing listens on other interfaces and nothing goes to the internet.
//   - random token per start: in the page URL (?t=), in X-PBZ-Token for /api/*, in ?t= for /events
//   - Host must be exactly 127.0.0.1:<port>, a present Origin exactly http://127.0.0.1:<port>
//   - POST bodies: application/json only (415), at most 16 KB (413)
//   - the process exits 10 s after the last heartbeat (60 s if none ever arrives)
// Strictly read-only on the save and the game; the only file written is pbz-tracker.config.json.
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const i18n = require('./i18n');
const { t } = i18n;
const { createSession } = require('./session');
const { watchSave } = require('./watch');
const { toState } = require('./viewmodel');
const { readConfig, writeConfig, configPath } = require('./config');
const { pickFolderAsync, pickFileAsync } = require('./picker');
const { gameFromPath, isFile } = require('./paths');
const { openDefault } = require('./browser');
const { loadRules } = require('./datafiles');
const { EMBEDDED_TABLES } = require('./names');
const { VERSION, TESTED_BUILDS, REPO_URL, LICENSE } = require('./version');
const assets = require('./uiassets');
const EMBEDDED_RULES = require('../data/rules.json');

const MAX_BODY = 16 * 1024;
const PING_MS = 15000;
const HEARTBEAT_TIMEOUT_MS = 10000;
const FIRST_HEARTBEAT_MS = 60000;
const CSP = "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const BASE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };

// Guides and technical credits for the About tab. Labels are spoiler-free; DTGRE is linked by its
// home page only, because its article addresses contain spoilers (see README "Sources").
const LINKS = [
  { key: 'link.game8', url: 'https://game8.co/games/Phantom-Blade-Zero/archives/634952' },
  { key: 'link.powerpyx', url: 'https://powerpyx.com/phantom-blade-zero-trophy-guide-roadmap' },
  { key: 'link.dtgre', url: 'https://www.dtgre.com' },
  { key: 'link.ooz', url: 'https://github.com/powzix/ooz' },
];
const ALLOWED_URLS = new Set([REPO_URL, ...LINKS.map((l) => l.url)].filter(Boolean));

const clampInterval = (v) => Math.min(3600, Math.max(2, Math.round(v)));
const isLang = (v) => v === 'tr' || v === 'en';

class HttpError extends Error { constructor(status, msg) { super(msg || http.STATUS_CODES[status]); this.status = status; } }

/**
 * opt: parsed command-line options (lang, names, interval/intervalSet, game, save, exe, steamId, rules).
 * onExit(): called after the idle shutdown (the caller exits the process).
 * → Promise<{ url, port, token, close() }>
 */
async function startServer(opt, { onExit = () => {}, heartbeatTimeoutMs = HEARTBEAT_TIMEOUT_MS, firstHeartbeatMs = FIRST_HEARTBEAT_MS } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenBuf = Buffer.from(token);
  const cfg = readConfig();

  // Settings: command line > config > defaults.
  if (!opt.lang && isLang(cfg.uiLang)) i18n.setLang(cfg.uiLang);
  let namesSetting = opt.names ?? (typeof cfg.names === 'string' ? cfg.names : '');
  let interval = opt.intervalSet ? opt.interval : (Number.isFinite(cfg.interval) ? clampInterval(cfg.interval) : 5);
  // Options passed to the session; paths from the command line are dropped once the user picks or forgets.
  const sessOpt = { game: opt.game, save: opt.save, exe: opt.exe, steamId: opt.steamId, rules: opt.rules, names: namesSetting || undefined };

  let session = null, partial = {}, watcher = null;
  let view = null, readAt = null, ok = false, error = null;
  let current = toState({ ok, error, readAt, view });
  const clients = new Set();
  let queue = Promise.resolve();
  let picking = false;
  let lastBeat = null;   // last sign of life: a heartbeat, or a tick with an SSE client connected
  let lastTick = null;
  const startedAt = Date.now();
  let port = 0, closed = false;

  // ---- state ----
  const sseWrite = (res, s) => { try { res.write(s); } catch { /* client gone */ } };
  const push = () => {
    current = toState({ ok, error, readAt, view });
    const msg = `event: state\ndata: ${JSON.stringify(current)}\n\n`;
    for (const res of clients) sseWrite(res, msg);
  };
  const viewOf = (r) => ({ st: r.st, result: r.result, changes: r.changes, names: session.names, build: session.gameBuild, data: session.dataInfo });

  const doReload = async () => {
    watcher?.close(); watcher = null;
    session = null; view = null; readAt = null; partial = {};
    try {
      session = await createSession(sessOpt, { dialogs: false, prompt: false, partial });
    } catch (e) {
      ok = false; error = `${e.message}${/[.!?]$/.test(e.message) ? '' : '.'} ${t('ui.useSettings')}`;
      push();
      return;
    }
    const s = session;
    const w = watchSave({
      savePath: s.savePath,
      interval,
      read: () => s.read(),
      onRead: (r) => {
        if (session !== s) return;
        view = viewOf(r); readAt = new Date().toISOString(); ok = true; error = null;
        push();
      },
      onError: (e) => {
        if (session !== s) return;
        ok = false; error = t('ui.readFail', { msg: e.message });
        push();
      },
    });
    watcher = w;
    await w.start();
  };
  const reload = () => (queue = queue.then(doReload, doReload));

  // Language / name source changed: rebuild the texts from the last decoded save (no re-read).
  // Runs inside the queue, so it calls doReload directly (reload() would wait for itself).
  const relocalize = async () => {
    if (!session) return doReload();
    session.setNames(sessOpt.names);
    if (view) {
      const { result, changes } = session.evaluate(view.st, { again: true });
      view = { ...view, result, changes, names: session.names };
    }
    if (!ok && watcher) watcher.refresh(); // an error text in the old language: try again
    push();
  };

  // ---- settings / about ----
  const nameOptions = () => {
    const o = session ? session.nameOptions() : { patches: [], tables: Object.keys(EMBEDDED_TABLES).sort() };
    return [
      { value: '', label: t('ui.namesAuto') },
      ...o.patches.map((p) => ({ value: p, label: t('ui.namesPatch', { pak: p }) })),
      ...o.tables.map((l) => ({ value: l, label: t('ui.namesTable', { lang: l }) })),
    ];
  };
  const rulesInfo = () => {
    let r = session?.rulesInfo;
    if (!r) { try { r = loadRules({ explicit: sessOpt.rules, embedded: EMBEDDED_RULES }); } catch { r = null; } }
    if (!r) return { source: sessOpt.rules ? 'explicit' : 'embedded', file: sessOpt.rules ? path.resolve(sessOpt.rules) : null, version: EMBEDDED_RULES.rulesVersion };
    return { source: r.source, file: r.file, version: r.rules.rulesVersion };
  };
  const settings = () => ({
    gameDir: session?.gameDir ?? partial.gameDir ?? null,
    gameDirSource: session?.gameDirSource ?? partial.gameDirSource ?? null,
    savePath: session?.savePath ?? partial.savePath ?? null,
    savePathSource: session?.savePathSource ?? partial.savePathSource ?? null,
    uiLang: i18n.getLang(),
    names: { current: namesSetting, options: nameOptions() },
    interval,
    rules: rulesInfo(),
    configPath: configPath(),
  });
  const about = () => ({
    version: VERSION,
    testedBuilds: [...TESTED_BUILDS],
    license: LICENSE,
    repoUrl: REPO_URL,
    loopbackNote: t('ui.loopback'),
    links: LINKS.map((l) => ({ label: t(l.key), url: l.url })),
  });

  // ---- API handlers ----
  async function postSettings(body) {
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
    const patch = {};
    if (has('uiLang')) { if (!isLang(body.uiLang)) throw new HttpError(400, 'uiLang'); patch.uiLang = body.uiLang; }
    if (has('names')) {
      if (typeof body.names !== 'string' || !nameOptions().some((o) => o.value === body.names)) throw new HttpError(400, 'names');
      patch.names = body.names;
    }
    if (has('interval')) {
      const n = Number(body.interval);
      if (typeof body.interval !== 'number' || !Number.isFinite(n)) throw new HttpError(400, 'interval');
      patch.interval = clampInterval(n);
    }
    if (Object.keys(patch).length) writeConfig({ ...patch, ...(has('names') ? { names: patch.names || undefined } : {}) });
    let texts = false;
    if (patch.uiLang && patch.uiLang !== i18n.getLang()) { i18n.setLang(patch.uiLang); texts = true; }
    if (has('names') && patch.names !== namesSetting) { namesSetting = patch.names; sessOpt.names = patch.names || undefined; texts = true; }
    let changed = texts;
    if (patch.interval && patch.interval !== interval) { interval = patch.interval; watcher?.setInterval(interval); changed = true; }
    // Every pushed state re-blurs the journal in the page: push only when something actually changed.
    if (texts) await (queue = queue.then(relocalize, relocalize));
    else if (changed) push();
    return settings();
  }

  async function postPick(body) {
    const what = body.what;
    if (what !== 'game' && what !== 'save') throw new HttpError(400, 'what');
    if (picking) return { ok: false, path: null, error: t('ui.pickBusy') };
    picking = true;
    let picked;
    try {
      if (what === 'game') {
        picked = await pickFolderAsync(t('pick.game'), settings().gameDir || readConfig().gameDir);
      } else {
        const s = settings();
        const start = s.savePath ? path.dirname(s.savePath) : s.gameDir ? path.join(s.gameDir, 'ProjectPBZ', 'Saved', 'SaveGames') : '';
        picked = await pickFileAsync(t('pick.save'), t('pick.saveFilter'), start);
      }
    } finally {
      picking = false;
      if (lastBeat != null) lastBeat = Date.now(); // the dialog may have been open for a while
    }
    if (!picked) return { ok: false, path: null, error: null };
    if (what === 'game') {
      const g = gameFromPath(picked);
      if (!g) return { ok: false, path: picked, error: t('ui.pickNotGame', { p: picked }) };
      const stored = writeConfig({ gameDir: g });
      delete sessOpt.exe; delete sessOpt.save;
      if (stored) delete sessOpt.game; else sessOpt.game = g; // not writable: keep it for this run
      await reload();
      return stored ? { ok: true, path: g, error: null } : { ok: false, path: g, error: t('ui.notStored', { file: configPath() }) };
    }
    if (!isFile(picked)) return { ok: false, path: picked, error: t('err.noSaveFile', { p: picked }) };
    const stored = writeConfig({ savePath: picked });
    if (stored) delete sessOpt.save; else sessOpt.save = picked;
    await reload();
    return stored ? { ok: true, path: picked, error: null } : { ok: false, path: picked, error: t('ui.notStored', { file: configPath() }) };
  }

  async function postForget(body) {
    const what = body.what;
    if (!['game', 'save', 'all'].includes(what)) throw new HttpError(400, 'what');
    // Forgets the remembered paths only; the window settings (language, names, interval) stay.
    const patch = {};
    if (what === 'game' || what === 'all') { patch.gameDir = undefined; delete sessOpt.game; delete sessOpt.exe; }
    if (what === 'save' || what === 'all') { patch.savePath = undefined; delete sessOpt.save; }
    writeConfig(patch);
    await reload();
    return settings();
  }

  // ---- HTTP plumbing ----
  const send = (res, status, body, type = 'text/plain; charset=utf-8', extra = {}) => {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body == null ? '' : String(body));
    res.writeHead(status, { ...BASE_HEADERS, 'Content-Security-Policy': CSP, 'Content-Type': type, 'Content-Length': buf.length, ...extra });
    res.end(buf);
  };
  const sendJson = (res, obj) => send(res, 200, JSON.stringify(obj), 'application/json; charset=utf-8');
  const tokenOk = (v) => {
    if (typeof v !== 'string') return false;
    const b = Buffer.from(v);
    return b.length === tokenBuf.length && crypto.timingSafeEqual(b, tokenBuf);
  };

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const ct = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const len = Number(req.headers['content-length'] || 0);
      const hasBody = len > 0 || req.headers['transfer-encoding'] != null;
      if ((hasBody || req.headers['content-type'] != null) && ct !== 'application/json') return reject(new HttpError(415));
      if (len > MAX_BODY) return reject(new HttpError(413));
      const chunks = []; let size = 0, done = false;
      req.on('data', (c) => {
        if (done) return;
        size += c.length;
        if (size > MAX_BODY) { done = true; reject(new HttpError(413)); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (done) return;
        done = true;
        const text = Buffer.concat(chunks).toString('utf8').trim();
        if (!text) return resolve({});
        let v;
        try { v = JSON.parse(text); } catch { return reject(new HttpError(400, 'invalid JSON')); }
        if (!v || typeof v !== 'object' || Array.isArray(v)) return reject(new HttpError(400, 'JSON object expected'));
        resolve(v);
      });
      req.on('error', () => { if (!done) { done = true; reject(new HttpError(400)); } });
    });
  }

  const ROUTES = {
    'GET /api/state': () => current,
    'GET /api/settings': () => settings(),
    'GET /api/about': () => about(),
    'POST /api/heartbeat': () => { lastBeat = Date.now(); return null; },
    'POST /api/settings': (b) => postSettings(b),
    'POST /api/pick': (b) => postPick(b),
    'POST /api/forget': (b) => postForget(b),
    'POST /api/open-url': (b) => {
      if (typeof b.url !== 'string' || !ALLOWED_URLS.has(b.url)) throw new HttpError(400, 'url not allowed');
      openDefault(b.url);
      return null;
    },
  };
  const API_PATHS = new Set(Object.keys(ROUTES).map((k) => k.split(' ')[1]));

  async function handle(req, res) {
    const host = `127.0.0.1:${port}`;
    if (req.headers.host !== host) return send(res, 403, 'Forbidden');
    if (req.headers.origin != null && req.headers.origin !== `http://${host}`) return send(res, 403, 'Forbidden');
    if (!req.url || !req.url.startsWith('/')) return send(res, 400, 'Bad Request');
    let u;
    try { u = new URL(req.url, `http://${host}`); } catch { return send(res, 400, 'Bad Request'); }
    const p = u.pathname;

    if (p === '/app.js' || p === '/style.css') {
      if (req.method !== 'GET') return send(res, 405, 'Method Not Allowed', undefined, { Allow: 'GET' });
      const name = p.slice(1);
      return send(res, 200, assets[name], name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8');
    }
    if (p === '/') {
      if (!tokenOk(u.searchParams.get('t'))) return send(res, 403, 'Forbidden');
      if (req.method !== 'GET') return send(res, 405, 'Method Not Allowed', undefined, { Allow: 'GET' });
      return send(res, 200, assets['index.html'], 'text/html; charset=utf-8');
    }
    if (p === '/events') {
      if (!tokenOk(u.searchParams.get('t'))) return send(res, 403, 'Forbidden');
      if (req.method !== 'GET') return send(res, 405, 'Method Not Allowed', undefined, { Allow: 'GET' });
      res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive' });
      sseWrite(res, `retry: 2000\n\nevent: state\ndata: ${JSON.stringify(current)}\n\n`);
      clients.add(res);
      const drop = () => clients.delete(res);
      req.on('close', drop); res.on('close', drop); res.on('error', drop);
      return undefined;
    }
    if (p.startsWith('/api/')) {
      if (!tokenOk(req.headers['x-pbz-token'])) return send(res, 403, 'Forbidden');
      const fn = ROUTES[`${req.method} ${p}`];
      if (!fn) {
        if (API_PATHS.has(p)) return send(res, 405, 'Method Not Allowed');
        return send(res, 404, 'Not Found');
      }
      const body = req.method === 'POST' ? await readBody(req) : null;
      const out = await fn(body);
      if (out === null) return send(res, 204, '');
      return sendJson(res, out);
    }
    return send(res, 404, 'Not Found');
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      if (res.headersSent) { try { res.end(); } catch { /* ignore */ } return; }
      const status = e instanceof HttpError ? e.status : 500;
      send(res, status, status === 500 ? 'Internal Server Error' : e.message, undefined, status === 413 || status === 415 ? { Connection: 'close' } : {});
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  port = server.address().port;

  // ---- lifecycle ----
  const ping = setInterval(() => { for (const res of clients) sseWrite(res, ': ping\n\n'); }, PING_MS);
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(ping); clearInterval(idle);
    watcher?.close();
    for (const res of clients) { try { res.end(); } catch { /* ignore */ } }
    clients.clear();
    server.close();
    server.closeAllConnections?.();
  };
  // Alive while the page holds its SSE connection (network streams are not throttled when the window is
  // hidden or covered by the game, unlike the page's heartbeat timer), or while heartbeats arrive.
  // A large gap between ticks means sleep/resume or a clock jump: restart the clock instead of exiting.
  const idle = setInterval(() => {
    const now = Date.now();
    if (lastTick != null && now - lastTick > 5000 && lastBeat != null) lastBeat = now;
    lastTick = now;
    if (picking) return;
    if (clients.size > 0) { lastBeat = now; return; }
    const gone = lastBeat == null ? now - startedAt > firstHeartbeatMs : now - lastBeat > heartbeatTimeoutMs;
    if (gone) { close(); onExit(); }
  }, 1000);

  await reload(); // first read before the window opens, so the page starts with data
  return { url: `http://127.0.0.1:${port}/?t=${token}`, port, token, close };
}

module.exports = { startServer, LINKS };
