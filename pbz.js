#!/usr/bin/env node
'use strict';
// Phantom Blade Zero missables tracker. Strictly read-only: never writes to the save, its backups or game files.
const fs = require('fs');
const path = require('path');
const i18n = require('./lib/i18n');
const { t } = i18n;
const { deriveKey } = require('./lib/key');
const { loadSave } = require('./lib/savefile');
const { findGameDir, findExe, findSave } = require('./lib/paths');
const { extract } = require('./lib/state');
const { build, render, statusMap, diff } = require('./lib/report');
const { createNames } = require('./lib/names');
const RULES = require('./data/rules.json');
const NAMES = require('./data/names.json');

const DEBOUNCE_MS = 1500;

function parseArgs(argv) {
  const o = { watch: false, show: false, dump: null, color: !!process.stdout.isTTY && !process.env.NO_COLOR, interval: 5, lang: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(t('err.needsValue', { o: a })); return argv[++i]; };
    switch (a) {
      case '-w': case '--watch': o.watch = true; break;
      case '--show': o.show = true; break;
      case '--lang': o.lang = val().toLowerCase(); break;
      case '--steamid': o.steamId = val(); break;
      case '--dump': o.dump = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : path.join(process.cwd(), 'out'); break;
      case '--save': o.save = val(); break;
      case '--game': o.game = val(); break;
      case '--exe': o.exe = val(); break;
      case '--interval': o.interval = Math.min(3600, Math.max(2, Number(val()) || 5)); break;
      case '--no-color': o.color = false; break;
      case '-h': case '--help': o.help = true; break;
      default: throw new Error(t('err.unknownOpt', { o: a }));
    }
  }
  return o;
}

// Resolve through junctions/symlinks using the deepest existing ancestor.
function realish(p) {
  let cur = path.resolve(p), rest = [];
  for (;;) {
    try { return path.join(fs.realpathSync.native(cur), ...rest).toLowerCase(); } catch { /* go up */ }
    const up = path.dirname(cur);
    if (up === cur) return path.resolve(p).toLowerCase();
    rest.unshift(path.basename(cur)); cur = up;
  }
}
const inside = (child, parent) => child === parent || child.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);

// Decrypted JSON must never land in the game folder or next to the save/backups.
function safeDumpDir(dir, protectedDirs) {
  const d = realish(dir);
  for (const p of protectedDirs) if (inside(d, realish(p))) throw new Error(t('err.dumpInGame'));
  return path.resolve(dir);
}

async function main() {
  // Language first, so argument errors are already localised.
  const langIdx = process.argv.indexOf('--lang');
  if (langIdx > 0 && process.argv[langIdx + 1]) i18n.setLang(process.argv[langIdx + 1].toLowerCase());
  const opt = parseArgs(process.argv.slice(2));
  if (opt.lang) i18n.setLang(opt.lang);
  if (opt.help) { process.stdout.write(t('help')); return; }

  const gameDir = findGameDir(opt.game || (opt.exe ? path.resolve(path.dirname(opt.exe), '..', '..') : undefined));
  const exe = findExe(gameDir, opt.exe);
  const savePath = await findSave(gameDir, { explicit: opt.save, steamId: opt.steamId });
  const key = deriveKey(exe); // kept in memory only, never written
  const n = createNames({ gameDir, lang: i18n.getLang() });
  const names = {
    quest: (id) => n.quest(id),
    region: (code) => (code ? n.region(code) : null),
    missable: (id) => n.missable(id),
    known: (id) => !!NAMES.quests?.[id],
    notice: n.notice,
  };
  const protectedDirs = [gameDir, path.dirname(savePath), path.dirname(exe)];

  let prev = null;
  const read = async () => {
    const save = await loadSave({ savePath, key });
    const st = extract(save.latest.data);
    const result = build(st, RULES, names);
    const now = statusMap(result);
    const changes = diff(prev, now);
    prev = now;
    if (opt.dump) {
      const dir = safeDumpDir(opt.dump, protectedDirs);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(save.latest.data, null, 1));
    }
    return { sig: save.sig, view: (show) => render({ st, result, names, color: opt.color, show, changes, hiddenKey: opt.watch && process.stdin.isTTY }) };
  };

  if (!opt.watch) { console.log((await read()).view(opt.show)); return; }

  // ---- watch mode ----
  const tty = !!process.stdin.isTTY;
  let last = null, show = opt.show, lastSig = '', busy = false, pending = false, timer = null, statusLine = '';
  const sig = () => { try { const s = fs.statSync(savePath); return `${s.mtimeMs}:${s.size}`; } catch { return ''; } };
  const paint = () => {
    if (!last) return;
    if (opt.color) process.stdout.write('\x1b[2J\x1b[H');
    console.log(last.view(show));
    console.log(`\n${statusLine}`);
  };
  const stamp = () => new Date().toLocaleTimeString(i18n.getLang() === 'tr' ? 'tr-TR' : 'en-GB');
  const refresh = async () => {
    timer = null;
    if (busy) { pending = true; return; }
    const before = sig();
    if (last && before === lastSig) return; // already showing these bytes
    busy = true;
    try {
      last = await read();
      lastSig = last.sig;           // signature of the bytes actually decoded
      show = opt.show;              // hidden sections close again on every refresh
      statusLine = t('watching', { time: stamp(), keys: tty ? t('watchKeys') : t('watchKeysNoTty') });
      paint();
    } catch (e) {
      lastSig = before;             // retry only when the file changes again
      console.error(`\n${t('readFail', { time: stamp(), msg: e.message })}`);
    } finally {
      busy = false;
      if (pending || sig() !== lastSig) { pending = false; schedule(); }
    }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, DEBOUNCE_MS); };

  await refresh();
  const base = path.basename(savePath).toLowerCase();
  try {
    fs.watch(path.dirname(savePath), (ev, file) => { if (!file || file.toLowerCase() === base) schedule(); })
      .on('error', () => { /* folder vanished: polling keeps working */ });
  } catch { /* polling below still works */ }
  setInterval(() => { if (!busy && !timer && sig() !== lastSig) schedule(); }, opt.interval * 1000);

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

main().catch((e) => { console.error(t('err.prefix', { msg: e.message })); process.exit(1); });
