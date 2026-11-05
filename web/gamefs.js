'use strict';
// Read-only lookups in the game folder through File System Access handles (the browser counterpart of
// lib/paths.js). Only directory listing (values()), getFile() and child lookups are used; nothing is
// ever written. Names are matched case-insensitively, as on Windows.
//
//   async resolveGame(dir) → { game, apps, buildId, installdir } | null
//     dir: the game folder itself, a Steam library folder or its steamapps folder.
//   async findExe(game) → file handle | null     platform/steam/PBZ.exe, platform/*/PBZ.exe, PBZ.exe
//   async paksDir(game) → directory handle | null   ProjectPBZ/Content/Paks
//   async saveCandidates(game) → [{ id, platform, handle, lastModified }], newest first, one per id
//   async readManifest(dir) → { buildId, installdir, apps } | null   (dir: library, steamapps or the acf's folder)
//   async listFileNames(dir) → string[]
const APP_ID = '4115450';
const ACF = `appmanifest_${APP_ID}.acf`;

async function children(dir) {
  const out = [];
  for await (const h of dir.values()) out.push(h);
  return out;
}

async function child(dir, name, kind) {
  if (!dir) return null;
  const low = name.toLowerCase();
  for await (const h of dir.values()) if (h.kind === kind && h.name.toLowerCase() === low) return h;
  return null;
}

async function walk(dir, parts, lastKind = 'directory') {
  let cur = dir;
  for (let i = 0; i < parts.length && cur; i++) cur = await child(cur, parts[i], i === parts.length - 1 ? lastKind : 'directory');
  return cur;
}

async function findExe(game) {
  const steam = await walk(game, ['platform', 'steam', 'PBZ.exe'], 'file');
  if (steam) return steam;
  const platform = await child(game, 'platform', 'directory');
  if (platform) {
    for (const p of await children(platform)) {
      if (p.kind !== 'directory') continue;
      const exe = await child(p, 'PBZ.exe', 'file');
      if (exe) return exe;
    }
  }
  return child(game, 'PBZ.exe', 'file');
}

// A game folder has both the exe and the ProjectPBZ content folder.
async function isGameDir(dir) {
  return !!(await child(dir, 'ProjectPBZ', 'directory')) && !!(await findExe(dir));
}

async function readText(fileHandle) {
  const f = await fileHandle.getFile();
  if (f.size > 1 << 20) return ''; // an app manifest is a few KB
  return new TextDecoder().decode(new Uint8Array(await f.arrayBuffer()));
}

// Steam app manifest of the game: in `dir` itself (steamapps), or in dir/steamapps (library root).
async function readManifest(dir) {
  for (const apps of [dir, await child(dir, 'steamapps', 'directory')]) {
    if (!apps) continue;
    const acf = await child(apps, ACF, 'file');
    if (!acf) continue;
    try {
      const text = await readText(acf);
      return {
        apps,
        buildId: (/"buildid"\s+"(\d+)"/.exec(text) || [])[1] || null,
        installdir: (/"installdir"\s+"([^"]+)"/.exec(text) || [])[1] || null,
      };
    } catch { return { apps, buildId: null, installdir: null }; }
  }
  return null;
}

async function resolveGame(dir) {
  if (await isGameDir(dir)) return { game: dir, apps: null, buildId: null, installdir: null };
  // A Steam library (or its steamapps folder): steamapps/common/<installdir or PBZ>.
  const apps = dir.name.toLowerCase() === 'steamapps' ? dir : await child(dir, 'steamapps', 'directory');
  if (!apps) return null;
  const m = await readManifest(apps);
  const common = await child(apps, 'common', 'directory');
  for (const name of [m?.installdir, 'PBZ'].filter(Boolean)) {
    const g = await child(common, name, 'directory');
    if (g && await isGameDir(g)) return { game: g, apps, buildId: m?.buildId || null, installdir: name };
  }
  return null;
}

const paksDir = (game) => walk(game, ['ProjectPBZ', 'Content', 'Paks']);

// Main save (PBZSaveGame.sav) per account folder (SaveGames/<platform>/<id>); backup subfolders are ignored.
async function saveCandidates(game) {
  const base = await walk(game, ['ProjectPBZ', 'Saved', 'SaveGames']);
  if (!base) return [];
  const out = [];
  for (const platform of await children(base)) {
    if (platform.kind !== 'directory') continue;
    for (const acct of await children(platform)) {
      if (acct.kind !== 'directory') continue;
      const handle = await child(acct, 'PBZSaveGame.sav', 'file');
      if (!handle) continue;
      let lastModified = 0;
      try { lastModified = (await handle.getFile()).lastModified; } catch { /* listed, but unreadable right now */ }
      out.push({ id: acct.name, platform: platform.name, handle, lastModified });
    }
  }
  out.sort((a, b) => b.lastModified - a.lastModified);
  const seen = new Set();
  return out.filter((c) => !seen.has(c.id) && seen.add(c.id));
}

async function listFileNames(dir) {
  return (await children(dir)).filter((h) => h.kind === 'file').map((h) => h.name);
}

module.exports = { resolveGame, findExe, paksDir, saveCandidates, readManifest, listFileNames, child, isGameDir, APP_ID };
