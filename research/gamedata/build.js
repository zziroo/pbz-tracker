'use strict';
// Step 2 of the game-data pipeline: turn the raw dumps (data/game/raw, from extract.js) into the derived tables in
// data/game/*.json (code → locres key → EN/ZH/TR text, map, category) and the per-map collectible registry.
//
//   node research/gamedata/build.js [--raw <dir>] [--out <dir>] [--save <save.json>]
//
// With --save, the codes of a decoded save (archive/*.json) are matched against the tables and the game's map
// "completion" is recomputed the way UI/Library/MapItemCompletionCalc.js does; the report goes to stdout and to
// research/gamedata/out/save-codes.json (gitignored: it describes one player's progress).
const fs = require('fs');
const path = require('path');
const { locTexts } = require('./lib/loctexts');

const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const RAW = path.resolve(opt('--raw', path.join(ROOT, 'data', 'game', 'raw')));
const OUT = path.resolve(opt('--out', path.join(ROOT, 'data', 'game')));
const SAVE = opt('--save', null);
fs.mkdirSync(OUT, { recursive: true });

const loadJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const en = loadJson(path.join(RAW, 'loc', 'en-US.json')), zh = loadJson(path.join(RAW, 'loc', 'zh-Hans.json'));
const trFile = path.join(RAW, 'loc', 'patch-tr.json');
const tr = fs.existsSync(trFile) ? loadJson(trFile) : {};
const dt = (n) => loadJson(path.join(RAW, 'dt', n + '.json'));
const names = (row) => row.toks.filter((t) => t.t === 'name').map((t) => t.v);
// The save code is the last FName of a row that is not a gameplay tag (weapon rows end with Weapon.Slot.* tags).
const lastCode = (row) => { const ns = names(row).filter((v) => !v.includes('.')); return ns[ns.length - 1]; };
const L = (key) => (key ? { key, en: en[key] ?? null, zh: zh[key] ?? null, tr: tr[key] ?? null } : null);
// descriptions are referenced by key only (the texts would triple the size of the tables)
const D = (key) => (key ? { key, hasEn: en[key] != null, hasTr: tr[key] != null } : null);
const clean = (s) => (s == null ? null : String(s).replace(/<[^>]+>/g, '').trim());

// ---- maps / chapters ----
const mapsDT = dt('DT_MapData'); const mapAlias = {}; const maps = {};
const CHAPTER_ROWS = /^(NiLiuerShang|ShiXinCun|SiZhen|YingxiongZuiren|MeiGuHu|BeiPanYuJianJin|PoJu|DuanHun|LongYuZhuo|LinZhongShaJi|DieXueZhiLu|HouShou)$/;
for (const row of mapsDT.rows) {
  const ns = names(row); const lt = locTexts(null, row.toks).map((x) => x.key); const id = row.name;
  const chapter = ns.find((v) => CHAPTER_ROWS.test(v)) || null;
  const world = ns.find((v) => /^PBZ_.*_WP$/.test(v)) || null;
  const big = ns.filter((v, i) => i > 0 && !/^(T_|W_|MI_|PBZ_)/.test(v) && !v.includes('.') && v !== chapter);
  maps[id] = { id, idLower: ns[0], levelNameKey: lt[0] || null, levelName: L(lt[0]), chapterRow: chapter, worldPartition: world, bigMap: big[0] || null, textures: ns.filter((v) => v.startsWith('T_')) };
  mapAlias[id.toLowerCase()] = id; if (ns[0]) mapAlias[ns[0].toLowerCase()] = id;
}
const mapOf = (ns) => { for (const v of ns) { const m = mapAlias[v.toLowerCase()]; if (m) return m; } return null; };
const chapters = {};
for (const row of dt('DT_ChapterData').rows) { const ns = names(row); const lt = locTexts(null, row.toks).map((x) => x.key); chapters[ns[0]] = { id: ns[0], row: row.name, titleKey: lt[0] || null, title: L(lt[0]) }; }

// ---- weapons / phantom edges ----
function weaponTable(file) {
  const out = {};
  for (const row of dt(file).rows) {
    const lt = locTexts(null, row.toks).map((x) => x.key); const code = lastCode(row);
    // the name slot normally holds Weapon_NNN / PhantomEdges_NNN; one row (HuoLiuXing) has a stray NPC key first
    const nameKey = lt.find((k) => /^(Weapon|PhantomEdges)_\d+$/.test(k)) || lt[0] || lt[1] || null;
    const descKey = lt.find((k) => /Des_\d+$/.test(k) && !/_UI_/.test(k)) || null;
    const uiDescKey = lt.find((k) => /Des_UI_\d+$/.test(k)) || null;
    const rec = { code, row: row.name, nameKey, name: L(nameKey), descKey, desc: D(descKey), uiDescKey };
    const tierUp = lt.find((k, i) => i > 20 && /^(Weapon|PhantomEdges)_\d+$/.test(k) && k !== nameKey); if (tierUp) rec.tierUpTargetKey = tierUp;
    if (out[code]) (out[code].variants = out[code].variants || []).push(rec); else out[code] = rec;
  }
  // when a code has several rows, the main record is the one with a proper Weapon_/PhantomEdges_ name key
  for (const r of Object.values(out)) {
    if (!r.variants || /^(Weapon|PhantomEdges)_\d+$/.test(r.nameKey || '')) continue;
    const i = r.variants.findIndex((v) => /^(Weapon|PhantomEdges)_\d+$/.test(v.nameKey || ''));
    if (i < 0) continue;
    const main = r.variants[i]; const rest = r.variants.filter((_, j) => j !== i); delete r.variants;
    out[r.code] = { ...main, variants: [r, ...rest] };
  }
  return out;
}
const weapons = weaponTable('DT_WeaponData'), edges = weaponTable('DT_ShaqiWeaponData');

// ---- accessories / medicines ----
const accessories = {};
for (const row of dt('DT_Accessory').rows) {
  const lt = locTexts(null, row.toks).map((x) => x.key); const code = lastCode(row);
  const descKey = lt.find((k) => /^Item_AccessoryDes_\d+$/.test(k)) || null; const funcKey = lt.find((k) => /FunctionDes_\d+$/.test(k)) || null; const refKey = lt.find((k) => /^Item_Accessory_\d+_1$/.test(k)) || null;
  accessories[code] = { code, row: row.name, nameKey: lt[0] || null, name: L(lt[0]), descKey, desc: D(descKey), funcKey, func: D(funcKey), uiDescKey: lt.find((k) => /Des_UI_\d+$/.test(k)) || null, refinedNameKey: refKey, refinedName: L(refKey), unused: !lt[0] };
}
const medicines = {};
for (const row of dt('DT_MedicineTable').rows) {
  const lt = locTexts(null, row.toks).map((x) => x.key); const code = lastCode(row);
  const descKey = lt.find((k) => /MedicineDes_\d+$/.test(k)) || null; const funcKey = lt.find((k) => /FunctionDes_\d+$/.test(k)) || null;
  medicines[code] = { code, row: row.name, nameKey: lt[0] || null, name: L(lt[0]), descKey, desc: D(descKey), funcKey, func: D(funcKey) };
}

// ---- items (DT_InventoryData) ----
// Category from the code prefix (the row's ItemType enum is a byte we do not decode without the struct schema).
function itemCategory(code) {
  if (/^Page_/.test(code)) return 'page'; if (/^Book_/.test(code)) return 'book'; if (/^R_/.test(code)) return 'letter';
  if (/^FA_/.test(code)) return 'memory-flower'; if (/^F_/.test(code)) return 'memory-flower-petal'; if (/^FS_/.test(code)) return 'memory-flower-special';
  if (/^K_/.test(code)) return 'key'; if (/^TU_/.test(code)) return 'tier-up-fragment'; if (/^T_/.test(code)) return 'tier-up-material'; if (/^I_/.test(code)) return 'key-item';
  if (/^Weapon_Material/.test(code)) return 'weapon-material'; if (/^Ac_Material/i.test(code)) return 'accessory-material'; if (/^Medi_Material/.test(code)) return 'medicine-material';
  if (/^Item_Piece/.test(code)) return 'blackstone-piece'; if (/^Return_/.test(code)) return 'return-token'; if (/^Item_/.test(code)) return 'item'; return 'other';
}
const items = {};
for (const row of dt('DT_InventoryData').rows) {
  const ns = names(row); const lt = locTexts(null, row.toks).map((x) => x.key); const code = lastCode(row); if (!code) continue;
  // LocText slots of PBZItemDataStruct: [0]=Name [1]=Desc [2]=FuncDesc [3]=? [4]=Title (letters/pages) [5]=?
  const nameKey = lt[0] || lt[4] || null; const descKey = lt[1] || null; const funcKey = lt[2] || null;
  const book = ns.find((v) => /^Book_/.test(v) && v !== code) || null; const map = mapOf(ns.filter((v) => v !== code));
  const flowerGroup = ns.find((v) => /_MEM_|^MEM_/.test(v)) || null; const tags = ns.filter((v) => v.includes('.'));
  const rec = { code, row: row.name, category: itemCategory(code), nameKey, name: L(nameKey), descKey, desc: D(descKey), funcKey, locTextKeys: lt, map, book, flowerGroup, tags: tags.length ? tags : undefined };
  if (!nameKey) rec.unnamed = true;
  if (items[code]) (items[code].duplicates = items[code].duplicates || []).push(rec); else items[code] = rec;
}

// ---- bells ----
const bells = {};
for (const row of dt('DT_BellData').rows) {
  const ns = names(row); const strs = row.toks.filter((t) => t.t === 'str' && t.v !== 'Default').map((t) => t.v); const id = ns[0];
  const map = mapOf(ns.slice(1)); const fog = ns.find((v) => /^WorldMapFog_/.test(v)) || null; const link = ns.slice(1).find((v) => /^(Bell|BrokenBell)_/i.test(v)) || null;
  bells[id] = { id, row: row.name, nameKey: strs[0] || null, name: L(strs[0]), map, fogRegion: fog, linkedBell: link, broken: /^BrokenBell/i.test(id) };
}

// ---- quests (DT_QuestText: row = quest class path; title LocText, then branch id → description LocText) ----
const quests = {}; let cur = null;
for (const row of dt('DT_QuestText').rows) {
  const lt = locTexts(null, row.toks).map((x) => x.key);
  if (row.name.startsWith('/Game/') && row.name.includes('.')) {
    const cls = row.name.split('.').pop();
    // the title slot usually holds a Quest(Story|Maze|Rumor|Collect)_* key; some main quests reuse a Chapter_* key
    // and two side quests a Bell_* key (the text the quest log shows)
    const titleKey = lt.find((k) => /^Quest(Story|Maze|Rumor|Collect)_/.test(k) && !/Des|Details/.test(k)) || lt.find((k) => k && !/Des|Details/.test(k)) || null;
    cur = quests[row.name] = { classPath: row.name, className: cls, id: cls.replace(/_C$/, ''), titleKey, title: L(titleKey), branches: {} };
  } else if (cur && !row.name.startsWith('/') && !/^PBZQuestBranch/.test(row.name)) cur.branches[row.name] = { key: lt[0] || null, text: D(lt[0]) };
}

// ---- achievements ----
const achievements = {};
for (const row of dt('DT_Achievement').rows) { const lt = locTexts(null, row.toks).map((x) => x.key); const ns = names(row); achievements[row.name] = { id: row.name, nameKey: lt[0] || null, name: L(lt[0]), descKey: lt[1] || null, desc: D(lt[1]), tag: ns.find((v) => v.includes('.')) || null }; }

// ---- map-item registry (completion panel data) ----
const mi = loadJson(path.join(RAW, 'mapitem.json'));
// Array slots of FSubMapItemData in serialization order; labels come from their contents (bell ids, F_/FA_/FS_
// flower items, K_ keys, weapon/edge/accessory/medicine codes, flow-event challenge points, chest + mob-domain pairs).
const SLOTS = { A0: 'bells', A1: 'domainItemsA', A2: 'domainItemsB', A3: 'memoryFlowers', A4: 'keys', A5: 'primaryItems', A6: 'weapons', A7: 'phantomEdges', A8: 'accessories', A9: 'medicines', A10: 'rongShu', A11: 'longZhu', A12: 'daoCaoRen' };
const strip = (e) => { const o = {}; for (const [k, v] of Object.entries(e)) { if (v === 'None' || v == null || (Array.isArray(v) && v.length === 0) || v === 0) continue; o[k] = v; } return o; };
const mapItems = {};
for (const [mapId, sub] of mi.MapItemDatas) { const o = { mapId }; for (const [slot, label] of Object.entries(SLOTS)) o[label] = (sub[slot] || []).map(strip); mapItems[mapId] = o; }
const allItemIds = {}; for (const [mapId, v] of mi.MapItemIds) allItemIds[mapId] = v.Ids;
const flowNames = (label) => [...new Set(Object.values(mapItems).flatMap((mm) => mm[label].map((e) => e.FlowEvent).filter(Boolean)))].sort();

// ---- write ----
const meta = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'Phantom Blade Zero, Steam build 26367565 (2026-11-04): ProjectPBZ-Windows.utoc/.pak and the Turkish text patch ProjectPBZ-Windows_C.pak',
  method: 'IoStore/pak indexes decrypted with the public pak AES key; DataTable exports scanned for FString/FText/FName tokens (schema-free, no usmap); names resolved through Game.locres. See research/gamedata/README.md.',
  languages: { en: 'en-US Game.locres', zh: 'zh-Hans Game.locres', tr: 'Turkish patch locres (ProjectPBZ-Windows_C.pak), empty when the patch is not installed' },
};
const w = (n, o) => fs.writeFileSync(path.join(OUT, n), JSON.stringify({ _meta: meta, ...o }, null, 1) + '\n');
w('weapons.json', { weapons }); w('phantom-edges.json', { phantomEdges: edges }); w('accessories.json', { accessories }); w('medicines.json', { medicines });
w('items.json', { items }); w('bells.json', { bells }); w('maps.json', { maps, chapters }); w('quests.json', { quests }); w('achievements.json', { achievements });
w('map-items.json', { _note: 'Per-map collectible registry behind the game\'s map completion panel. Locations are FIntVector world coordinates (cm). domainItemsA/B are the two chest + mob-domain lists (amber / blackstone drops) counted together as "domain items". Completion algorithm: README.md.', excludedFromTotalCompletion: ['test', 'huanshushi', 'xuesesenlin'], mergeGroups: { pangzhen: ['pangzhen', 'houjie'], meiguhu: ['meiguhu', 'meigu_yiji'] }, challengeFlowEvents: { rongShu: flowNames('rongShu'), longZhu: flowNames('longZhu'), daoCaoRen: flowNames('daoCaoRen') }, maps: mapItems, allItemIds });
// code index: every save code we know → table + display name (one flat lookup for the tracker)
const codeIndex = {};
const add = (tbl, group, nameOf) => { for (const [code, r] of Object.entries(tbl)) { const nm = nameOf(r); codeIndex[code] = { table: group, nameKey: nm && nm.key, en: clean(nm && nm.en), tr: clean(nm && nm.tr), zh: clean(nm && nm.zh), ...(r.category ? { category: r.category } : {}), ...(r.map ? { map: r.map } : {}) }; } };
add(items, 'items', (r) => r.name); add(weapons, 'weapons', (r) => r.name); add(edges, 'phantomEdges', (r) => r.name); add(accessories, 'accessories', (r) => r.name); add(medicines, 'medicines', (r) => r.name); add(bells, 'bells', (r) => r.name);
for (const q of Object.values(quests)) codeIndex[q.id] = { table: 'quests', classPath: q.classPath, nameKey: q.titleKey, en: clean(q.title && q.title.en), tr: clean(q.title && q.title.tr), zh: clean(q.title && q.title.zh) };
w('code-index.json', { codes: codeIndex });
console.log('weapons', Object.keys(weapons).length, 'phantom edges', Object.keys(edges).length, 'accessories', Object.keys(accessories).length, 'medicines', Object.keys(medicines).length, 'items', Object.keys(items).length, 'bells', Object.keys(bells).length, 'maps', Object.keys(maps).length, 'quests', Object.keys(quests).length, 'achievements', Object.keys(achievements).length, 'map-item maps', Object.keys(mapItems).length);

if (!SAVE) process.exit(0);

// ---- save check ----
const save = loadJson(SAVE);
const lc = (o) => { const m = {}; for (const k in o) m[k.toLowerCase()] = o[k]; return m; };
const LW = lc(weapons), LE = lc(edges), LA = lc(accessories), LM = lc(medicines), LI = lc(items), LB = lc(bells);
const LQ = {}; for (const q of Object.values(quests)) LQ[q.classPath.toLowerCase()] = q;
const res = { _meta: { ...meta, save: path.basename(SAVE) }, matched: {}, unmatched: {} };
function match(group, codes, tbl, nameOf) {
  res.matched[group] = {}; res.unmatched[group] = [];
  for (const c of codes) { const r = tbl[c.toLowerCase()]; if (!r) { res.unmatched[group].push(c); continue; } const nm = nameOf(r); res.matched[group][c] = { code: r.code || r.id || r.className, nameKey: nm && nm.key, en: clean(nm && nm.en), tr: clean(nm && nm.tr) }; }
}
const inv = save.Inventory || {};
match('items', Object.keys(inv.InventoryInfos || {}), LI, (r) => r.name);
match('weapons', Object.keys(inv.MainWeaponInfos || {}), LW, (r) => r.name);
match('phantomEdges', Object.keys(inv.ShaChiWeaponInfo || {}), LE, (r) => r.name);
match('accessories', Object.keys(inv.AccessoryInfos || {}), LA, (r) => r.name);
match('medicines', Object.keys(inv.MedicineInfos || {}), LM, (r) => r.name);
match('bells', (save.BellManager && save.BellManager.ActivateBellIDs) || [], LB, (r) => r.name);
const nar = save.Narrative || {};
const qcls = [...new Set([...(nar.NarrativeSavedQuests || []).map((q) => q.QuestClass), ...(nar.QuestGameTimes || []).map((q) => q.QuestClass)])];
match('quests', qcls, LQ, (r) => r.title);
for (const g in res.matched) console.log(g.padEnd(13), 'matched', String(Object.keys(res.matched[g]).length).padStart(4), 'unmatched', res.unmatched[g].length, res.unmatched[g].slice(0, 12).join(' '));

// completion, mirroring UI/Library/MapItemCompletionCalc.js
const cycle = (save.PBZGameSystem && save.PBZGameSystem.CycleCount) || 0;
const lcSet = (arr) => new Set((arr || []).map((s) => String(s).toLowerCase()));
const activeBells = lcSet(save.BellManager && save.BellManager.ActivateBellIDs);
const execNodes = lcSet(Object.keys((save.EventPipeline && save.EventPipeline.ExecuteNodeGuid) || {}));
const actorKeys = lcSet(Object.keys(save.LevelActorManager || {}));
const mobDomains = lcSet(save.PBZGameSystem && save.PBZGameSystem.CompleteAddItemMobDomainNames);
const acquired = (tbl, id) => { const k = Object.keys(tbl || {}).find((x) => x.toLowerCase() === String(id).toLowerCase()); return !!k && (tbl[k].AcquiredCycle ?? 0) === cycle; };
const anyNode = (guids) => (guids || []).some((g) => execNodes.has(String(g).toLowerCase()));
const hasActor = (guid) => { if (!guid) return false; const g = String(guid).toLowerCase(); if (actorKeys.has(g)) return true; const tail = g.split('-').pop(); for (const k of actorKeys) if (k === tail || k.endsWith('-' + tail)) return true; return false; };
const flat = new Set(Object.values(allItemIds).flat());
const petalsOf = (fa) => [...flat].filter((c) => /^F_/.test(c) && c.slice(2, 6) === fa.slice(3, 7));
function completion(mapIds) {
  const r = { bells: [0, 0], weapons: [0, 0], phantomEdges: [0, 0], accessories: [0, 0], medicines: [0, 0], challenges: [0, 0], domain: [0, 0], flowers: [0, 0], missing: [] };
  const bellSet = new Set(), wSet = new Set(), sSet = new Set(), aSet = new Set(), mSet = new Set(); const challenges = [], domain = [], flowers = [];
  for (const id of mapIds) {
    const mm = mapItems[id]; if (!mm) continue;
    mm.bells.forEach((e) => bellSet.add(e.BellID)); mm.weapons.forEach((e) => { if (e.ID && e.ID.toLowerCase() !== 'zimingjian') wSet.add(e.ID); }); mm.phantomEdges.forEach((e) => e.ID && sSet.add(e.ID)); mm.accessories.forEach((e) => e.ID && aSet.add(e.ID)); mm.medicines.forEach((e) => e.ID && mSet.add(e.ID));
    for (const l of ['rongShu', 'longZhu', 'daoCaoRen']) mm[l].forEach((e) => challenges.push({ ...e, kind: l }));
    for (const l of ['domainItemsA', 'domainItemsB']) mm[l].forEach((e) => domain.push({ ...e, kind: l }));
    mm.memoryFlowers.forEach((e) => flowers.push(e));
  }
  const tick = (key, ok, label) => { r[key][1]++; if (ok) r[key][0]++; else r.missing.push(label); };
  for (const b of bellSet) tick('bells', activeBells.has(b.toLowerCase()), 'bell ' + b);
  for (const x of wSet) tick('weapons', acquired(inv.MainWeaponInfos, x), 'weapon ' + x);
  for (const x of sSet) tick('phantomEdges', acquired(inv.ShaChiWeaponInfo, x), 'phantom edge ' + x);
  for (const x of aSet) tick('accessories', acquired(inv.AccessoryInfos, x), 'accessory ' + x);
  for (const x of mSet) tick('medicines', acquired(inv.MedicineInfos, x), 'medicine ' + x);
  for (const c of challenges) tick('challenges', anyNode(c.NodeGuids), `${c.kind} ${c.FlowEvent || ''} @${JSON.stringify(c.Location)}`);
  for (const d of domain) tick('domain', hasActor(d.SaveGuid) || (d.MobDomainName && mobDomains.has(d.MobDomainName.toLowerCase())) || anyNode(d.NodeGuids), `${d.kind} ${d.SaveGuid || d.MobDomainName || d.FlowEvent || ''} @${JSON.stringify(d.Location)}`);
  for (const f of flowers) { const id = f.ItemID; if (!id) continue; if (/^FA_/.test(id) && petalsOf(id).length > 1) continue; tick('flowers', acquired(inv.InventoryInfos, id), `flower ${id} @${JSON.stringify(f.Location)}`); }
  let curN = 0, tot = 0; for (const k of ['bells', 'weapons', 'phantomEdges', 'accessories', 'medicines', 'challenges', 'domain', 'flowers']) { curN += r[k][0]; tot += r[k][1]; }
  r.percent = tot ? Math.floor((curN / tot) * 100) : 0; r.current = curN; r.total = tot; return r;
}
res.completion = {};
const groups = { pangzhen: ['PangZhen', 'HouJie'], meiguhu: ['MeiGuHu', 'MeiGu_YiJi'] };
const grouped = new Set(Object.values(groups).flat());
for (const [g, ids] of Object.entries(groups)) res.completion[g] = completion(ids);
for (const id of Object.keys(mapItems)) if (!grouped.has(id) && !['Test', 'HuanShuShi', 'XueSeSenLin'].includes(id)) res.completion[id] = completion([id]);
console.log('completion (cycle', cycle + '):');
for (const [k, r] of Object.entries(res.completion)) if (r.total) console.log(' ', k.padEnd(16), `${String(r.percent).padStart(3)}% (${r.current}/${r.total})`, r.missing.length ? ' missing: ' + r.missing.join(' | ') : '');
const repDir = path.join(__dirname, 'out'); fs.mkdirSync(repDir, { recursive: true });
fs.writeFileSync(path.join(repDir, 'save-codes.json'), JSON.stringify(res, null, 1) + '\n');
console.log('report →', path.join(repDir, 'save-codes.json'));
