'use strict';
// Locates the game folder, the newest save and an Oodle DLL. Read-only lookups.
const fs = require('fs');
const path = require('path');

const STEAM_DEFAULT = 'C:/Program Files (x86)/Steam';
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const ls = (p) => { try { return fs.readdirSync(p); } catch { return []; } };

function steamLibraries() {
  const libs = [STEAM_DEFAULT];
  try {
    const vdf = fs.readFileSync(path.join(STEAM_DEFAULT, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libs.push(m[1].replace(/\\\\/g, '/'));
  } catch { /* no Steam config: fall back to defaults */ }
  libs.push('D:/SteamLibrary');
  const seen = new Map();
  for (const l of libs) { const r = path.resolve(l); if (!seen.has(r.toLowerCase())) seen.set(r.toLowerCase(), r); }
  return [...seen.values()];
}

function findGameDir(explicit) {
  if (explicit) {
    if (!isDir(explicit)) throw new Error(`Oyun klasörü yok: ${explicit}`);
    return explicit;
  }
  for (const lib of steamLibraries()) {
    const d = path.join(lib, 'steamapps', 'common', 'PBZ');
    if (isFile(path.join(d, 'platform', 'steam', 'PBZ.exe'))) return d;
  }
  throw new Error('PBZ oyun klasörü bulunamadı. --game "D:/SteamLibrary/steamapps/common/PBZ" ile ver.');
}

function findExe(gameDir, explicit) {
  const exe = explicit || path.join(gameDir, 'platform', 'steam', 'PBZ.exe');
  if (!isFile(exe)) throw new Error(`PBZ.exe bulunamadı: ${exe}`);
  return exe;
}

// Main save only (PBZSaveGame.sav); backup subfolders are ignored. Newest SteamID folder wins.
function findSave(gameDir, explicit) {
  if (explicit) {
    if (!isFile(explicit)) throw new Error(`Save dosyası yok: ${explicit}`);
    return explicit;
  }
  const root = path.join(gameDir, 'ProjectPBZ', 'Saved', 'SaveGames', 'Steam');
  const cands = ls(root).map((id) => path.join(root, id, 'PBZSaveGame.sav')).filter(isFile);
  if (cands.length === 0) throw new Error(`Save bulunamadı: ${root}/<SteamID>/PBZSaveGame.sav`);
  cands.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return cands[0];
}

// PBZ links Oodle statically, so a compatible oo2core DLL is borrowed (in place, never copied) from another game.
function findOodle(explicit) {
  if (explicit) {
    if (!isFile(explicit)) throw new Error(`Oodle DLL yok: ${explicit}`);
    return explicit;
  }
  if (process.env.PBZ_OODLE && isFile(process.env.PBZ_OODLE)) return process.env.PBZ_OODLE;
  const found = [];
  const pick = (dir) => { for (const f of ls(dir)) if (/^oo2core_\d+_win64\.dll$/i.test(f)) found.push(path.join(dir, f)); };
  for (const lib of steamLibraries()) {
    const common = path.join(lib, 'steamapps', 'common');
    for (const game of ls(common)) {
      if (game === 'PBZ') continue;
      const g = path.join(common, game);
      pick(g);
      pick(path.join(g, 'Engine', 'Binaries', 'ThirdParty', 'Oodle', 'Win64'));
      for (const sub of ls(g)) pick(path.join(g, sub, 'Binaries', 'Win64'));
    }
  }
  // Prefer oo2core_8 (verified), then the highest version.
  found.sort((a, b) => {
    const va = +path.basename(a).match(/\d+/)[0], vb = +path.basename(b).match(/\d+/)[0];
    return (vb === 8) - (va === 8) || vb - va;
  });
  if (found.length === 0) throw new Error('oo2core_*_win64.dll bulunamadı. --oodle ile ya da PBZ_OODLE ortam değişkeniyle yolunu ver.');
  return found[0];
}

module.exports = { findGameDir, findExe, findSave, findOodle };
