'use strict';
// The condition language of data/rules.json (visibleWhen, passedWhen, exactWhen, …): one list of keys,
// shared by the evaluator (lib/report.js makeEval) and the load-time check (lib/rules-schema.js).
// Pure (no Node built-ins).
//   CONDITION_KEYS: the keys a condition object is recognised by (makeEval tests them in this order)
//     bellPrefix:     an activated bell id starts with "Bell_<prefix>_" (+ except: bell ids to ignore)
//     lastBellPrefix: the bell used last (BellManager.RecentlyInteractedBellID) starts with "Bell_<prefix>"
//                     (+ except)
//     itemSeen:       an Inventory code (lib/state.js items) the save holds: a weapon / sha-chi weapon /
//                     accessory entry, or an InventoryInfos entry with CurrentAmount > 0
//     actorSeen:      a LevelActorManager key the save holds (an opened chest / used interactable: the actor
//                     path "PBZ_<Level>_WP-BP_Chest_C_UAID_…" from data/game/map-items.json)
//     levelVisited / currentLevel: a World Partition level name; one level can span several regions
//                     (Zhengdaodaying = Mandate Encampment + Village of Lu), so prefer mapUnlocked / bellPrefix
//   EXTRA_KEYS:     companion keys (questBranch + branch + state; bellPrefix / lastBellPrefix + except)
//   conditionProblem(c) → null | short English description of the first problem (for err.rulesShape)

const CONDITION_KEYS = ['any', 'all', 'not', 'unknown', 'mapUnlocked', 'levelVisited', 'currentLevel', 'bellPrefix',
  'lastBellPrefix', 'bossKilled', 'bossSeen', 'questSeen', 'questDone', 'questBranch', 'itemSeen', 'actorSeen'];
const EXTRA_KEYS = ['branch', 'state', 'except'];
const KNOWN = new Set([...CONDITION_KEYS, ...EXTRA_KEYS]);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v !== '';

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
  if ('itemSeen' in c && !nonEmpty(c.itemSeen)) return `${at}.itemSeen must be a non-empty item code`;
  if ('actorSeen' in c && !nonEmpty(c.actorSeen)) return `${at}.actorSeen must be a non-empty actor key`;
  for (const k of ['bellPrefix', 'lastBellPrefix']) if (k in c && !nonEmpty(c[k])) return `${at}.${k} must be a non-empty string`;
  if ('except' in c) {
    if (!('bellPrefix' in c) && !('lastBellPrefix' in c)) return `${at}.except needs bellPrefix or lastBellPrefix`;
    if (!Array.isArray(c.except) || !c.except.every(nonEmpty)) return `${at}.except must be an array of bell ids`;
  }
  if ('not' in c) { const p = conditionProblem(c.not, `${at}.not`); if (p) return p; }
  return null;
}

module.exports = { CONDITION_KEYS, EXTRA_KEYS, conditionProblem };
