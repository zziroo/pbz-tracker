'use strict';
// Data files in the project root ("sidecars") override the built-in ones in the terminal version, so
// rules and names can be tried out without editing data/:
//   <app dir>/rules.json           → replaces the built-in data/rules.json (or --rules <path>)
//   <app dir>/names.<lang>.json    → replaces or adds a name table
// <app dir> is the project root (the folder of pbz.js).
// A broken or incompatible sidecar is an error: we never silently fall back to the embedded copy.
// Read-only; no network access.
const fs = require('fs');
const path = require('path');
const { t } = require('./i18n');
const { validateRules, validateNames, SCHEMA_VERSION } = require('./rules-schema');

function appDir() {
  return path.resolve(__dirname, '..');
}

function readJson(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { throw new Error(t('err.dataRead', { file, msg: e.code || e.message })); }
  try { return JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { throw new Error(t('err.dataJson', { file, msg: e.message })); }
}

// Shape checks (validateRules / validateNames): lib/rules-schema.js, shared with the web version.

// → { rules, source: 'embedded' | 'sidecar' | 'explicit', file }
function loadRules({ explicit, embedded }) {
  if (explicit) {
    const file = path.resolve(explicit);
    return { rules: validateRules(readJson(file), file), source: 'explicit', file };
  }
  const side = path.join(appDir(), 'rules.json');
  if (fs.existsSync(side)) return { rules: validateRules(readJson(side), side), source: 'sidecar', file: side };
  return { rules: validateRules(embedded, 'data/rules.json'), source: 'embedded', file: null };
}

// → { tables: {lang: table}, files: [basename] } — embedded tables plus any names.<lang>.json next to the app.
function loadNameTables(embedded) {
  const tables = { ...embedded };
  const files = [];
  let list = [];
  try { list = fs.readdirSync(appDir()); } catch { /* unreadable dir: embedded only */ }
  for (const f of list.sort()) {
    const m = /^names\.([a-z]{2,3}(?:-[a-z0-9]{2,8})?)\.json$/i.exec(f);
    if (!m) continue;
    const file = path.join(appDir(), f);
    tables[m[1].toLowerCase()] = validateNames(readJson(file), file);
    files.push(f);
  }
  return { tables, files };
}

module.exports = { loadRules, loadNameTables, appDir, SCHEMA_VERSION };
