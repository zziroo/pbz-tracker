'use strict';
// Extracts the facts the rule engine needs from a decoded save slot.

const QUEST_RE = /\/PBZQuest\/([^/]+)\/([^./]+)\./;

function questInfo(q) {
  const m = QUEST_RE.exec(q.QuestClass || '');
  const id = m ? m[2] : (q.QuestClass || '?');
  const folder = m ? m[1] : '?';
  const completion = String(q.QuestCompletion || '').replace('EQuestCompletion::QC_', '');
  const branches = {};
  let progress = null;
  for (const b of q.QuestBranches || []) {
    const type = String(b.BranchType || '').replace('EBranchType::', '').replace(/^Branch/, '');
    branches[b.BranchID] = type;
    // Counter arrays (e.g. [1,1,0,0,0]) on the active branch: completed slots / total.
    if (type === 'Activating' && Array.isArray(b.TasksProgress) && b.TasksProgress.length > 1) {
      const done = b.TasksProgress.filter((x) => x > 0).length;
      if (!progress || done > 0) progress = { done, total: b.TasksProgress.length };
    }
  }
  return { id, folder, completion, branches, progress };
}

// Items the save has recorded as acquired, from four Inventory tables (field names as found in the save):
//   MainWeaponInfos[<pinyin>].DateTime, ShaChiWeaponInfo[<pinyin>].DirtyTime, AccessoryInfos[AC_*].DirtyTime,
//   InventoryInfos[<code>].FirstAddTime (+ CurrentAmount: 0 once a consumable / key item is used up).
// → Map<code, { table, time, held }>: key and timestamp only (time "YYYY.MM.DD-HH.MM.SS" or null); held is
// false only for an InventoryInfos entry whose CurrentAmount is not > 0. A code in two tables keeps the first.
// null (not an empty Map) when the save has no Inventory or none of the four tables: "unknown", so item
// rules never turn into "missed" and the timeline never relogs every item after such a read.
const ITEM_TABLES = [
  ['MainWeaponInfos', 'mainWeapon', 'DateTime'],
  ['ShaChiWeaponInfo', 'shaChiWeapon', 'DirtyTime'],
  ['AccessoryInfos', 'accessory', 'DirtyTime'],
  ['InventoryInfos', 'inventory', 'FirstAddTime'],
];
function itemsOf(inv) {
  const items = new Map();
  let found = false;
  for (const [field, table, timeField] of ITEM_TABLES) {
    const tbl = inv && inv[field];
    if (!tbl || typeof tbl !== 'object' || Array.isArray(tbl)) continue;
    found = true;
    for (const [code, v] of Object.entries(tbl)) {
      if (items.has(code)) continue;
      const time = v && typeof v[timeField] === 'string' ? v[timeField] : null;
      const held = table !== 'inventory' || (typeof v?.CurrentAmount === 'number' && v.CurrentAmount > 0);
      items.set(code, { table, time, held });
    }
  }
  return found ? items : null;
}

// The region the player is in, for the header. The level name is no good: one World Partition level can
// hold several regions (PBZ_Zhengdaodaying_WP is the Mandate Encampment AND the Village of Lu). Instead:
// the unlocked region map with the newest bell interaction (BellManager.RecentlyInteractedAtByMap, map
// code → time), else the last map in UnLockBigMapMaskWidgetNames. → { code, source: 'bell' | 'map' } | null
function regionOf(bell) {
  bell = bell || {};
  const at = bell.RecentlyInteractedAtByMap;
  let best = null;
  if (at && typeof at === 'object' && !Array.isArray(at)) {
    for (const [code, v] of Object.entries(at)) if (typeof v === 'number' && Number.isFinite(v) && (!best || v > best.v)) best = { code, v };
  }
  if (best) return { code: best.code, source: 'bell' };
  const maps = Array.isArray(bell.UnLockBigMapMaskWidgetNames) ? bell.UnLockBigMapMaskWidgetNames : [];
  return maps.length ? { code: String(maps[maps.length - 1]), source: 'map' } : null;
}

function extract(data) {
  const sys = data.PBZGameSystem || {};
  const bell = data.BellManager || {};
  const quests = new Map();
  for (const q of data.Narrative?.NarrativeSavedQuests || []) {
    const qi = questInfo(q);
    quests.set(qi.id, qi);
  }
  const bosses = new Map();
  for (const [k, v] of Object.entries(data.BossRecord || {})) {
    let attempts = 0, kills = 0;
    for (const r of Object.values(v?.Records || {})) { attempts += r.AttemptCount || 0; kills += r.KillCount || 0; }
    bosses.set(k, { attempts, kills });
  }
  // Level names appear as "PBZ_<Name>_WP" prefixes on saved actors.
  const levels = new Set();
  const addLevel = (s) => { const m = /^PBZ_([A-Za-z0-9]+)_WP/.exec(s || ''); if (m) levels.add(m[1].toLowerCase()); };
  addLevel(sys.CurrentLevelName);
  for (const k of Object.keys(data.LevelActorManager || {})) addLevel(k);
  for (const k of data.MapSubsystem?.EndedLockObjGuids || []) addLevel(k);

  return {
    dateTime: sys.DateTimeString || '',
    playSeconds: sys.HasGameTime || 0,
    currentLevel: (/^PBZ_([A-Za-z0-9]+)_WP/.exec(sys.CurrentLevelName || '') || [])[1] || sys.CurrentLevelName || '',
    cycle: sys.CycleCount || 0,
    finished: !!sys.bIsFinishGame,
    maps: new Set(bell.UnLockBigMapMaskWidgetNames || []),
    bells: new Set(bell.ActivateBellIDs || []),
    lastBell: typeof bell.RecentlyInteractedBellID === 'string' ? bell.RecentlyInteractedBellID : '',
    region: regionOf(bell),
    levels,
    bosses,
    quests,
    items: itemsOf(data.Inventory),
  };
}

module.exports = { extract, regionOf, ITEM_TABLES };
