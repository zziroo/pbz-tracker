'use strict';
// Display names for quests/regions. 'tr': read live from the user's Turkish fan patch (Game.locres)
// through the static key map in data/names.json, falling back to the embedded English names.
// Never throws; unknown ids give null.
const fs = require('fs');
const { loadPatchLocres } = require('./locres');

const DEFAULT_TABLE = require('../data/names.json'); // inlined by the exe bundler
const NOTICE_NO_PATCH = 'Türkçe yama bulunamadı; görev adları İngilizce gösteriliyor.';

// Words kept lowercase inside a title (never the first word).
const SMALL_WORDS = new Set(['ve', 'ile', 'veya', 'ya', 'da', 'de', 'ki', 'mi', 'mı', 'mu', 'mü', 'için']);
// Uppercase spellings that are not Turkish (pinyin digraphs, vowel clusters around a plain I):
// there a plain 'I' is a dotted i, not Turkish 'ı' (BAISHAN, SHA-CHI, CUI).
const FOREIGN = /SH|CH|ZH|[XQW]|[AEOUÓ]I|I[AEOUÓ]/;

function readTable(file) {
  try {
    const t = JSON.parse(fs.readFileSync(file, 'utf8'));
    return t && typeof t === 'object' ? t : {};
  } catch { return {}; }
}

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

function createNames({ gameDir, lang = 'tr', namesPath } = {}) {
  const table = namesPath ? readTable(namesPath) : DEFAULT_TABLE;
  const overrides = table.trWordCase && typeof table.trWordCase === 'object' ? table.trWordCase : {};
  const enByKey = new Map();
  for (const sec of ['quests', 'regions', 'unmappedMissables']) {
    for (const [k, v] of Object.entries(table[sec] || {})) {
      if (!k.startsWith('_') && v && v.locres && v.en && !enByKey.has(v.locres)) enByKey.set(v.locres, v.en);
    }
  }

  let loc = null;
  let notice = null;
  let effective = lang === 'tr' ? 'tr' : 'en';
  if (effective === 'tr') {
    try { loc = loadPatchLocres(gameDir); } catch { loc = null; }
    if (!loc) { effective = 'en'; notice = NOTICE_NO_PATCH; }
  }

  const trText = (key) => {
    if (!loc || !key) return null;
    const v = loc.get(key);
    return typeof v === 'string' && v.trim() !== '' ? v : null;
  };

  const resolve = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    if (effective === 'tr') {
      const tr = trText(entry.locres);
      if (tr) return titleCaseTr(tr, overrides);
    }
    return typeof entry.en === 'string' && entry.en ? entry.en : null;
  };

  return {
    lang: effective,
    notice,
    quest: (id) => resolve(lookup(table.quests, id)),
    region: (code) => resolve(lookup(table.regions, code)),
    // Name-only missables without a known pinyin id (keyed by rules.json missables[].id).
    missable: (id) => resolve(lookup(table.unmappedMissables, id)),
    // Raw locres text (not title-cased). In English mode only keys from the static table are known.
    text: (key) => {
      if (effective === 'tr') { const tr = trText(key); if (tr) return tr; }
      return enByKey.get(key) || null;
    },
  };
}

module.exports = { createNames, titleCaseTr, NOTICE_NO_PATCH };
