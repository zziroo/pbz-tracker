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
//
// New Game+ (cycle = PBZGameSystem.CycleCount > 0, NG+ saves 2026-11-12): the game keeps the inventory of the
// earlier cycles (weapons, accessories, medicines, most items; key and quest items are removed) with their
// AcquiredCycle, and sets AcquiredCycle to the current cycle when the item is found again. An entry whose numeric
// AcquiredCycle is not the current cycle is left out: carried-over gear is not "found in this run". (Starting
// gear the game hands out at the cycle start keeps AcquiredCycle 0, so it is left out too.) An entry without a
// numeric AcquiredCycle counts as cycle 0, as in acquiredOf (the map completion): kept on the first run (older
// saves), left out in NG+. A code left out still blocks the same code in a later table (the first table decides).
// A re-found item keeps its first-cycle FirstAddTime / DateTime and often its DirtyTime, so in NG+ a time is kept
// only when it is not before cycleFrom (see cycleFromOf), else null.
const ITEM_TABLES = [
  ['MainWeaponInfos', 'mainWeapon', 'DateTime'],
  ['ShaChiWeaponInfo', 'shaChiWeapon', 'DirtyTime'],
  ['AccessoryInfos', 'accessory', 'DirtyTime'],
  ['InventoryInfos', 'inventory', 'FirstAddTime'],
];
function itemsOf(inv, cycle = 0, cycleFrom = null) {
  const items = new Map();
  const seen = new Set();
  let found = false;
  for (const [field, table, timeField] of ITEM_TABLES) {
    const tbl = inv && inv[field];
    if (!tbl || typeof tbl !== 'object' || Array.isArray(tbl)) continue;
    found = true;
    for (const [code, v] of Object.entries(tbl)) {
      if (seen.has(code)) continue;
      seen.add(code);
      if ((typeof v?.AcquiredCycle === 'number' ? v.AcquiredCycle : 0) !== cycle) continue;
      let time = v && typeof v[timeField] === 'string' ? v[timeField] : null;
      if (cycle > 0 && time !== null && (cycleFrom === null || !(stampMs(time) >= cycleFrom))) time = null;
      const held = table !== 'inventory' || (typeof v?.CurrentAmount === 'number' && v.CurrentAmount > 0);
      items.set(code, { table, time, held });
    }
  }
  return found ? items : null;
}

// NG+: the items still held from an earlier cycle (numeric AcquiredCycle, missing = 0, below the current cycle), the
// ones itemsOf leaves out. → Map<code, { table, plus }> on NG+ (cycle > 0), null on the first run or without item
// tables. plus: finding the item again in this cycle gives a stronger copy. The NG+ saves of 2026-11-12 show it for
// main weapons and accessories (ReincarnationCount 1 next to AcquiredCycle 1 once found again); medicines are not
// item tables here, and sha-chi weapons and inventory items (memory flowers, materials) have no such count, so they
// are plus: false (nothing to gain by finding them again). An inventory entry counts only while CurrentAmount > 0,
// as `held` in itemsOf. The first table holding a code decides, as in itemsOf.
const PLUS_TABLES = new Set(['mainWeapon', 'accessory']);
function priorItemsOf(inv, cycle = 0) {
  if (!(cycle > 0)) return null;
  const prior = new Map();
  const seen = new Set();
  let found = false;
  for (const [field, table] of ITEM_TABLES) {
    const tbl = inv && inv[field];
    if (!tbl || typeof tbl !== 'object' || Array.isArray(tbl)) continue;
    found = true;
    for (const [code, v] of Object.entries(tbl)) {
      if (seen.has(code)) continue;
      seen.add(code);
      if (!((typeof v?.AcquiredCycle === 'number' ? v.AcquiredCycle : 0) < cycle)) continue;
      if (table === 'inventory' && !(typeof v?.CurrentAmount === 'number' && v.CurrentAmount > 0)) continue;
      prior.set(code, { table, plus: PLUS_TABLES.has(table) });
    }
  }
  return found ? prior : null;
}

// "YYYY.MM.DD-HH.MM.SS" (the save's local wall-clock stamps) → ms on one fixed scale (fields read as UTC, only
// compared with each other), or null for anything else.
function stampMs(s) {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})$/.exec(typeof s === 'string' ? s : '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

// NG+: the earliest stamp that surely belongs to the current cycle — the save time minus the play time of this
// cycle (CurrentCycleGameTime, seconds). The cycle began at or before that moment (play time never runs faster
// than the wall clock), so every stamp of an earlier cycle is older. A stamp of this cycle may be older too (the
// game was closed in between); such a time is dropped (null). This assumes the local clock did not move back
// during the cycle (DST fall-back, a time zone change): then a first-run stamp from up to that shift before the
// cycle start can keep its time. Only item times (timeline, diagnostics) depend on it, never a rule's status.
// null when it cannot be computed.
function cycleFromOf(sys) {
  const now = stampMs(sys.DateTimeString);
  const played = sys.CurrentCycleGameTime;
  return now !== null && typeof played === 'number' && Number.isFinite(played) && played >= 0 ? now - played * 1000 : null;
}

// Boss records: BossRecord.<boss>.Records is keyed "<cycle>_<difficulty>" ("0_3": first run on Hellwalker; a kill in
// NG+ adds "1_3" next to it, 2026-11-12). Only the records of the current cycle count; a key of another shape is
// counted (unknown layout: as before). → Map<boss, { attempts, kills }>
function bossesOf(rec, cycle) {
  const bosses = new Map();
  for (const [k, v] of Object.entries(rec || {})) {
    let attempts = 0, kills = 0;
    for (const [rk, r] of Object.entries(v?.Records || {})) {
      const m = /^(\d+)_/.exec(rk);
      if (m && Number(m[1]) !== cycle) continue;
      attempts += r?.AttemptCount || 0; kills += r?.KillCount || 0;
    }
    bosses.set(k, { attempts, kills });
  }
  return bosses;
}

// What the save says the player has acquired, per Inventory table, for the map completion (lib/completion.js):
// lower-cased code → AcquiredCycle (0 when the save has none). Weapons: MainWeaponInfos, phantom edges:
// ShaChiWeaponInfo, accessories: AccessoryInfos, medicines: MedicineInfos, items: InventoryInfos. null when the save
// has no Inventory object (unknown: nothing counts as acquired, like the game's own calculation with an empty table).
const ACQUIRED_TABLES = [['weapons', 'MainWeaponInfos'], ['phantomEdges', 'ShaChiWeaponInfo'], ['accessories', 'AccessoryInfos'], ['medicines', 'MedicineInfos'], ['items', 'InventoryInfos']];
function acquiredOf(inv) {
  if (!inv || typeof inv !== 'object' || Array.isArray(inv)) return null;
  const out = {};
  for (const [name, field] of ACQUIRED_TABLES) {
    const m = new Map();
    const tbl = inv[field];
    if (tbl && typeof tbl === 'object' && !Array.isArray(tbl)) {
      for (const [code, v] of Object.entries(tbl)) m.set(String(code).toLowerCase(), typeof v?.AcquiredCycle === 'number' ? v.AcquiredCycle : 0);
    }
    out[name] = m;
  }
  return out;
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
  const lastBell = typeof bell.RecentlyInteractedBellID === 'string' ? bell.RecentlyInteractedBellID : null;
  if (best) return { code: best.code, source: 'bell', bell: lastBell };
  const maps = Array.isArray(bell.UnLockBigMapMaskWidgetNames) ? bell.UnLockBigMapMaskWidgetNames : [];
  if (maps.length) return { code: String(maps[maps.length - 1]), source: 'map', bell: lastBell };
  return lastBell ? { code: null, source: 'bell', bell: lastBell } : null; // only the last bell: names by its prefix
}

// Locks still closed on the region maps: MapSubsystem.<MapCode>.MapLockGroups.<i>.{ShaChi,Switch,DoorDir}LockJsonArray
// (a Sha-Chi weapon / a key item / a plain locked door). A lock whose Guid is in MapSubsystem.EndedLockObjGuids
// (compared case-insensitively) is resolved and skipped; the game also removes resolved locks from the arrays,
// so the filter is a safety net (399 archived saves, 2026-11-06..08: the two sets never overlapped). The Guid's
// class name (PBZ_<Level>_WP-BP_<Actor>_C_UAID_…) becomes `actor`; the Guid itself is not kept.
// → [{ map, kind: 'weapon' | 'item' | 'none', actor, needs: string[] }] (needs: weapon ids or item codes);
//   null when the save has no MapSubsystem (unknown, not "no locks").
const LOCK_ARRAYS = [['ShaChiLockJsonArray', 'weapon'], ['SwitchLockJsonArray', 'item'], ['DoorDirLockJsonArray', 'none']];
function mapLocksOf(ms) {
  if (!ms || typeof ms !== 'object' || Array.isArray(ms)) return null;
  const ended = new Set((Array.isArray(ms.EndedLockObjGuids) ? ms.EndedLockObjGuids : []).map((g) => String(g).toLowerCase()));
  const out = [];
  for (const [map, v] of Object.entries(ms)) {
    const groups = v && typeof v === 'object' && !Array.isArray(v) ? v.MapLockGroups : null;
    if (!groups || typeof groups !== 'object') continue;
    for (const g of Object.values(groups)) {
      if (!g || typeof g !== 'object') continue;
      for (const [field, kind] of LOCK_ARRAYS) {
        for (const lock of Array.isArray(g[field]) ? g[field] : []) {
          const guid = typeof lock?.Guid === 'string' ? lock.Guid : '';
          if (!guid || ended.has(guid.toLowerCase())) continue;
          const actor = (/-BP_([A-Za-z0-9_]+?)_C_UAID/.exec(guid) || [])[1] || '';
          const needs = kind === 'weapon' ? (Array.isArray(lock.NeedShaChiWeaponIds) ? lock.NeedShaChiWeaponIds : [])
            : kind === 'item' ? Object.keys(lock.NeedItems && typeof lock.NeedItems === 'object' ? lock.NeedItems : {}) : [];
          out.push({ map, kind, actor, needs: needs.filter((x) => typeof x === 'string' && x) });
        }
      }
    }
  }
  return out;
}

function extract(data) {
  const sys = data.PBZGameSystem || {};
  const bell = data.BellManager || {};
  const quests = new Map();
  for (const q of data.Narrative?.NarrativeSavedQuests || []) {
    const qi = questInfo(q);
    quests.set(qi.id, qi);
  }
  const cycle = typeof sys.CycleCount === 'number' && Number.isInteger(sys.CycleCount) && sys.CycleCount > 0 ? sys.CycleCount : 0;
  const bosses = bossesOf(data.BossRecord, cycle);
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
    cycle,
    finished: !!sys.bIsFinishGame,
    maps: new Set(bell.UnLockBigMapMaskWidgetNames || []),
    // Region maps whose bells the player has used (RecentlyInteractedAtByMap keys): a reached map even when
    // its big-map mask is not unlocked yet (HouJie, MeiGu_YiJi in a 2026-11-08 save).
    bellMaps: new Set(bell.RecentlyInteractedAtByMap && typeof bell.RecentlyInteractedAtByMap === 'object' && !Array.isArray(bell.RecentlyInteractedAtByMap) ? Object.keys(bell.RecentlyInteractedAtByMap) : []),
    bells: new Set(bell.ActivateBellIDs || []),
    lastBell: typeof bell.RecentlyInteractedBellID === 'string' ? bell.RecentlyInteractedBellID : '',
    region: regionOf(bell),
    levels,
    bosses,
    quests,
    items: itemsOf(data.Inventory, cycle, cycle > 0 ? cycleFromOf(sys) : null),
    priorItems: priorItemsOf(data.Inventory, cycle),
    // Saved level actors (opened chests: SwitchState, used interactables: HaveBeen, broken props: Destroy);
    // null when the save has no LevelActorManager, so actorSeen is unknown rather than false.
    actors: data.LevelActorManager && typeof data.LevelActorManager === 'object' ? new Set(Object.keys(data.LevelActorManager)) : null,
    mapLocks: mapLocksOf(data.MapSubsystem),
    // Map completion inputs (lib/completion.js): executed flow nodes (EventPipeline.ExecuteNodeGuid keys), completed
    // mob domains (PBZGameSystem.CompleteAddItemMobDomainNames) — both lower-cased — and the acquired codes per table.
    nodes: data.EventPipeline && data.EventPipeline.ExecuteNodeGuid && typeof data.EventPipeline.ExecuteNodeGuid === 'object' && !Array.isArray(data.EventPipeline.ExecuteNodeGuid)
      ? new Set(Object.keys(data.EventPipeline.ExecuteNodeGuid).map((k) => k.toLowerCase())) : null,
    mobDomains: new Set((Array.isArray(sys.CompleteAddItemMobDomainNames) ? sys.CompleteAddItemMobDomainNames : []).map((k) => String(k).toLowerCase())),
    acquired: acquiredOf(data.Inventory),
  };
}

module.exports = { extract, regionOf, mapLocksOf, acquiredOf, itemsOf, priorItemsOf, bossesOf, cycleFromOf, ITEM_TABLES };
