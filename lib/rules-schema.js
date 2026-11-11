'use strict';
// Shape checks for the rules file and name tables: enough to reject a wrong or truncated file with a
// clear message. Pure (no Node built-ins): used by lib/datafiles.js (sidecar files) and by the web
// version, which validates its embedded copy of data/rules.json the same way.
//   validateRules(rules, file) → rules   (throws a localized Error)
//   validateNames(table, file) → table   (throws a localized Error)
//   SCHEMA_VERSION
const { t } = require('./i18n');
const { conditionProblem } = require('./conditions');

const SCHEMA_VERSION = 1;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function validateRules(r, file) {
  const bad = (msg) => { throw new Error(t('err.rulesShape', { file, msg })); };
  if (!isObj(r)) bad('not a JSON object');
  if (r.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(t('err.rulesSchema', { file, got: r.schemaVersion === undefined ? '-' : r.schemaVersion, want: SCHEMA_VERSION }));
  }
  if (typeof r.rulesVersion !== 'string' && typeof r.rulesVersion !== 'number') bad('rulesVersion missing');
  if (!isObj(r.cutoffs)) bad('cutoffs must be an object');
  const nonEmpty = (x) => typeof x === 'string' && x.trim() !== '';
  // Optional `regions` table (game areas the warnings are grouped by). When it is present, every cutoff
  // and missable must name one of its ids in `region` (a string, or an array whose first entry is primary).
  const regionIds = new Set();
  if (r.regions !== undefined) {
    if (!isObj(r.regions)) bad('regions must be an object');
    for (const [id, g] of Object.entries(r.regions)) {
      if (id.startsWith('_')) continue;
      if (id === 'later' || id === 'endgame') bad(`regions.${id} is a reserved id ('later': the anonymous group of unreached regions, 'endgame': the end-of-game cutoff group)`);
      if (!isObj(g)) bad(`regions.${id} must be an object`);
      for (const k of ['mapCodes', 'bellPrefixes', 'except']) {
        if (g[k] !== undefined && !(Array.isArray(g[k]) && g[k].every(nonEmpty))) bad(`regions.${id}.${k} must be an array of strings`);
      }
      if (g.order !== undefined && typeof g.order !== 'number') bad(`regions.${id}.order must be a number`);
      regionIds.add(id);
    }
  }
  const regionProblem = (v, at) => {
    if (r.regions === undefined) return v === undefined ? null : `${at}: region given but the file has no regions table`;
    const list = Array.isArray(v) ? v : [v];
    if (!list.length || !list.every(nonEmpty)) return `${at}: region must be a region id or a non-empty array of ids`;
    const unknown = list.find((x) => !regionIds.has(x));
    return unknown ? `${at}: unknown region "${unknown}"` : null;
  };
  // Optional exact-mode fields: whereExact = {tr, en} text (or a plain string) with at least one
  // non-empty language, exactWhen = a condition (keys checked here, so a typo fails at load, not mid-read).
  const isText = (v) => nonEmpty(v)
    || (isObj(v) && Object.values(v).every((x) => typeof x === 'string') && (nonEmpty(v.tr) || nonEmpty(v.en)));
  for (const [id, c] of Object.entries(r.cutoffs)) {
    if (id.startsWith('_') || !isObj(c)) continue;
    const rp = regionProblem(c.region, `cutoffs.${id}`);
    if (rp) bad(rp);
    if (c.whereExact !== undefined && !isText(c.whereExact)) bad(`cutoffs.${id}.whereExact must be a {tr, en} text with a non-empty tr or en`);
    if (c.exactWhen !== undefined) {
      const p = conditionProblem(c.exactWhen, `cutoffs.${id}.exactWhen`);
      if (p) bad(p);
    }
  }
  if (!Array.isArray(r.missables)) bad('missables must be an array');
  for (const [i, m] of r.missables.entries()) {
    if (!isObj(m) || typeof m.id !== 'string') bad(`missables[${i}] has no id`);
    if (m.type !== 'info' && m.cutoff !== undefined && !isObj(r.cutoffs[m.cutoff])) bad(`missables[${i}] (${m.id}): unknown cutoff "${m.cutoff}"`);
    const rp = regionProblem(m.region, `missables[${i}] (${m.id})`);
    if (rp) bad(rp);
    // Conditions on rules are checked at load time too (a typo must not surface mid-read).
    for (const k of ['visibleWhen', 'activeWhen', 'exactWhen', 'doneWhen', 'failedWhen']) {
      if (m[k] === undefined) continue;
      const p = conditionProblem(m[k], `missables.${m.id}.${k}`);
      if (p) bad(p);
    }
    // Default-view texts and their named variants (lib/report.js ruleText). A named variant is used only in exact
    // mode when the rule's exactWhen is true, and only in place of its anonymous text: without exactWhen or without
    // the anonymous text it could never be shown, which is a mistake in the file. Info rules keep warnNamed for the
    // hidden section, so their warnNamed needs no exactWhen.
    for (const k of ['warn', 'hintStarted', 'hintNotStarted', 'warnNamed', 'hintStartedNamed', 'hintNotStartedNamed']) {
      if (m[k] !== undefined && !isText(m[k])) bad(`missables.${m.id}.${k} must be a {tr, en} text with a non-empty tr or en`);
    }
    for (const base of ['warn', 'hintStarted', 'hintNotStarted']) {
      const k = `${base}Named`;
      if (m[k] === undefined || (m.type === 'info' && base === 'warn')) continue;
      if (m[base] === undefined) bad(`missables.${m.id}.${k} needs the anonymous ${base} (the named text only replaces it)`);
      if (m.exactWhen === undefined) bad(`missables.${m.id}.${k} needs exactWhen (the named text is shown only when it is true)`);
    }
  }
  if (r.trueEnding !== undefined) {
    if (!isObj(r.trueEnding) || !Array.isArray(r.trueEnding.quests)) bad('trueEnding.quests must be an array');
    if (!isObj(r.cutoffs[r.trueEnding.cutoff])) bad(`trueEnding: unknown cutoff "${r.trueEnding.cutoff}"`);
    for (const e of r.trueEnding.quests) if (isObj(e) && e.doneWhen !== undefined) { const p = conditionProblem(e.doneWhen, `trueEnding.${e.quest}.doneWhen`); if (p) bad(p); }
  }
  return r;
}

function validateNames(n, file) {
  if (!isObj(n)) throw new Error(t('err.namesShape', { file, msg: 'not a JSON object' }));
  for (const sec of ['quests', 'regions', 'missables', 'shaChiWeapons', 'bells', 'bosses']) {
    if (n[sec] !== undefined && !isObj(n[sec])) throw new Error(t('err.namesShape', { file, msg: `${sec} must be an object` }));
  }
  return n;
}

module.exports = { validateRules, validateNames, SCHEMA_VERSION };
