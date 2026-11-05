'use strict';
// Locates Steam, the game install (AppID 4115450, or common folders / a dropped path) and the player's save.
// Read-only lookups only.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { t } = require('./i18n');

const APP_ID = '4115450';
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const ls = (p) => { try { return fs.readdirSync(p); } catch { return []; } };

// SteamPath from the registry (reg.exe ships with Windows), then the usual install folders.
function steamRoots() {
  const roots = [];
  const query = (hive, key, value) => {
    try {
      const out = execFileSync('reg.exe', ['query', `${hive}\\${key}`, '/v', value], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      const m = new RegExp(`${value}\\s+REG_\\w+\\s+(.+)`).exec(out);
      if (m) roots.push(m[1].trim());
    } catch { /* key missing */ }
  };
  if (process.platform === 'win32') {
    query('HKCU', 'Software\\Valve\\Steam', 'SteamPath');
    query('HKLM', 'SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath');
    query('HKLM', 'SOFTWARE\\Valve\\Steam', 'InstallPath');
  }
  roots.push('C:/Program Files (x86)/Steam', 'C:/Program Files/Steam');
  return dedupe(roots.filter(isDir));
}

function dedupe(list) {
  const seen = new Map();
  for (const l of list) { const r = path.resolve(l); if (!seen.has(r.toLowerCase())) seen.set(r.toLowerCase(), r); }
  return [...seen.values()];
}

function steamLibraries() {
  const libs = [];
  for (const root of steamRoots()) {
    libs.push(root);
    try {
      const vdf = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
      for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libs.push(m[1].replace(/\\\\/g, '\\'));
    } catch { /* no library file */ }
  }
  return dedupe(libs.filter(isDir));
}

// Steam build id of the installed game, from <library>/steamapps/appmanifest_<AppID>.acf. Null if unknown.
function findBuildId(gameDir) {
  try {
    const apps = path.resolve(gameDir, '..', '..'); // <library>/steamapps/common/<dir> → <library>/steamapps
    const acf = fs.readFileSync(path.join(apps, `appmanifest_${APP_ID}.acf`), 'utf8');
    return (/"buildid"\s+"(\d+)"/.exec(acf) || [])[1] || null;
  } catch { return null; }
}

// PBZ.exe inside a game folder: platform/steam first, then any other platform folder, then the root.
function exeIn(gameDir) {
  const cands = [path.join(gameDir, 'platform', 'steam', 'PBZ.exe')];
  for (const p of ls(path.join(gameDir, 'platform'))) cands.push(path.join(gameDir, 'platform', p, 'PBZ.exe'));
  cands.push(path.join(gameDir, 'PBZ.exe'));
  return cands.find(isFile) || cands[0];
}
// A game folder has both the exe and the ProjectPBZ content folder (so platform\steam itself does not count).
const isGameDir = (d) => isDir(d) && isDir(path.join(d, 'ProjectPBZ')) && isFile(exeIn(d));

// Walk up from any path inside an install (save file, exe, ProjectPBZ folder) to the game folder.
function gameFromPath(p) {
  let cur = path.resolve(p);
  for (let i = 0; i < 10; i++) {
    if (isGameDir(cur)) return cur;
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  return null;
}

// Common install folders outside Steam's own records (moved libraries, other launchers).
function fixedCandidates() {
  const out = [];
  if (process.platform !== 'win32') return out;
  for (const L of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
    const root = `${L}:\\`;
    if (!isDir(root)) continue;
    out.push(path.join(root, 'SteamLibrary', 'steamapps', 'common', 'PBZ'),
      path.join(root, 'Program Files (x86)', 'Steam', 'steamapps', 'common', 'PBZ'),
      path.join(root, 'Program Files', 'Steam', 'steamapps', 'common', 'PBZ'),
      path.join(root, 'Games', 'PBZ'));
  }
  return out;
}

function findGameDir(explicit) {
  if (explicit) {
    if (!isDir(explicit)) throw new Error(t('err.gameDir', { p: explicit }));
    const g = gameFromPath(explicit);
    if (!g) throw new Error(t('err.noExe', { p: explicit }));
    return g;
  }
  for (const lib of steamLibraries()) {
    const apps = path.join(lib, 'steamapps');
    let installdir = null;
    try {
      const acf = fs.readFileSync(path.join(apps, `appmanifest_${APP_ID}.acf`), 'utf8');
      installdir = (/"installdir"\s+"([^"]+)"/.exec(acf) || [])[1] || null;
    } catch { /* not in this library */ }
    for (const name of [installdir, 'PBZ'].filter(Boolean)) {
      const d = path.join(apps, 'common', name);
      if (isGameDir(d)) return d;
    }
  }
  for (const d of fixedCandidates()) if (isGameDir(d)) return d;
  throw new Error(t('err.noGame'));
}

function findExe(gameDir, explicit) {
  const exe = explicit || exeIn(gameDir);
  if (!isFile(exe)) throw new Error(t('err.noExe', { p: exe }));
  return exe;
}

// Main save (PBZSaveGame.sav) per account folder (SaveGames/<platform>/<id>); backup subfolders are ignored.
function savesUnder(root) {
  const out = [];
  for (const id of ls(root)) {
    const f = path.join(root, id, 'PBZSaveGame.sav');
    if (isFile(f)) out.push({ id, file: f, mtime: fs.statSync(f).mtime });
  }
  return out;
}

function saveCandidates(gameDir) {
  const bases = [path.join(gameDir, 'ProjectPBZ', 'Saved', 'SaveGames')];
  if (process.env.LOCALAPPDATA) bases.push(path.join(process.env.LOCALAPPDATA, 'ProjectPBZ', 'Saved', 'SaveGames'));
  const out = [];
  for (const base of bases) for (const platform of ls(base)) out.push(...savesUnder(path.join(base, platform)));
  out.sort((a, b) => b.mtime - a.mtime);
  const seen = new Set();
  return out.filter((c) => !seen.has(c.id) && seen.add(c.id)); // same account id in two roots → newest
}

// A path given without a flag (drag & drop onto the exe): what is it?
// → { save?, game?, exe? } or null when it is not recognised.
function classifyPath(p) {
  const abs = path.resolve(p);
  if (isFile(abs)) {
    if (/\.sav$/i.test(abs)) return { save: abs };
    if (/^pbz\.exe$/i.test(path.basename(abs))) return { exe: abs, game: gameFromPath(path.dirname(abs)) };
    return null;
  }
  if (!isDir(abs)) return null;
  const direct = path.join(abs, 'PBZSaveGame.sav');
  if (isFile(direct)) return { save: direct };                     // SaveGames\Steam\<id>
  if (isGameDir(abs)) return { game: abs };                        // game folder
  const saves = savesUnder(abs).sort((a, b) => b.mtime - a.mtime);  // SaveGames\Steam
  if (saves.length) return { save: saves[0].file };
  const g = gameFromPath(abs);                                      // a folder inside the install (ProjectPBZ, platform, ...)
  return g ? { game: g } : null;
}

async function ask(question) {
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  try { return await new Promise((r) => rl.question(question, r)); } finally { rl.close(); }
}

// More than one Steam account → ask (or use --steamid). Non-interactive: newest, with a notice.
async function findSave(gameDir, { explicit, steamId } = {}) {
  if (explicit) {
    if (!isFile(explicit)) throw new Error(t('err.noSaveFile', { p: explicit }));
    return explicit;
  }
  const cands = saveCandidates(gameDir);
  if (cands.length === 0) throw new Error(t('err.noSave', { p: path.join(gameDir, 'ProjectPBZ', 'Saved', 'SaveGames', 'Steam') }));
  if (steamId) {
    const c = cands.find((x) => x.id === String(steamId));
    if (!c) throw new Error(t('err.noSteamId', { id: steamId, ids: cands.map((x) => x.id).join(', ') }));
    return c.file;
  }
  if (cands.length === 1) return cands[0].file;
  if (!process.stdin.isTTY) {
    console.error(t('msg.multiSaveAuto', { id: cands[0].id }));
    return cands[0].file;
  }
  console.log(t('msg.multiSave'));
  cands.forEach((c, i) => console.log(`  ${i + 1}) ${c.id}  (${c.mtime.toLocaleString()})`));
  const ans = (await ask(t('msg.pick', { n: cands.length }))).trim();
  const i = ans === '' ? 0 : Number(ans) - 1;
  if (!(i >= 0 && i < cands.length)) throw new Error(t('err.badPick'));
  return cands[i].file;
}

module.exports = { findGameDir, findExe, findSave, findBuildId, steamLibraries, classifyPath, gameFromPath };
