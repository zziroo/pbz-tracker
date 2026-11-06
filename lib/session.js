'use strict';
// One "session" = everything needed to read one save: game folder, PBZ.exe, save path, key, rules and
// names, plus the read → extract → build pipeline, for the terminal version (pbz.js). Strictly read-only
// towards the game, the save and the patches; the only write is the optional --dump output.
const fs = require('fs');
const path = require('path');
const i18n = require('./i18n');
const { t } = i18n;
const { deriveKey } = require('./key');
const { loadSave } = require('./savefile');
const { findGameDir, findExe, findSave, findBuildId, gameFromPath } = require('./paths');
const { TESTED_BUILDS } = require('./version');
const { extract } = require('./state');
const { build, statusMap, diff } = require('./report');
const { createNames, EMBEDDED_TABLES } = require('./names');
const { findTextPatches, looksTurkish } = require('./locres');
const { loadRules, loadNameTables } = require('./datafiles');
const { readConfig } = require('./config');
const EMBEDDED_RULES = require('../data/rules.json');
const NAMES = require('../data/names.json');

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

const exists = (p, dir) => { try { const s = fs.statSync(p); return dir ? s.isDirectory() : s.isFile(); } catch { return false; } };

// The key is derived by scanning PBZ.exe (large). Cache it in memory per exe file version, so a second
// session in the same process does not rescan. Never written anywhere. The cache holds the pending
// derivation (concurrent sessions share one scan); a failed one is dropped again.
const keyCache = new Map();
function keyFor(exe) {
  let id = exe;
  try { const s = fs.statSync(exe); id = `${path.resolve(exe).toLowerCase()}|${s.size}|${s.mtimeMs}`; } catch { /* deriveKey reports it */ }
  if (!keyCache.has(id)) {
    const p = deriveKey(exe);
    keyCache.set(id, p);
    p.catch(() => { if (keyCache.get(id) === p) keyCache.delete(id); });
  }
  return keyCache.get(id);
}

/**
 * Resolve paths, key, rules and names.
 *   opt:     parsed options (game, save, exe, steamId, rules, names, dump, exact)
 *   prompt:  allow asking on the terminal when several Steam accounts exist
 *   cfg:     the stored config (readConfig() by default): a remembered gameDir / savePath
 * Errors are thrown with localized messages, in the same order as v0.3.
 */
async function createSession(opt, { prompt = !!process.stdin.isTTY, cfg = readConfig() } = {}) {
  // Game folder: explicit / derived from a given path → remembered → Steam + common folders.
  const hint = opt.game || (opt.exe && gameFromPath(path.dirname(opt.exe))) || (opt.save && gameFromPath(path.dirname(opt.save))) || undefined;
  let gameDir, gameDirSource;
  if (hint) {
    gameDir = findGameDir(hint); gameDirSource = 'arg';
  } else if (cfg.gameDir && exists(cfg.gameDir, true) && gameFromPath(cfg.gameDir)) {
    gameDir = gameFromPath(cfg.gameDir); gameDirSource = 'config';
  } else {
    try {
      gameDir = findGameDir(); gameDirSource = 'auto';
    } catch (e) {
      throw new Error(opt.save ? t('err.noGameForSave') : e.message);
    }
  }
  const patches = await findTextPatches(gameDir);
  i18n.applyAutoLang(patches.some((p) => looksTurkish(p.map)));
  const exe = findExe(gameDir, opt.exe);

  // Save: explicit → remembered → automatic.
  let savePath, savePathSource;
  if (opt.save) {
    savePath = await findSave(gameDir, { explicit: opt.save, prompt }); savePathSource = 'arg';
  } else if (cfg.savePath && exists(cfg.savePath, false)) {
    savePath = cfg.savePath; savePathSource = 'config';
  } else {
    savePath = await findSave(gameDir, { steamId: opt.steamId, prompt }); savePathSource = 'auto';
  }
  const buildId = findBuildId(gameDir);
  const gameBuild = { id: buildId, tested: !!buildId && TESTED_BUILDS.includes(buildId) };
  let key;
  try {
    key = await keyFor(exe); // kept in memory only, never written
  } catch (e) {
    throw new Error(`${e.message} ${t('err.keyBuild', { build: buildId || '?', tested: TESTED_BUILDS.join(', ') })}`);
  }
  const rulesInfo = loadRules({ explicit: opt.rules, embedded: EMBEDDED_RULES });
  const rules = rulesInfo.rules;
  const nameTables = loadNameTables(EMBEDDED_TABLES);
  const dataInfo = { rules: rulesInfo, nameFiles: nameTables.files };
  const protectedDirs = [gameDir, path.dirname(savePath), path.dirname(exe)];

  // Name lookup used by build()/render().
  const makeNames = async (namesOpt, found) => {
    const n = await createNames({ gameDir, uiLang: i18n.getLang(), names: namesOpt, tables: nameTables.tables, patches: found });
    return {
      source: n.source,
      quest: (id) => n.quest(id),
      region: (code, bell) => (code || bell ? n.region(code, bell) : null),
      missable: (id) => n.missable(id),
      known: (id) => !!NAMES.quests?.[id],
      get notice() { return n.notice; },
    };
  };

  const names = await makeNames(opt.names, patches);
  let before = null, last = null; // status maps for "changed since the previous read"
  const s = {
    opt, gameDir, gameDirSource, exe, savePath, savePathSource, buildId, gameBuild,
    rulesInfo, rules, dataInfo, nameTables, protectedDirs,
    names,
    exact: !!opt.exact,          // name places/bosses in the warnings (only for areas reached, see report.js)
    // build() + change list since the previous read.
    evaluate(st) {
      const result = build(st, rules, s.names, { exact: s.exact });
      const now = statusMap(result);
      before = last;
      last = now;
      return { result, changes: diff(before, now) };
    },
    // Decode the save (in memory) and evaluate it. → { sig, st, result, changes, latest }
    async read() {
      const save = await loadSave({ savePath, key });
      const st = extract(save.latest.data);
      const { result, changes } = s.evaluate(st);
      if (opt.dump) {
        const dir = safeDumpDir(opt.dump, protectedDirs);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(save.latest.data, null, 1));
      }
      return { sig: save.sig, st, result, changes };
    },
  };
  return s;
}

module.exports = { createSession, safeDumpDir };
