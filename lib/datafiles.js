'use strict';
// Data files next to the exe ("sidecars") override the embedded ones, so rules and names can be
// updated without a new exe:
//   <app dir>/rules.json           → replaces the embedded data/rules.json (or --rules <path>)
//   <app dir>/names.<lang>.json    → replaces or adds a name table
// <app dir> is the exe's folder (single executable) or the project root (node pbz.js).
// A broken or incompatible sidecar is an error: we never silently fall back to the embedded copy.
// Read-only; no network access.
const fs = require('fs');
const path = require('path');
const { t } = require('./i18n');

const SCHEMA_VERSION = 1;

function appDir() {
  try {
    if (require('node:sea').isSea()) return path.dirname(process.execPath);
  } catch { /* node:sea missing on old Node: not a single executable */ }
  return path.resolve(__dirname, '..');
}

function readJson(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { throw new Error(t('err.dataRead', { file, msg: e.code || e.message })); }
  try { return JSON.parse(text.replace(/^﻿/, '')); } catch (e) { throw new Error(t('err.dataJson', { file, msg: e.message })); }
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Shape check: enough to reject a wrong or truncated file with a clear message.
function validateRules(r, file) {
  const bad = (msg) => { throw new Error(t('err.rulesShape', { file, msg })); };
  if (!isObj(r)) bad('not a JSON object');
  if (r.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(t('err.rulesSchema', { file, got: r.schemaVersion === undefined ? '-' : r.schemaVersion, want: SCHEMA_VERSION }));
  }
  if (typeof r.rulesVersion !== 'string' && typeof r.rulesVersion !== 'number') bad('rulesVersion missing');
  if (!isObj(r.cutoffs)) bad('cutoffs must be an object');
  if (!Array.isArray(r.missables)) bad('missables must be an array');
  for (const [i, m] of r.missables.entries()) {
    if (!isObj(m) || typeof m.id !== 'string') bad(`missables[${i}] has no id`);
    if (m.type !== 'info' && m.cutoff !== undefined && !isObj(r.cutoffs[m.cutoff])) bad(`missables[${i}] (${m.id}): unknown cutoff "${m.cutoff}"`);
  }
  if (r.trueEnding !== undefined) {
    if (!isObj(r.trueEnding) || !Array.isArray(r.trueEnding.quests)) bad('trueEnding.quests must be an array');
    if (!isObj(r.cutoffs[r.trueEnding.cutoff])) bad(`trueEnding: unknown cutoff "${r.trueEnding.cutoff}"`);
  }
  return r;
}

function validateNames(n, file) {
  if (!isObj(n)) throw new Error(t('err.namesShape', { file, msg: 'not a JSON object' }));
  for (const sec of ['quests', 'regions', 'missables', 'bells', 'bosses']) {
    if (n[sec] !== undefined && !isObj(n[sec])) throw new Error(t('err.namesShape', { file, msg: `${sec} must be an object` }));
  }
  return n;
}

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
