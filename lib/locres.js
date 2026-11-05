'use strict';
// Node wrapper for text patches: lists ProjectPBZ/Content/Paks and hands each .pak to the portable
// scanner in lib/core/locres.js through read-only positioned fs reads (big paks are never read whole).
//   async findTextPatches(gameDir) → info[]   (never throws)
//   async inspectPak(pakPath) → info
//   parseLocres, looksTurkish: re-exported from the core
const fs = require('fs');
const path = require('path');
const core = require('./core/locres');
const { openFileReader } = require('./fsreader');

const paksDir = (gameDir) => path.join(gameDir, 'ProjectPBZ', 'Content', 'Paks');

async function inspectPak(pakPath) {
  let r;
  try {
    r = await openFileReader(pakPath);
  } catch (err) {
    return { ...core.emptyInfo(path.basename(pakPath), pakPath), error: err.message };
  }
  try { return await core.inspectPak(r, { name: path.basename(pakPath), pakPath }); } finally { await r.close().catch(() => {}); }
}

// All readable text patches: unencrypted .pak files in Paks/ that carry a Game.locres. Never throws.
async function findTextPatches(gameDir) {
  if (!gameDir) return [];
  const dir = paksDir(gameDir);
  return core.findTextPatchesFrom(() => fs.readdirSync(dir), (f) => openFileReader(path.join(dir, f)));
}

module.exports = { findTextPatches, inspectPak, parseLocres: core.parseLocres, looksTurkish: core.looksTurkish };
