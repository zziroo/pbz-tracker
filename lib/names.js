'use strict';
// Display names for quests / regions / missables. Source, in order:
//   1. a text patch found in Paks/ (unencrypted .pak with a Game.locres), via the key map in data/names.json;
//   2. the name table data/names.<lang>.json;
//   3. English (data/names.en.json), with a one-line notice that some names fell back.
// The name source is chosen independently of the UI language (--names vs --lang). Never throws.
const { findTextPatches } = require('./locres');
const { t } = require('./i18n');

// Static requires so the exe bundler can inline them. To add a language: create data/names.<lang>.json
// and add one line here.
const KEY_MAP = require('../data/names.json');
const EMBEDDED_TABLES = {
  en: require('../data/names.en.json'),
  tr: require('../data/names.tr.json'),
};

// Words kept lowercase inside a title (never the first word).
const SMALL_WORDS = new Set(['ve', 'ile', 'veya', 'ya', 'da', 'de', 'ki', 'mi', 'mı', 'mu', 'mü', 'için']);
// Uppercase spellings that are not Turkish (pinyin digraphs, vowel clusters around a plain I):
// there a plain 'I' is a dotted i, not Turkish 'ı' (BAISHAN, SHA-CHI, CUI).
const FOREIGN = /SH|CH|ZH|[XQW]|[AEOUÓ]I|I[AEOUÓ]/;

// Case-insensitive own-key lookup that skips "_comment"-style keys.
function lookup(section, id) {
  if (!section || typeof section !== 'object' || id == null) return null;
  const s = String(id);
  if (s.startsWith('_')) return null;
  if (Object.prototype.hasOwnProperty.call(section, s)) return section[s] || null;
  const low = s.toLowerCase();
  for (const k of Object.keys(section)) if (!k.startsWith('_') && k.toLowerCase() === low) return section[k] || null;
  return null;
}

function lowerPart(part, overrides) {
  const m = /^([^'’]*)(['’].*)?$/.exec(part);
  const stem = m[1], suffix = m[2] || '';
  // A stem before an apostrophe is a proper noun (Turkish orthography); treat it like a foreign word.
  const foreign = suffix !== '' || FOREIGN.test(stem);
  const low = (foreign ? stem.replace(/[Iİ]/g, 'i') : stem).toLocaleLowerCase('tr') + suffix.toLocaleLowerCase('tr');
  const fix = overrides && typeof overrides[low] === 'string' ? overrides[low] : null;
  return { low, fix };
}

const capitalize = (w) => (w ? w.charAt(0).toLocaleUpperCase('tr') + w.slice(1) : w);

// "KAN BAĞI UYANIŞI" → "Kan Bağı Uyanışı". Strings that already contain lowercase are returned as-is.
function titleCaseTr(s, overrides) {
  if (typeof s !== 'string') return s;
  const t = s.trim().replace(/\s+/g, ' ');
  if (!t || t !== t.toLocaleUpperCase('tr')) return t;
  return t.split(' ').map((word, wi) => word.split('-').map((part, pi) => {
    const { low, fix } = lowerPart(part, overrides);
    if (fix) return fix;
    if (wi > 0 && pi === 0 && SMALL_WORDS.has(low)) return low;
    return capitalize(low);
  }).join('-')).join(' ');
}

// Pick the name source. `names`: a pak file name (with or without .pak), a table language, or empty (auto).
function chooseSource({ gameDir, uiLang, names, TABLES }) {
  const patches = findTextPatches(gameDir);
  const notices = [];
  const want = (names || '').trim().toLowerCase();
  const byName = (p) => [p.name.toLowerCase(), p.name.toLowerCase().replace(/\.pak$/, '')].includes(want);
  if (want) {
    const p = patches.find(byName);
    if (p) return { patch: p, lang: null, notices: [t('names.patch', { pak: p.name })] };
    if (Object.hasOwn(TABLES, want)) return { patch: null, lang: want, notices };
    // Unknown value: say so, then continue with automatic detection.
    notices.push(t('names.unknown', { v: names, opts: [...patches.map((x) => x.name), ...Object.keys(TABLES)].join(', ') }));
  }
  // Automatic: a text patch is used only for a Turkish UI (the default English UI keeps the official
  // English names even when a patch is installed). --names <pak> selects a patch explicitly.
  if (patches.length && uiLang === 'tr') {
    const p = patches[0];
    notices.push(t('names.patch', { pak: p.name }));
    if (patches.length > 1) notices.push(t('names.patchMulti', { list: patches.map((x) => x.name).join(', ') }));
    return { patch: p, lang: null, notices };
  }
  return { patch: null, lang: Object.hasOwn(TABLES, uiLang) ? uiLang : 'en', notices };
}

// `tables`: name tables by language (embedded + sidecar names.<lang>.json); defaults to the embedded ones.
function createNames({ gameDir, uiLang = 'en', names, tables } = {}) {
  const TABLES = tables || EMBEDDED_TABLES;
  const src = chooseSource({ gameDir, uiLang, names, TABLES });
  const overrides = KEY_MAP.trWordCase && typeof KEY_MAP.trWordCase === 'object' ? KEY_MAP.trWordCase : {};
  const table = src.lang ? TABLES[src.lang] : null;
  let fellBack = false;

  const patchText = (key) => {
    if (!src.patch || !key) return null;
    const v = src.patch.map.get(key);
    return typeof v === 'string' && v.trim() !== '' ? v : null;
  };
  const tableName = (tbl, sec, id) => {
    const v = lookup(tbl?.[sec], id);
    return typeof v === 'string' && v ? v : null;
  };
  // sec: quests | regions | missables; keySec: section of the key map
  const resolve = (sec, keySec, id) => {
    if (id == null) return null;
    if (src.patch) {
      const k = lookup(KEY_MAP[keySec], id);
      const txt = patchText(k && k.locres);
      if (txt) return titleCaseTr(txt, overrides);
    } else if (table) {
      const v = tableName(table, sec, id);
      if (v) return v;
    }
    const en = tableName(TABLES.en, sec, id);
    if (en && (src.patch || src.lang !== 'en')) fellBack = true;
    return en;
  };

  return {
    source: src.patch ? src.patch.name : src.lang,
    // Notices are read at render time, so the fallback note reflects the names actually resolved.
    get notice() {
      const n = [...src.notices];
      if (fellBack) n.push(t('names.fallback'));
      return n.length ? n.join(' · ') : null;
    },
    quest: (id) => resolve('quests', 'quests', id),
    region: (code) => resolve('regions', 'regions', code),
    // Name-only missables without a known pinyin id (keyed by rules.json missables[].id).
    missable: (id) => resolve('missables', 'unmappedMissables', id),
    // Raw patch text for a locres key (not title-cased), or null.
    text: (key) => patchText(key),
  };
}

module.exports = { createNames, titleCaseTr, EMBEDDED_TABLES };
