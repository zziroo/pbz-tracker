'use strict';
// The condition language of data/rules.json (visibleWhen, passedWhen, exactWhen, …): one list of keys,
// shared by the evaluator (lib/report.js makeEval) and the load-time check (lib/rules-schema.js).
// Pure (no Node built-ins).
//   CONDITION_KEYS: the keys a condition object is recognised by (makeEval tests them in this order)
//   EXTRA_KEYS:     companion keys (questBranch + branch + state)
//   conditionProblem(c) → null | short English description of the first problem (for err.rulesShape)

const CONDITION_KEYS = ['any', 'all', 'not', 'unknown', 'mapUnlocked', 'levelVisited', 'currentLevel', 'bellPrefix',
  'bossKilled', 'bossSeen', 'questSeen', 'questDone', 'questBranch'];
const EXTRA_KEYS = ['branch', 'state'];
const KNOWN = new Set([...CONDITION_KEYS, ...EXTRA_KEYS]);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function conditionProblem(c, at = 'condition') {
  if (!isObj(c)) return `${at} must be an object`;
  const keys = Object.keys(c);
  const unknown = keys.find((k) => !KNOWN.has(k));
  if (unknown) return `${at}: unknown condition key "${unknown}"`;
  if (!keys.some((k) => CONDITION_KEYS.includes(k))) return `${at}: no condition key`;
  for (const k of ['any', 'all']) {
    if (k in c) {
      if (!Array.isArray(c[k]) || !c[k].length) return `${at}.${k} must be a non-empty array`;
      for (const [i, x] of c[k].entries()) { const p = conditionProblem(x, `${at}.${k}[${i}]`); if (p) return p; }
    }
  }
  if ('not' in c) { const p = conditionProblem(c.not, `${at}.not`); if (p) return p; }
  return null;
}

module.exports = { CONDITION_KEYS, EXTRA_KEYS, conditionProblem };
