'use strict';
// Node wrapper: derives the PBZ save AES-256 key from the game executable (read-only).
// The scan itself is portable and lives in lib/core/key.js; this file only opens PBZ.exe.
//   async deriveKey(exePath) → Uint8Array(32)
const { deriveKeyFromReader } = require('./core/key');
const { withFileReader } = require('./fsreader');

const deriveKey = (exePath) => withFileReader(exePath, (r) => deriveKeyFromReader(r, { label: exePath }));

module.exports = { deriveKey };
