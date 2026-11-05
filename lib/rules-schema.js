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
  // Optional exact-mode fields: whereExact = {tr, en} text (or a plain string) with at least one
  // non-empty language, exactWhen = a condition (keys checked here, so a typo fails at load, not mid-read).
  const nonEmpty = (x) => typeof x === 'string' && x.trim() !== '';
  const isText = (v) => nonEmpty(v)
    || (isObj(v) && Object.values(v).every((x) => typeof x === 'string') && (nonEmpty(v.tr) || nonEmpty(v.en)));
  for (const [id, c] of Object.entries(r.cutoffs)) {
    if (id.startsWith('_') || !isObj(c)) continue;
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
    // Conditions on rules are checked at load time too (a typo must not surface mid-read).
    for (const k of ['visibleWhen', 'activeWhen', 'exactWhen', 'doneWhen', 'failedWhen']) {
      if (m[k] === undefined) continue;
      const p = conditionProblem(m[k], `missables.${m.id}.${k}`);
      if (p) bad(p);
    }
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

module.exports = { validateRules, validateNames, SCHEMA_VERSION };
