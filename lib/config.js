'use strict';
// Remembers the game folder / save chosen in a picker: pbz-tracker.config.json next to the exe
// (project root with node). Besides the optional --dump output this is the only file the tool writes.
// A missing or broken file is treated as empty; stale paths are ignored by the caller.
const fs = require('fs');
const path = require('path');
const { appDir } = require('./datafiles');

const configPath = () => path.join(appDir(), 'pbz-tracker.config.json');

function readConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(configPath(), 'utf8').replace(/^﻿/, ''));
    return c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  } catch { return {}; }
}

// Merge `patch` into the stored config. Returns the file path, or null if it could not be written.
function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  try {
    fs.writeFileSync(configPath(), JSON.stringify(next, null, 2) + '\n');
    return configPath();
  } catch { return null; }
}

function forgetConfig() {
  try { fs.rmSync(configPath(), { force: true }); return true; } catch { return false; }
}

module.exports = { readConfig, writeConfig, forgetConfig, configPath };
