'use strict';
// Map completion, counted the way the game's own map panel counts it (Content/JavaScript/Library/
// MapItemCompletionCalc.js; research/gamedata/README.md "Map completion"): per region map (merge groups
// pangzhen+houjie and meiguhu+meigu_yiji; test / huanshushi / xuesesenlin excluded) every entry of the game's
// DT_MapItemData registry counts 1, percent = floor(current / total * 100).
//
//   buildTable(mapItems, codeIndex, maps) → table      data/game/map-items.json, code-index.json, maps.json → the
//                                                       compact table the page embeds (build/build.js): per group its
//                                                       maps, names and items with category, code, name, detection key
//                                                       and the nearest bell; no coordinates.
//   completion(st, table) → [{ id, maps, name, percent, current, total, categories, items }]
//                                                       st = lib/state.js extract(); items carry `done`.
//   reached(st, group) → boolean                        the player has reached one of the group's maps (map unlocked, a
//                                                       bell of it used, or it is the header's region map).
// No Node built-ins: also used by the browser build and the core sandbox.

const CATEGORIES = ['bell', 'weapon', 'phantomEdge', 'accessory', 'medicine', 'challenge', 'amber', 'blackstone', 'flower'];
const CHALLENGES = ['rongShu', 'longZhu', 'daoCaoRen'];
const DEFAULT_EXCLUDED = ['test', 'huanshushi', 'xuesesenlin'];

const lc = (s) => String(s == null ? '' : s).toLowerCase();
const clean = (s) => (s == null ? null : String(s).replace(/<[^>]+>/g, '').trim() || null);
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

// Squared distance between two FIntVector locations.
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// ---- table -------------------------------------------------------------------

function buildTable(mapItems, codeIndex, maps) {
  if (!isObj(mapItems) || !isObj(mapItems.maps)) throw new Error('map-items: no maps');
  const codes = (codeIndex && codeIndex.codes) || {};
  const levelNames = (maps && maps.maps) || {};
  const excluded = new Set((mapItems.excludedFromTotalCompletion || DEFAULT_EXCLUDED).map(lc));
  const merge = isObj(mapItems.mergeGroups) ? mapItems.mergeGroups : {};
  const ids = Object.keys(mapItems.maps);
  const byLc = new Map(ids.map((id) => [lc(id), id]));
  const groupOf = new Map(); // lc map id → group id
  for (const [gid, members] of Object.entries(merge)) for (const m of members) groupOf.set(lc(m), gid);

  // Whole memory flowers (FA_*) with more than one petal (F_*) anywhere are not counted: their petals are.
  const allIds = new Set(Object.values(mapItems.allItemIds || {}).flat().map(String));
  const petalsOf = (fa) => [...allIds].filter((c) => /^F_/.test(c) && c.slice(2, 6) === fa.slice(3, 7)).length;

  const nameOf = (code) => {
    const r = code ? codes[code] || codes[Object.keys(codes).find((k) => lc(k) === lc(code)) || ''] : null;
    if (!r) return null;
    const n = { key: r.nameKey || null, en: clean(r.en), tr: clean(r.tr) };
    return n.key || n.en || n.tr ? n : null;
  };
  const levelName = (mapId) => {
    const l = levelNames[mapId] && levelNames[mapId].levelName;
    return l ? { key: l.key || null, en: clean(l.en), tr: clean(l.tr) } : null;
  };

  const groups = [];
  const seen = new Set();
  for (const id of ids) {
    if (excluded.has(lc(id))) continue;
    const gid = groupOf.get(lc(id)) || id;
    if (seen.has(gid)) continue;
    seen.add(gid);
    const members = groupOf.has(lc(id)) ? merge[gid].map((m) => byLc.get(lc(m))).filter(Boolean) : [id];
    const bells = members.flatMap((m) => (mapItems.maps[m].bells || []).filter((b) => b.BellID && Array.isArray(b.Location)));
    const nearest = (loc) => {
      if (!Array.isArray(loc) || loc.length !== 3 || !bells.length) return null;
      let best = null, bd = Infinity;
      for (const b of bells) { const d = dist2(loc, b.Location); if (d < bd) { bd = d; best = b.BellID; } }
      return best;
    };
    const items = [];
    const add = (cat, code, det, loc, name) => items.push({ cat, code: code || null, name: name === undefined ? nameOf(code) : name, bell: nearest(loc), det });
    const bellSet = new Set(), sets = { weapon: new Set(), phantomEdge: new Set(), accessory: new Set(), medicine: new Set() };
    const uniq = (set, id) => { const k = lc(id); if (set.has(k)) return false; set.add(k); return true; };
    for (const m of members) {
      const mm = mapItems.maps[m];
      for (const e of mm.bells || []) if (e.BellID && uniq(bellSet, e.BellID)) add('bell', e.BellID, { bell: e.BellID }, e.Location);
      for (const e of mm.weapons || []) if (e.ID && lc(e.ID) !== 'zimingjian' && uniq(sets.weapon, e.ID)) add('weapon', e.ID, { code: e.ID }, e.Location);
      for (const e of mm.phantomEdges || []) if (e.ID && uniq(sets.phantomEdge, e.ID)) add('phantomEdge', e.ID, { code: e.ID }, e.Location);
      for (const e of mm.accessories || []) if (e.ID && uniq(sets.accessory, e.ID)) add('accessory', e.ID, { code: e.ID }, e.Location);
      for (const e of mm.medicines || []) if (e.ID && uniq(sets.medicine, e.ID)) add('medicine', e.ID, { code: e.ID }, e.Location);
      for (const kind of CHALLENGES) for (const e of mm[kind] || []) add('challenge', e.FlowEvent || null, { kind, nodes: (e.NodeGuids || []).map(String) }, e.Location, null);
      for (const [slot, cat] of [['domainItemsA', 'amber'], ['domainItemsB', 'blackstone']]) {
        for (const e of mm[slot] || []) add(cat, e.SaveGuid || e.MobDomainName || e.FlowEvent || null, { guid: e.SaveGuid || null, mob: e.MobDomainName || null, nodes: (e.NodeGuids || []).map(String) }, e.Location, null);
      }
      for (const e of mm.memoryFlowers || []) {
        const code = e.ItemID;
        if (!code) continue;
        if (/^FA_/.test(code) && petalsOf(code) > 1) continue;
        add('flower', code, { code }, e.Location);
      }
    }
    // The group's display name: the first member's level name (both maps of a merge group share it).
    if (!items.length) continue; // a map without countable entries (DuanHunShan) has no percentage in the game either
    groups.push({ id: gid, maps: members, name: levelName(members[0]) || levelName(members[1] || '') || null, items });
  }
  // Bell names for the "nearest bell" column.
  const bellNames = {};
  for (const g of groups) for (const it of g.items) if (it.bell && !bellNames[it.bell]) bellNames[it.bell] = nameOf(it.bell);
  return { format: 1, categories: CATEGORIES, groups, bellNames };
}

// ---- completion ----------------------------------------------------------------

// Which maps count as reached: unlocked big-map masks, maps whose bells were used, the header's region map.
function reachedMaps(st) {
  return new Set([...(st.maps || []), ...(st.bellMaps || []), ...(st.region && st.region.code ? [st.region.code] : [])].map(lc));
}
const reached = (st, group) => { const r = reachedMaps(st); return (group.maps || []).some((m) => r.has(lc(m))); };

function detector(st) {
  const bells = new Set([...(st.bells || [])].map(lc));
  const nodes = st.nodes || new Set();
  const mobs = st.mobDomains || new Set();
  const actors = new Set(), tails = new Set();
  for (const k of st.actors || []) { const s = lc(k); actors.add(s); tails.add(s.split('-').pop()); }
  const acq = st.acquired || null;
  const cycle = typeof st.cycle === 'number' ? st.cycle : 0;
  const acquired = (table, code) => { const m = acq && acq[table]; const c = m ? m.get(lc(code)) : undefined; return c !== undefined && c === cycle; };
  const anyNode = (list) => (list || []).some((g) => nodes.has(lc(g)));
  const hasActor = (guid) => { if (!guid) return false; const g = lc(guid); return actors.has(g) || tails.has(g.split('-').pop()); };
  return (it) => {
    const d = it.det || {};
    switch (it.cat) {
      case 'bell': return bells.has(lc(d.bell));
      case 'weapon': return acquired('weapons', d.code);
      case 'phantomEdge': return acquired('phantomEdges', d.code);
      case 'accessory': return acquired('accessories', d.code);
      case 'medicine': return acquired('medicines', d.code);
      case 'challenge': return anyNode(d.nodes);
      case 'amber': case 'blackstone': return hasActor(d.guid) || (!!d.mob && mobs.has(lc(d.mob))) || anyNode(d.nodes);
      case 'flower': return acquired('items', d.code);
      default: return false;
    }
  };
}

function completion(st, table) {
  const done = detector(st);
  return (table.groups || []).map((g) => {
    const categories = {};
    for (const c of CATEGORIES) categories[c] = [0, 0];
    const items = g.items.map((it) => {
      const ok = done(it);
      const cat = categories[it.cat] || (categories[it.cat] = [0, 0]);
      cat[1]++;
      if (ok) cat[0]++;
      return { ...it, done: ok };
    });
    const total = items.length, current = items.filter((x) => x.done).length;
    return { id: g.id, maps: g.maps, name: g.name, percent: total ? Math.floor((current / total) * 100) : 0, current, total, categories, items };
  });
}

module.exports = { buildTable, completion, reached, reachedMaps, CATEGORIES, CHALLENGES };
