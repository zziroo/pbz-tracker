#!/usr/bin/env node
'use strict';
// Phantom Blade Zero missables tracker. Strictly read-only: never writes to the save, its backups or game files.
// Two front ends over the same engine (lib/session.js):
//   window   (default: double-click, dropped paths, --ui) → lib/server.js on 127.0.0.1 + lib/browser.js
//   terminal (--cli, or any terminal option such as --show, --watch, --dump, --save) → lib/report.js render
const { spawn } = require('child_process');
const path = require('path');
const i18n = require('./lib/i18n');
const { t } = i18n;
const { classifyPath } = require('./lib/paths');
const { VERSION } = require('./lib/version');
const { render } = require('./lib/report');
const { isSea } = require('./lib/datafiles');
const { readConfig, forgetConfig } = require('./lib/config');
const { createSession } = require('./lib/session');
const { watchSave } = require('./lib/watch');

function parseArgs(argv) {
  const o = { watch: false, show: false, dump: null, color: !!process.stdout.isTTY && !process.env.NO_COLOR, interval: 5, lang: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(t('err.needsValue', { o: a })); return argv[++i]; };
    switch (a) {
      case '-w': case '--watch': o.watch = true; break;
      case '--show': o.show = true; break;
      case '--lang': o.lang = val().toLowerCase(); break;
      case '--names': o.names = val(); break;
      case '--rules': o.rules = val(); break;
      case '--steamid': o.steamId = val(); break;
      case '--dump': o.dump = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : path.join(process.cwd(), 'out'); break;
      case '--save': o.save = val(); o.explicitPaths = true; break;
      case '--game': o.game = val(); o.explicitPaths = true; break;
      case '--exe': o.exe = val(); o.explicitPaths = true; break;
      case '--pick': o.pick = true; break;
      case '--forget': o.forget = true; break;
      case '--no-dialog': o.noDialog = true; break;
      case '--interval': o.interval = Math.min(3600, Math.max(2, Number(val()) || 5)); o.intervalSet = true; break;
      case '--no-color': o.color = false; break;
      case '--ui': o.ui = true; break;
      case '--ui-child': o.ui = true; o.uiChild = true; break;
      case '--no-edge': o.noEdge = true; break;
      case '--cli': o.cli = true; break;
      case '-h': case '--help': o.help = true; break;
      case '-v': case '--version': o.version = true; break;
      default: {
        if (a.startsWith('-')) throw new Error(t('err.unknownOpt', { o: a }));
        // Path without a flag (drag & drop onto the exe): save file, save folder, game folder or PBZ.exe.
        const c = classifyPath(a);
        if (!c) throw new Error(t('err.unknownPath', { p: a }));
        if (c.save) o.save = c.save;
        if (c.game) o.game = c.game;
        if (c.exe) o.exe = c.exe;
      }
    }
  }
  return o;
}

// ---- mode ----
// Window (UI): no arguments (double-click), only dropped paths (single exe), or --ui / --no-edge / --ui-child.
// Terminal (CLI): --cli, or any other option (as in v0.3). `--cli` alone (or with only paths in the
// single exe) is the v0.3 double-click behaviour: watch mode, window stays open on errors.
const RAW_ARGS = process.argv.slice(2);
const isPathArg = (a) => !a.startsWith('-');
const UI_FLAGS = new Set(['--ui', '--ui-child', '--no-edge']);
const NO_FLAGS = RAW_ARGS.length === 0 || (isSea() && RAW_ARGS.every(isPathArg));
const UI_MODE = !RAW_ARGS.includes('--cli') && (NO_FLAGS || RAW_ARGS.some((a) => UI_FLAGS.has(a)));
const CLI_ARGS = RAW_ARGS.filter((a) => a !== '--cli');
const INTERACTIVE = UI_MODE ? NO_FLAGS : CLI_ARGS.length === 0 || (isSea() && CLI_ARGS.every(isPathArg));

function waitForKey() {
  if (!process.stdin.isTTY) return Promise.resolve();
  console.error(t('pressKey'));
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => { process.stdin.setRawMode(false); process.stdin.pause(); resolve(); });
  });
}

// ---- window mode ----
async function mainUi(opt) {
  // Double-clicking a console exe gives it its own console window, which would stay open (empty) next to
  // the app window for as long as the server runs. So the single exe started by double-click / drop
  // re-launches itself detached (DETACHED_PROCESS: no console at all, windowsHide) with --ui-child and
  // exits; Windows then closes the console window. Not under `node pbz.js` (development: keep the
  // console for logs), not when --ui was typed in a terminal, and never twice (--ui-child).
  if (isSea() && INTERACTIVE && !opt.uiChild) {
    const started = await new Promise((resolve) => {
      try {
        const child = spawn(process.execPath, [...RAW_ARGS, '--ui', '--ui-child'], { detached: true, windowsHide: true, stdio: 'ignore' });
        child.once('spawn', () => { child.unref(); resolve(true); });
        child.once('error', () => resolve(false));
      } catch { resolve(false); }
    });
    if (started) process.exit(0);
    // Could not re-launch: carry on in this process (the console stays visible, nothing is lost).
  }
  if (opt.uiChild) {
    // No console in the child: show fatal errors in a message box instead of losing them.
    process.on('uncaughtException', (e) => { fatalBox(e); process.exit(1); });
  }
  const { startServer } = require('./lib/server');
  const { openWindow } = require('./lib/browser');
  const srv = await startServer({ ...opt, dump: null, pick: false }, { onExit: () => process.exit(0) });
  console.log(t('ui.address', { url: srv.url }));
  if (process.env.PBZ_NO_BROWSER === '1') return; // test hook: serve only, open nothing
  const w = openWindow(srv.url, { noEdge: opt.noEdge });
  if (w.kind === 'edge' || w.kind === 'chrome') console.log(t('ui.openedApp', { browser: w.kind === 'edge' ? 'Microsoft Edge' : 'Google Chrome' }));
  else if (w.kind === 'default') console.log(t('ui.openedDefault'));
  else console.log(t('ui.openManually', { url: srv.url }));
}

function fatalBox(e) {
  const { showError } = require('./lib/picker');
  showError('pbz-tracker', t('ui.startFail', { msg: e && e.message ? e.message : String(e) }));
}

// ---- terminal mode ----
async function mainCli(opt) {
  if (INTERACTIVE) opt.watch = true;
  if (opt.version) { console.log(`pbz-tracker ${VERSION}`); return; }
  if (opt.help) { process.stdout.write(t('help')); return; }

  if (opt.forget) { forgetConfig(); console.log(t('cfg.forgotten')); }
  const cfg = opt.forget ? {} : readConfig();
  // Pickers: on request (--pick), or when nothing was given by flag (double-click, dropped paths,
  // plain run in a terminal). Never with --game/--save/--exe or --no-dialog.
  const dialogs = opt.pick || (!opt.noDialog && !opt.explicitPaths && (INTERACTIVE || !!process.stdin.isTTY));
  const s = await createSession(opt, { dialogs, cfg });

  const read = async () => {
    const r = await s.read();
    return { sig: r.sig, view: (show) => render({ st: r.st, result: r.result, names: s.names, build: s.gameBuild, data: s.dataInfo, color: opt.color, show, changes: r.changes, hiddenKey: opt.watch && process.stdin.isTTY }) };
  };

  if (!opt.watch) { console.log((await read()).view(opt.show)); return; }

  // ---- watch mode ----
  const tty = !!process.stdin.isTTY;
  let last = null, show = opt.show, statusLine = '';
  const paint = () => {
    if (!last) return;
    if (opt.color) process.stdout.write('\x1b[2J\x1b[H');
    console.log(last.view(show));
    console.log(`\n${statusLine}`);
  };
  const stamp = () => new Date().toLocaleTimeString(i18n.getLang() === 'tr' ? 'tr-TR' : 'en-GB');
  const w = watchSave({
    savePath: s.savePath,
    interval: opt.interval,
    read,
    onRead: (r) => {
      last = r;
      show = opt.show;              // hidden sections close again on every refresh
      statusLine = t('watching', { time: stamp(), keys: tty ? t('watchKeys') : t('watchKeysNoTty') });
      paint();
    },
    onError: (e) => console.error(`\n${t('readFail', { time: stamp(), msg: e.message })}`),
  });
  await w.start();

  if (tty) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (d) => {
      const k = d.toString();
      if (k === '\u0003' || k.toLowerCase() === 'q') process.exit(0);
      if (k.toLowerCase() === 'g') { show = !show; paint(); }
    });
  }
}

let OPT = null;
async function main() {
  // Language first, so argument errors are already localised. The window mode also honours the
  // language chosen in its settings (pbz-tracker.config.json) unless --lang is given.
  const langIdx = process.argv.indexOf('--lang');
  if (langIdx > 0 && process.argv[langIdx + 1]) i18n.setLang(process.argv[langIdx + 1].toLowerCase());
  else if (UI_MODE) { const l = readConfig().uiLang; if (l === 'tr' || l === 'en') i18n.setLang(l); }
  const opt = parseArgs(RAW_ARGS);
  OPT = opt;
  if (opt.lang) i18n.setLang(opt.lang);
  if (UI_MODE && !opt.help && !opt.version) return mainUi(opt);
  return mainCli(opt);
}

main().catch(async (e) => {
  if (OPT?.uiChild || RAW_ARGS.includes('--ui-child')) { fatalBox(e); process.exit(1); }
  console.error(t('err.prefix', { msg: e.message }));
  if (INTERACTIVE) await waitForKey();
  process.exit(1);
});
