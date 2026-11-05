'use strict';
// Optional pbz-tracker.config.json in the project root: a remembered game folder / save path
// ({ gameDir, savePath }) that the terminal version uses before its own detection. The tool only reads
// it (and deletes it with --forget); create or edit it by hand. Besides --forget and the optional
// --dump output the tool writes nothing.
// A missing or broken file is treated as empty; stale paths are ignored by the caller.
const fs = require('fs');
const path = require('path');
const { appDir } = require('./datafiles');

const configPath = () => path.join(appDir(), 'pbz-tracker.config.json');

function readConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(configPath(), 'utf8').replace(/^\uFEFF/, ''));
    return c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  } catch { return {}; }
}

function forgetConfig() {
  try { fs.rmSync(configPath(), { force: true }); return true; } catch { return false; }
}

module.exports = { readConfig, forgetConfig, configPath };
