#!/usr/bin/env node
'use strict';
// Phantom Blade Zero missables tracker, terminal version (for developers and rule analysis; players use
// the web version, see README). Strictly read-only: never writes to the save, its backups or game files.
// Engine: lib/session.js; output: lib/report.js render. `--cli` is accepted for compatibility (no-op).
const fs = require('fs');
const path = require('path');
const i18n = require('./lib/i18n');
const { t } = i18n;
const { classifyPath } = require('./lib/paths');
const { VERSION } = require('./lib/version');
const { render } = require('./lib/report');
const { readConfig, forgetConfig } = require('./lib/config');
const { createSession, safeDumpDir } = require('./lib/session');
const { watchSave } = require('./lib/watch');
const { sigOf } = require('./lib/savefile');

// --archive: keep a copy of every save the tool reads (the raw .sav and the decoded newest slot), named by
// the save's own date, so the rules can be checked against the real play history afterwards. The same save
// date is never written twice. A copy whose bytes differ from the ones just decoded (the game wrote in
// between) is discarded; the next read archives that save. Never throws (archiving must not stop the report).
//   archiveSave(dir, { savePath, sig, st, latest }) → saved base name | null
function archiveSave(dir, { savePath, sig, st, latest }) {
  try {
    const stamp = (st.dateTime || 'unknown-date').replace(/[^0-9A-Za-z.-]/g, '_');
    const base = path.join(dir, `PBZSaveGame-${stamp}`);
    if (fs.existsSync(`${base}.sav`)) return null;
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(savePath, `${base}.sav.tmp`);
    if (sigOf(fs.statSync(savePath)) !== sig) { fs.unlinkSync(`${base}.sav.tmp`); return null; }
    fs.renameSync(`${base}.sav.tmp`, `${base}.sav`);
    fs.writeFileSync(`${base}.json`, JSON.stringify(latest, null, 1));
    return path.basename(base);
  } catch (e) {
    console.error(t('archiveFail', { msg: e.message }));
    return null;
  }
}

function parseArgs(argv) {
  const o = { watch: false, show: false, dump: null, color: !!process.stdout.isTTY && !process.env.NO_COLOR, interval: 5, lang: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(t('err.needsValue', { o: a })); return argv[++i]; };
    switch (a) {
      case '-w': case '--watch': o.watch = true; break;
      case '--show': o.show = true; break;
      case '--exact': o.exact = true; break;
      case '--lang': o.lang = val().toLowerCase(); break;
      case '--names': o.names = val(); break;
      case '--rules': o.rules = val(); break;
      case '--steamid': o.steamId = val(); break;
      case '--dump': o.dump = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : path.join(process.cwd(), 'out'); break;
      case '--archive': o.archive = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : path.join(process.cwd(), 'archive'); break;
      case '--save': o.save = val(); break;
      case '--game': o.game = val(); break;
      case '--exe': o.exe = val(); break;
      case '--forget': o.forget = true; break;
      case '--interval': o.interval = Math.min(3600, Math.max(2, Number(val()) || 5)); break;
      case '--no-color': o.color = false; break;
      case '--cli': break; // the terminal is the only mode now; kept so older command lines still work
      case '-h': case '--help': o.help = true; break;
      case '-v': case '--version': o.version = true; break;
      default: {
        if (a.startsWith('-')) throw new Error(t('err.unknownOpt', { o: a }));
        // Path without a flag: save file, save folder, game folder or PBZ.exe.
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

async function main() {
  // Language first, so argument errors are already localised.
  const langIdx = process.argv.indexOf('--lang');
  if (langIdx > 0 && process.argv[langIdx + 1]) i18n.setLang(process.argv[langIdx + 1].toLowerCase());
  const opt = parseArgs(process.argv.slice(2));
  if (opt.lang) i18n.setLang(opt.lang);
  if (opt.version) { console.log(`pbz-tracker ${VERSION}`); return; }
  if (opt.help) { process.stdout.write(t('help')); return; }

  if (opt.forget) { forgetConfig(); console.log(t('cfg.forgotten')); }
  const cfg = opt.forget ? {} : readConfig();
  const s = await createSession(opt, { cfg });

  const archiveDir = opt.archive ? safeDumpDir(opt.archive, s.protectedDirs) : null;
  const read = async () => {
    const r = await s.read();
    const archived = archiveDir ? archiveSave(archiveDir, { savePath: s.savePath, sig: r.sig, st: r.st, latest: r.latest }) : null;
    return { sig: r.sig, archived, view: (show) => render({ st: r.st, result: r.result, names: s.names, build: s.gameBuild, data: s.dataInfo, color: opt.color, show, changes: r.changes, hiddenKey: opt.watch && process.stdin.isTTY }) };
  };

  if (!opt.watch) {
    const r = await read();
    console.log(r.view(opt.show));
    if (r.archived) console.log(t('archived', { file: r.archived }));
    return;
  }

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
      statusLine = t('watching', { time: stamp(), keys: tty ? t('watchKeys') : t('watchKeysNoTty') })
        + (r.archived ? ` · ${t('archived', { file: r.archived })}` : '');
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

main().catch((e) => {
  console.error(t('err.prefix', { msg: e.message }));
  process.exit(1);
});
