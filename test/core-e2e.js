#!/usr/bin/env node
'use strict';
// End-to-end check of the portable core, run inside the browser-style sandbox of test/core-portability.js
// (no require of Node built-ins, no Buffer, no process): the core derives the key from the real PBZ.exe,
// finds text patches in Paks/, decodes the save and renders the terminal report. The text must equal
// what `node pbz.js --cli --no-color` prints for the same game folder and save.
//
// Readers are plain positioned fs reads (fs.readSync on a read-only fd), plus one key derivation over a
// Blob (fs.openAsBlob) to exercise the File-style reader a browser would use. Strictly read-only.
//
// Usage: node test/core-e2e.js [--game <PBZ folder>] [--save <PBZSaveGame.sav>]
//   (defaults: PBZ_GAME / the CLI's own game detection; PBZ_SAVE / the remembered or detected save)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadSandbox } = require('./core-portability');

const ROOT = path.resolve(__dirname, '..');
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };

// ---- fs-backed positioned reader (the Node side of the core's reader interface) ----
function fsReader(file) {
  const fd = fs.openSync(file, 'r');
  const size = fs.fstatSync(fd).size;
  return {
    size,
    name: path.basename(file),
    async read(offset, length) {
      const len = Math.max(0, Math.min(length, size - offset));
      const b = new Uint8Array(len);
      let got = 0;
      while (got < len) {
        const n = fs.readSync(fd, b, got, len - got, offset + got);
        if (n === 0) break;
        got += n;
      }
      return b.subarray(0, got);
    },
    close() { fs.closeSync(fd); },
  };
}
const ms = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;

async function main() {
  // Paths and header metadata come from the Node side, exactly as the CLI resolves them.
  const paths = require('../lib/paths');
  const { readConfig } = require('../lib/config');
  const { loadRules, loadNameTables } = require('../lib/datafiles');
  const gameDir = paths.findGameDir(arg('--game', process.env.PBZ_GAME));
  const exe = paths.findExe(gameDir);
  let save = arg('--save', process.env.PBZ_SAVE);
  if (!save) { const c = readConfig().savePath; save = c && paths.isFile(c) ? c : await paths.findSave(gameDir, { prompt: false }); }
  const paksDir = path.join(gameDir, 'ProjectPBZ', 'Content', 'Paks');
  console.log(`game: ${gameDir}\nexe:  ${exe}\nsave: ${save}`);

  let fails = 0;
  const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) fails++; };

  // ---- key, once from fs positioned reads and once from a Blob ----
  const core0 = loadSandbox().require('./lib/core');
  const exeR = fsReader(exe);
  let t0 = process.hrtime.bigint();
  let key;
  try { key = await core0.deriveKeyFromReader(exeR, { label: exe }); } finally { exeR.close(); }
  const keyMs = ms(t0);
  check(key.length === 32, `key from fs reader: ${(exeR.size / 1048576).toFixed(0)} MB scanned in ${keyMs.toFixed(0)} ms`);
  t0 = process.hrtime.bigint();
  const key2 = await core0.deriveKeyFromReader(core0.readers.fromBlob(await fs.openAsBlob(exe), path.basename(exe)));
  check(core0.bytes.equalBytes(key, key2), `key from Blob reader matches (${ms(t0).toFixed(0)} ms)`);
  t0 = process.hrtime.bigint();
  const keyNode = await require('../lib/key').deriveKey(exe);
  check(Buffer.from(keyNode).equals(Buffer.from(key)), `Node wrapper lib/key.js gives the same key (${ms(t0).toFixed(0)} ms)`);

  // Save bytes: one read-only snapshot shared by all variants.
  const saveR = fsReader(save);
  let saveBytes;
  try { saveBytes = await saveR.read(0, saveR.size); } finally { saveR.close(); }

  const rulesInfo = loadRules({ embedded: require('../data/rules.json') });
  const nameTables = loadNameTables(require('../lib/names').EMBEDDED_TABLES);
  const dataInfo = { rules: rulesInfo, nameFiles: nameTables.files };
  const buildId = paths.findBuildId(gameDir);

  const variants = [
    { args: [] },
    { args: ['--show'], show: true },
    { args: ['--lang', 'en'], lang: 'en' },
    { args: ['--names', 'en'], names: 'en' },
  ];
  const env = { ...process.env };
  delete env.PBZ_LANG;
  for (const v of variants) {
    // Fresh sandbox per variant: the UI language is module state in i18n.
    const sb = loadSandbox();
    const core = sb.require('./lib/core');
    const i18n = sb.require('./lib/i18n');
    const { extract } = sb.require('./lib/state');
    const { build, render, statusMap, diff } = sb.require('./lib/report');
    const { TESTED_BUILDS } = sb.require('./lib/version');
    if (v.lang) i18n.setLang(v.lang);

    t0 = process.hrtime.bigint();
    const patches = await core.findTextPatchesFrom(() => fs.readdirSync(paksDir), (f) => fsReader(path.join(paksDir, f)));
    const patchMs = ms(t0);
    i18n.applyAutoLang(patches.some((p) => core.looksTurkish(p.map)));
    t0 = process.hrtime.bigint();
    const { latest, slots } = await core.decodeSave(saveBytes, key);
    const decMs = ms(t0);
    const names = core.createNamesFrom({ patches, uiLang: i18n.getLang(), names: v.names, tables: nameTables.tables });
    const st = extract(latest.data);
    const result = build(st, rulesInfo.rules, names);
    const text = render({ st, result, names, build: { id: buildId, tested: !!buildId && TESTED_BUILDS.includes(buildId) }, data: dataInfo,
      color: false, show: !!v.show, changes: diff(null, statusMap(result)), hiddenKey: false });

    const cli = execFileSync(process.execPath, [path.join(ROOT, 'pbz.js'), '--cli', '--no-color', '--game', gameDir, '--save', save, ...v.args],
      { encoding: 'utf8', env, cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const same = cli === `${text}\n`;
    check(same, `report [${v.args.join(' ') || 'default'}] equals the CLI output (${slots.length} slots, latest ${latest.name}; patches ${patches.map((p) => p.name).join(', ') || '-'} in ${patchMs.toFixed(0)} ms; decode ${decMs.toFixed(0)} ms)`);
    if (!same) {
      const a = cli.split('\n'), b = `${text}\n`.split('\n');
      const k = a.findIndex((l, i) => l !== b[i]);
      console.log(`      first difference at line ${k + 1}:\n      cli:  ${JSON.stringify(a[k])}\n      core: ${JSON.stringify(b[k])}`);
    }
  }

  // ---- exact mode, diagnostics and timeline on the real save (browser sandbox) ----
  {
    const os = require('os');
    const sb = loadSandbox();
    const core = sb.require('./lib/core');
    const i18n = sb.require('./lib/i18n');
    const { extract } = sb.require('./lib/state');
    const { build, makeEval, regionLine } = sb.require('./lib/report');
    const { collectDiagnostics, formatDiagnostics } = sb.require('./lib/diagnostics');
    const { createTimeline, exportTimeline, snapshotOf, itemSnapshotOf } = sb.require('./lib/timeline');
    i18n.setLang('en');
    const rules = rulesInfo.rules;
    const { latest } = await core.decodeSave(saveBytes, key);
    const st = extract(latest.data);
    const names = core.createNamesFrom({ uiLang: 'en', tables: nameTables.tables });

    // Exact mode: whereExact only where exactWhen is true; the default build is unchanged.
    const plain = build(st, rules, names);
    const exact = build(st, rules, names, { exact: true });
    const pickEn = (v) => (typeof v === 'string' ? v : v?.en);
    const cutoffOf = (where) => Object.entries(rules.cutoffs).find(([, c]) => pickEn(c.where) === where || pickEn(c.whereExact) === where);
    check(plain.warnings.every((w) => cutoffOf(w.where) && pickEn(cutoffOf(w.where)[1].where) === w.where), 'default build: every warning uses the vague `where` text');
    let named = 0, vague = 0;
    for (const w of exact.warnings) {
      const [id, c] = cutoffOf(w.where) || [];
      const reached = !!c?.whereExact && c.exactWhen && !('unknown' in c.exactWhen);
      if (pickEn(c?.whereExact) === w.where) named++; else vague++;
      // A cutoff whose exactWhen is unknown (no region code yet) or false for this save must keep the vague text.
      const exactOk = c ? makeEval(st, rules)(c.exactWhen) === true : false;
      if (c && !exactOk) check(w.where === pickEn(c.where), `exact mode: ${id} keeps its vague text (area not reached / code unknown)`);
      else if (reached && id) console.log(`      exact: ${id} → ${w.where}`);
    }
    check(named > 0, `exact mode names ${named} warning(s), ${vague} stay vague`);

    // Diagnostics: no personal data, even with hostile inputs (full paths where only names belong).
    const user = (() => { try { return os.userInfo().username; } catch { return process.env.USERNAME || ''; } })();
    const needles = [os.homedir(), gameDir, save, path.dirname(save), exe, '7656119', user].filter((s) => s && s.length >= 3);
    // Hostile item codes (paths) with a time inside the 24 h window: they must not reach the report either.
    const hostileItems = new Map([...st.items, [save, { table: 'inventory', time: st.dateTime, held: true }], [os.homedir(), { table: 'accessory', time: st.dateTime, held: true }]]);
    const d = collectDiagnostics({
      mode: 'web', version: '0.0.0-test', uiLang: 'en', exact: true,
      rules: { version: rules.rulesVersion, schemaVersion: 1, source: 'sidecar' },
      keyMap: require('../data/names.json'),
      namesSource: path.join(paksDir, 'ProjectPBZ-Windows_C.pak'),
      nameFiles: [path.join(path.dirname(save), 'names.xx.json')],
      patches: [path.join(paksDir, 'ProjectPBZ-Windows_C.pak')],
      build: { id: buildId, tested: true },
      st: { ...st, items: hostileItems }, result: { ...exact, unmatched: [...exact.unmatched, { id: save, folder: path.dirname(save), completion: os.homedir() }] },
      ok: true,
      timeline: { enabled: true, count: 3, error: `EACCES ${os.homedir()}` },
    });
    const text = formatDiagnostics(d);
    const blob = `${text}\n${JSON.stringify(d)}`.toLowerCase();
    const leaks = needles.filter((n) => blob.includes(n.toLowerCase()) || blob.includes(n.toLowerCase().replace(/\\/g, '/')) || blob.includes(JSON.stringify(n).slice(1, -1).toLowerCase()));
    check(leaks.length === 0, `diagnostics report has no personal data (checked: home dir, game path, save path, exe, '7656119', OS user; also as item codes)${leaks.length ? ` — LEAK: ${leaks.length}` : ''}`);
    const itemLines = text.split('\n').filter((l) => /^ {2}- /.test(l) && text.indexOf(l) > text.indexOf('items acquired'));
    const ri = d.recentItems;
    check(Array.isArray(ri) && ri.length > 0 && ri.length <= 30 && ri.every((x, i) => Object.keys(x).join() === 'code,ago' && Number.isInteger(x.ago) && x.ago <= 86400 && (i === 0 || ri[i - 1].ago <= x.ago))
      && ri.some((x) => x.code === '?') && itemLines.length === ri.length && itemLines.every((l) => /^ {2}- [A-Za-z0-9_.?-]+ {2}[-+]\d+:\d{2}:\d{2}$/.test(l)) && !/\d{2}\.\d{2}\.\d{2}/.test(itemLines.join('\n')),
      `diagnostics recent items: ${ri ? ri.length : '-'} codes, newest first, offsets before the save only (no time of day, no names; hostile codes → "?")`);
    check(/text patch: ProjectPBZ-Windows_C\.pak/.test(text) && /date \d{4}-\d{2}-\d{2} /.test(text) && !/\d{2}\.\d{2}\.\d{2}\b/.test(text.split('\n').find((l) => l.startsWith('save:')) || ''),
      'diagnostics keep the pak file name and only the date of the save');
    const real = collectDiagnostics({ mode: 'web', version: '0.0.0-test', uiLang: 'en', rules: { version: rules.rulesVersion, schemaVersion: 1, source: 'embedded' },
      keyMap: require('../data/names.json'), namesSource: names.source, patches: [], build: { id: buildId, tested: true }, st, result: plain, ok: true, timeline: null });
    console.log(formatDiagnostics(real).trimEnd().split('\n').map((l) => `      | ${l}`).join('\n'));

    // Items on the real save: the four Inventory tables, table + time + held only; itemSeen.
    const TIME = /^\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}$/;
    const tables = new Set([...st.items.values()].map((v) => v.table));
    check(['mainWeapon', 'shaChiWeapon', 'accessory', 'inventory'].every((x) => tables.has(x))
      && [...st.items.values()].every((v) => Object.keys(v).sort().join() === 'held,table,time' && (v.time === null || TIME.test(v.time))),
      `items: ${st.items.size} codes from MainWeaponInfos / ShaChiWeaponInfo / AccessoryInfos / InventoryInfos (table, time, held only)`);
    const evR = makeEval(st, rules);
    const held = [...st.items].find(([, v]) => v.held), usedUp = [...st.items].find(([, v]) => !v.held);
    check(evR({ itemSeen: held[0] }) === true && (!usedUp || evR({ itemSeen: usedUp[0] }) === false) && evR({ itemSeen: 'NoSuchItem_000' }) === false,
      `itemSeen on the real save: held → true, used up (CurrentAmount 0${usedUp ? `, e.g. ${usedUp[0]}` : ', none here'}) → false, absent → false`);
    // Header area: from the region maps (last bell used), never from the level name.
    // The expected map is computed here independently: the newest RecentlyInteractedAtByMap entry.
    const loc = regionLine(st, names);
    const byMap = Object.entries(latest.data.BellManager?.RecentlyInteractedAtByMap || {}).sort((a, b) => b[1] - a[1]);
    const wantName = byMap.length ? names.region(byMap[0][0]) : null;
    check(byMap.length > 0 && !!wantName && !!loc && loc.loc === wantName && loc.src === 'last bell used' && st.region.code === byMap[0][0],
      `header area: newest bell map ${byMap.length ? byMap[0][0] : '-'} → "${loc ? loc.loc : '-'}" (${loc ? loc.src : '-'}), level ${st.currentLevel} not used`);

    // A save without Inventory: items unknown → the sword rule is "unknown" (never "missed") even with the
    // lift cutoff passed, and the timeline logs no items and keeps its stored item snapshot.
    const passLift = (s) => ({ ...s, quests: new Map([...s.quests, ['MainCh1-ShiXinCun', { id: 'MainCh1-ShiXinCun', folder: 'Main', completion: 'Succeded', branches: {}, progress: null }]]) });
    const stNoInv = extract({ ...latest.data, Inventory: null });
    const swordOf = (s) => build(s, rules, names).closed.find((x) => x.key === 'lu-elevator-sword') || {};
    const thiefOf = (s) => build(s, rules, names).infoLater.concat(build(s, rules, names).infoNow).find((x) => x.key === 'lu-wounded-thief-manual') || {};
    const noInvSword = swordOf(passLift(stNoInv)), emptySword = swordOf(passLift({ ...st, items: new Map() }));
    let nStore = null;
    const ntl = createTimeline({ load: () => nStore, save: (x) => { nStore = JSON.parse(JSON.stringify(x)); } });
    await ntl.record(st, 'n1');
    const storedItems = JSON.stringify(nStore.items);
    const n2 = await ntl.record(stNoInv, 'n2');
    const n3 = await ntl.record(st, 'n3');
    check(stNoInv.items === null && noInvSword.status === 'unknown' && emptySword.status === 'missed' && thiefOf(stNoInv).done === false
      && !n2.some((r) => r.kind === 'item') && !n3.some((r) => r.kind === 'item') && JSON.stringify(nStore.items) === storedItems,
      `save without Inventory: sword rule ${noInvSword.status} with the cutoff passed (empty item tables → ${emptySword.status}); thief info not done; timeline items ${n2.length}/${n3.length}, snapshot kept`);
    const dNoInv = collectDiagnostics({ st: stNoInv, ok: true });
    check(dNoInv.recentItems === null && dNoInv.save.inventory === false && /no Inventory in this save/.test(formatDiagnostics(dNoInv)), 'diagnostics: a save without Inventory says so');
    // Mandate Encampment rules are bell-based: before the encampment (only the outer-gate bell lit on the way
    // to the Village of Lu), neither the Baishan body warning nor the Red warning is in the default view.
    const encReached = [...st.bells].some((b) => /^Bell_(YXZR|ZDDY)/.test(b) && b !== 'Bell_YXZR_018');
    if (!encReached) {
      check(!plain.infoNow.some((i) => i.key === 'red-encampment') && !plain.warnings.some((w) => w.named.some((it) => it.key === 'baishan-body')),
        'real save before the encampment: no Red / Baishan body warning in the default view');
    } else console.log('      (this save has encampment bells: the before-encampment check is skipped)');

    // Timeline: baseline, no duplicates on a re-read, one record for one change, the cap.
    let stored = null;
    const tl = createTimeline({ load: () => stored, save: (x) => { stored = JSON.parse(JSON.stringify(x)); } });
    const first = await tl.record(st, '2026-01-01T00:00:00.000Z');
    const again = await tl.record(st, '2026-01-01T00:01:00.000Z');
    const st2 = { ...st, dateTime: 'later', quests: new Map([...st.quests].map(([k, q]) => [k, { ...q, branches: { ...q.branches } }])) };
    const q0 = [...st2.quests.values()].find((q) => q.completion === 'Started');
    q0.completion = 'Succeded';
    const third = await tl.record(st2, '2026-01-01T00:02:00.000Z');
    const tl2 = createTimeline({ load: () => stored, save: () => {} }); // "restart": the stored snapshot is used
    const afterRestart = await tl2.record(st2, '2026-01-01T00:03:00.000Z');
    check(first.length === st.quests.size && again.length === 0 && third.length === 1 && third[0].from === 'Started' && third[0].to === 'Succeded' && afterRestart.length === 0,
      `timeline: baseline ${first.length}, re-read 0, one change → ${third.length} record, restart → ${afterRestart.length}`);
    let capStore = null;
    const capped = createTimeline({ load: () => null, save: (x) => { capStore = x; }, cap: 5 });
    await capped.record(st, 'x');
    check(capStore.records.length === 5 && capStore.records[4].questId === [...st.quests.keys()].pop(), 'timeline: capped, oldest records dropped');
    let warned = 0;
    const failing = createTimeline({ load: () => null, save: () => { throw Object.assign(new Error('nope'), { code: 'EACCES' }); }, warn: () => { warned++; } });
    const r1 = await failing.record(st, 'x'); await failing.record(st2, 'y');
    check(r1.length === st.quests.size && warned === 1 && (await failing.status()).error === 'EACCES', 'timeline: a failing write never throws and warns once');
    const broken = createTimeline({ load: () => { throw new SyntaxError('bad json'); }, save: () => { throw new Error('must not overwrite'); }, warn: () => {} });
    check((await broken.record(st, 'x')).length === 0 && (await broken.status()).error === 'SyntaxError', 'timeline: an unreadable stored timeline is never overwritten');
    const ex = exportTimeline(stored.records, '0.0.0-test');
    console.log(`      timeline sample: ${JSON.stringify(third[0])}`);
    check(ex.count === stored.records.length && Array.isArray(ex.records), 'timeline export shape');

    // A quest that disappears (an older save loaded) gets one record with to: null.
    const st3 = { ...st2, dateTime: 'older', quests: new Map([...st2.quests].filter(([k]) => k !== q0.id)) };
    const gone = await tl.record(st3, '2026-01-01T00:04:00.000Z');
    check(gone.length === 1 && gone[0].questId === q0.id && gone[0].from === 'Succeded' && gone[0].to === null && (await tl.record(st3, 'z')).length === 0,
      `timeline: a quest no longer in the save → one record with to: null (${gone.length})`);
    // A stored file over the cap is trimmed on load, not only on the next write.
    const big = { version: 1, snapshot: null, records: Array.from({ length: 12 }, (_, i) => ({ questId: `q${i}` })) };
    const loadedBig = createTimeline({ load: () => big, save: () => {}, cap: 5 });
    const kept = await loadedBig.records();
    check(kept.length === 5 && kept[0].questId === 'q7' && (await loadedBig.count()) === 5, 'timeline: an oversized stored file is trimmed to the cap on load');
    // Delete: remove() runs, the memory is reset, the next read is a fresh baseline.
    let removed = 0;
    let delStore = null;
    const del = createTimeline({ load: () => delStore, save: (x) => { delStore = x; }, remove: () => { removed++; delStore = null; } });
    await del.record(st, 'a');
    await del.clear();
    const afterClear = await del.count();
    const rebase = await del.record(st, 'b');
    let clearFailed = false;
    const delFail = createTimeline({ load: () => null, save: () => {}, remove: () => { throw new Error('busy'); } });
    await delFail.record(st, 'a');
    try { await delFail.clear(); } catch { clearFailed = true; }
    check(removed === 1 && afterClear === 0 && rebase.length === st.quests.size && clearFailed && (await delFail.count()) === st.quests.size,
      'timeline: clear() removes the stored copy and resets; a failed remove keeps the records');

    // Item records: the first read is a baseline for items, a new code → one record, none after a restart;
    // a stored timeline without an item snapshot (older format) is a baseline too; the cap covers them.
    const withItems = (s, extra) => ({ ...s, items: new Map([...s.items, ...extra]) });
    let iStore = null;
    const itl = createTimeline({ load: () => iStore, save: (x) => { iStore = JSON.parse(JSON.stringify(x)); } });
    const i1 = await itl.record(st, 'a');
    const stI = { ...withItems(st, [['TEST_NewItem', { table: 'accessory', time: '2099.01.01-00.00.00', held: true }]]), dateTime: 'later' };
    const i2 = await itl.record(stI, 'b');
    const i3 = await createTimeline({ load: () => iStore, save: () => {} }).record(stI, 'c');
    let legacyStore = null;
    const ltl = createTimeline({ load: () => ({ version: 1, snapshot: iStore.snapshot, records: [] }), save: (x) => { legacyStore = JSON.parse(JSON.stringify(x)); } });
    const l1 = await ltl.record(stI, 'd');
    const l2 = await ltl.record(withItems(stI, [['TEST_Another', { table: 'inventory', time: null, held: false }]]), 'e');
    check(i1.length === st.quests.size && !i1.some((r) => r.kind === 'item') && iStore.items && Object.keys(iStore.items).length === stI.items.size
      && i2.length === 1 && i2[0].kind === 'item' && i2[0].code === 'TEST_NewItem' && i2[0].table === 'accessory' && i2[0].at === '2099.01.01-00.00.00' && i2[0].t === 'later' && i2[0].readAt === 'b'
      && i3.length === 0 && l1.length === 0 && !!legacyStore && !!legacyStore.items && l2.length === 1 && l2[0].code === 'TEST_Another' && l2[0].at === null,
      `timeline items: baseline 0 item records (${st.items.size} codes stored), one new code → 1, restart → ${i3.length}, old stored timeline without items → baseline ${l1.length}, then ${l2.length}`);
    console.log(`      item record sample: ${JSON.stringify(i2[0])}`);
    let icStore = null;
    const icap = createTimeline({ load: () => ({ version: 1, snapshot: snapshotOf(st), items: itemSnapshotOf(st), records: [] }), save: (x) => { icStore = x; }, cap: 3 });
    const five = Array.from({ length: 5 }, (_, k) => [`TEST_Cap${k}`, { table: 'inventory', time: `2099.01.01-00.00.0${k}`, held: true }]);
    const ic = await icap.record(withItems(st, five), 'x');
    check(ic.length === 5 && icStore.records.length === 3 && icStore.records.map((r) => r.code).join() === 'TEST_Cap2,TEST_Cap3,TEST_Cap4', 'timeline items: oldest first within a read, capped with the quest records');
  }

  // ---- save-independent checks (synthetic state, rules file only) ----
  {
    const sb = loadSandbox();
    const i18n = sb.require('./lib/i18n');
    const { makeEval, whereText, build } = sb.require('./lib/report');
    const { validateRules } = sb.require('./lib/rules-schema');
    const rules = rulesInfo.rules;
    // Nothing reached: exact mode must never name anything.
    const empty = { dateTime: '', playSeconds: 0, currentLevel: '', cycle: 0, finished: false, maps: new Set(), bells: new Set(), levels: new Set(), bosses: new Map(), quests: new Map() };
    let same = 0, differ = [];
    for (const lang of ['tr', 'en']) {
      i18n.setLang(lang);
      const ev = makeEval(empty, rules);
      for (const [id, c] of Object.entries(rules.cutoffs)) {
        const vague = i18n.pick(c.where);
        if (whereText(c, ev, true) === vague) same++; else differ.push(`${lang}:${id}`);
      }
    }
    const names = { quest: () => null, region: () => null, missable: () => null, known: () => true, notice: null };
    const b = build(empty, rules, names, { exact: true });
    check(differ.length === 0 && b.warnings.every((w) => Object.values(rules.cutoffs).some((c) => i18n.pick(c.where) === w.where)),
      `exact mode with nothing reached: every cutoff keeps its vague text (${same} checked${differ.length ? `; named: ${differ.join(', ')}` : ''})`);
    // An empty exact text falls back to the vague one.
    const ev0 = makeEval({ ...empty, maps: new Set(['X']) }, rules);
    check(whereText({ where: { en: 'vague', tr: 'vague' }, whereExact: { en: '', tr: '' }, exactWhen: { mapUnlocked: 'X' } }, ev0, true) === 'vague', 'an empty whereExact falls back to `where`');
    // Load-time checks: unknown condition key (also nested) and an empty whereExact are rejected.
    const withCut = (patch) => { const r = JSON.parse(JSON.stringify(rules)); Object.assign(r.cutoffs.chilian, patch); return r; };
    const rejects = (r) => { try { validateRules(r, 'test.json'); return false; } catch { return true; } };
    check(rejects(withCut({ exactWhen: { any: [{ mapUnlocked: 'A' }, { mapUnlokced: 'B' }] } })) && rejects(withCut({ exactWhen: { not: { bosKilled: 'x' } } }))
      && rejects(withCut({ whereExact: { tr: '', en: ' ' } })) && !rejects(withCut({ exactWhen: { questBranch: 'Q', branch: '1', state: 'Completed' } })) && !rejects(rules),
      'rules schema: unknown exactWhen keys (nested) and empty whereExact are rejected at load');
    check(rejects(withCut({ exactWhen: { itemSeen: 5 } })) && rejects(withCut({ exactWhen: { itemSeen: '' } })) && rejects(withCut({ exactWhen: { mapUnlocked: 'A', except: ['Bell_X'] } }))
      && rejects(withCut({ exactWhen: { bellPrefix: 'X', except: 'Bell_X' } })) && !rejects(withCut({ exactWhen: { all: [{ itemSeen: 'LuanYing' }, { lastBellPrefix: 'YXZR', except: ['Bell_YXZR_018'] }] } })),
      'rules schema: itemSeen must be a code; except needs bellPrefix / lastBellPrefix and an array');

    // itemSeen: held → true; used up (CurrentAmount 0) or absent → false; a state without item tables → unknown.
    i18n.setLang('en');
    const stItems = { ...empty, items: new Map([['HeldSword', { table: 'mainWeapon', time: null, held: true }], ['UsedKey', { table: 'inventory', time: null, held: false }]]) };
    const evI = makeEval(stItems, rules);
    check(evI({ itemSeen: 'HeldSword' }) === true && evI({ itemSeen: 'UsedKey' }) === false && evI({ itemSeen: 'Nope' }) === false
      && evI({ not: { itemSeen: 'Nope' } }) === true && makeEval(empty, rules)({ itemSeen: 'HeldSword' }) === null,
      'itemSeen (synthetic): held → true, used up / absent → false, no item tables → unknown');

    // Item rule, info rule with doneWhen, missable activeWhen (a small rules file of their own).
    const mini = validateRules({
      schemaVersion: 1, rulesVersion: 'test',
      cutoffs: { c: { where: { en: 'Before X', tr: 'X' }, label: { en: 'X', tr: 'X' }, passedWhen: { mapUnlocked: 'Passed' } } },
      missables: [
        { id: 'sword', quest: null, names: { en: 'Sword', tr: 'Kılıç' }, cutoff: 'c', visibleWhen: { mapUnlocked: 'A' }, doneWhen: { itemSeen: 'S' }, hintNotStarted: { en: 'take the sword', tr: 'x' } },
        { id: 'thief', type: 'info', quest: null, visibleWhen: { mapUnlocked: 'A' }, activeWhen: { mapUnlocked: 'A' }, doneWhen: { itemSeen: 'R' }, warn: { en: 'give the book', tr: 'x' }, warnNamed: { en: 'Thief: give the book', tr: 'x' } },
        { id: 'late', quest: 'Q', cutoff: 'c', visibleWhen: { questSeen: 'Q' }, activeWhen: { mapUnlocked: 'Camp' }, warn: { en: 'w', tr: 'w' } },
      ],
    }, 'mini.json');
    const quest = (id) => [id, { id, folder: 'Branch', completion: 'Started', branches: {}, progress: null }];
    const base = { ...empty, maps: new Set(['A']), quests: new Map([quest('Q'), quest('UnmappedSide')]), items: new Map() };
    const namesK = { ...names, known: (id) => id !== 'UnmappedSide' };
    const rowOf = (res, id) => res.closed.find((x) => x.key === id) || {};
    const b1 = build(base, mini, namesK); // nothing picked up, before the cutoff, an unmatched side quest in the save
    const b2 = build({ ...base, maps: new Set(['A', 'Passed']) }, mini, namesK);
    const b3 = build({ ...base, items: new Map([['S', { table: 'mainWeapon', time: null, held: true }], ['R', { table: 'accessory', time: null, held: true }]]) }, mini, namesK);
    const b4 = build({ ...base, maps: new Set(['A', 'Camp']) }, mini, namesK);
    check(b1.unmappedSide.length === 1 && rowOf(b1, 'sword').status === 'notStarted' && b1.warnings.some((w) => w.hints.has('take the sword')) && !b1.undetectable.some((u) => u.id === 'sword')
      && rowOf(b2, 'sword').status === 'missed' && /not picked up/.test(rowOf(b2, 'sword').note || '') && rowOf(b3, 'sword').status === 'done'
      && !b3.warnings.some((w) => w.hints.has('take the sword')),
      `item rule: not picked up → ${rowOf(b1, 'sword').status} (unmatched side quests ignored), after the cutoff → ${rowOf(b2, 'sword').status} (${rowOf(b2, 'sword').note}), picked up → ${rowOf(b3, 'sword').status}`);
    const thiefNow = (b) => b.infoNow.some((i) => i.key === 'thief');
    const thiefLater = b3.infoLater.find((i) => i.key === 'thief');
    check(thiefNow(b1) && !thiefNow(b3) && !!thiefLater && thiefLater.done === true && thiefLater.warnNamed === 'Thief: give the book (done)',
      `info rule with doneWhen: active until done, then hidden layer only, marked: "${thiefLater && thiefLater.warnNamed}"`);
    const named = (b, id) => b.warnings.some((w) => w.named.some((it) => it.key === id));
    check(!named(b1, 'late') && named(b4, 'late') && rowOf(b1, 'late').status === 'open',
      'missable activeWhen: the default-view warning waits for it; the journal row is unchanged');

    // Mandate Encampment (real rules): the outer-gate bell lit on the way to the Village of Lu does not count.
    const encSt = (bells, lastBell) => ({ ...empty, maps: new Set(['XiGu', 'FuJiZhiLin', 'LuJiaCun']), levels: new Set(['zhengdaodaying']), currentLevel: 'Zhengdaodaying',
      bells: new Set(bells), lastBell, quests: new Map([['BaiShanMiWen', { id: 'BaiShanMiWen', folder: 'Branch', completion: 'Started', branches: {}, progress: null }]]) });
    const inLu = build(encSt(['Bell_YXZR_018', 'Bell_SXC_01_07'], 'Bell_SXC_01_07'), rules, names);
    const inCamp = build(encSt(['Bell_YXZR_018', 'Bell_SXC_01_07', 'Bell_YXZR_011'], 'Bell_YXZR_011'), rules, names);
    const leftCamp = build(encSt(['Bell_YXZR_018', 'Bell_YXZR_011', 'Bell_SZ_001'], 'Bell_SZ_001'), rules, names);
    const red = (b) => b.infoNow.some((i) => i.key === 'red-encampment');
    check(!named(inLu, 'baishan-body') && !red(inLu) && !inLu.infoLater.some((i) => i.key === 'red-encampment')
      && named(inCamp, 'baishan-body') && red(inCamp) && !red(leftCamp) && leftCamp.infoLater.some((i) => i.key === 'red-encampment'),
      'encampment rules: in the Village of Lu (level Zhengdaodaying, outer-gate bell only) no Baishan body / Red warning; at an encampment bell both; Red leaves the default view after the encampment');

    // regionOf / regionLine: the newest bell wins; without bell times the last unlocked map; an unknown map → no line.
    const { regionOf } = sb.require('./lib/state');
    const { regionLine } = sb.require('./lib/report');
    const r1 = regionOf({ RecentlyInteractedAtByMap: { XiGu: 100, LuJiaCun: 300, FuJiZhiLin: 200 }, UnLockBigMapMaskWidgetNames: ['XiGu', 'FuJiZhiLin', 'LuJiaCun', 'Later'] });
    const r2 = regionOf({ RecentlyInteractedAtByMap: {}, UnLockBigMapMaskWidgetNames: ['XiGu', 'FuJiZhiLin'] });
    const r3 = regionOf({});
    const namesR = { ...names, region: (code) => ({ LuJiaCun: 'Village of Lu', FuJiZhiLin: 'Crimson Forest' })[code] || null };
    const l1r = regionLine({ region: r1 }, namesR), l2r = regionLine({ region: r2 }, namesR);
    check(r1.code === 'LuJiaCun' && r1.source === 'bell' && r2.code === 'FuJiZhiLin' && r2.source === 'map' && r3 === null
      && l1r.loc === 'Village of Lu' && l1r.src === 'last bell used' && l2r.loc === 'Crimson Forest' && l2r.src === 'last map unlocked'
      && regionLine({ region: { code: 'NoSuchMap', source: 'bell' } }, namesR) === null && regionLine({ region: null }, namesR) === null,
      'regionOf: newest bell wins, else the last unlocked map; an unknown map code → no area line');

    // Bell-prefix fallback: real names (core names, English table), regionOf().bell, label "last bell used".
    const { createNamesFrom } = sb.require('./lib/core/names');
    const nEn = createNamesFrom({ patches: [], uiLang: 'en' });
    const r4 = regionOf({ RecentlyInteractedBellID: 'Bell_SZ_001' });
    const r5 = regionOf({ RecentlyInteractedAtByMap: { PangZhenX: 9 }, RecentlyInteractedBellID: 'Bell_SZ_026' });
    const r6 = regionOf({ UnLockBigMapMaskWidgetNames: ['NewMap'], RecentlyInteractedBellID: 'Bell_SZ_026' });
    const l4 = regionLine({ region: r4 }, nEn), l6 = regionLine({ region: r6 }, nEn);
    check(nEn.region('Unknown', 'Bell_SZ_026') === 'Pangzhen' && nEn.region('LuJiaCun', 'Bell_SZ_026') === 'Village of Lu'
      && nEn.region('Unknown', 'Bell_SZX_1') === null && nEn.region(null, 'Bell_NOPE_1') === null
      && r4 && r4.code === null && r4.bell === 'Bell_SZ_001' && r5.bell === 'Bell_SZ_026'
      && l4 && l4.loc === 'Pangzhen' && l4.src === 'last bell used' && l6 && l6.loc === 'Pangzhen' && l6.src === 'last bell used',
      'region by bell prefix: names.region(code, bell), regionOf().bell, only-a-bell save, label "last bell used" (Bell_<p>_ exact prefix)');

    // Mirage: exact names and the bridge hint follow a Pangzhen bell (Bell_SZ_…), not a look-alike prefix.
    const stPz = { quests: new Map(), maps: new Set(), levels: new Set(), bells: new Set(), bosses: new Map(), items: new Map(), currentLevel: '', lastBell: '' };
    const lakeOpen = new Map([['HuXinMiMi', { id: 'HuXinMiMi', folder: 'Branch', completion: 'Started', branches: {}, progress: null }]]);
    const evPz = makeEval({ ...stPz, bells: new Set(['Bell_SZ_026']), quests: lakeOpen }, rules);
    const evNo = makeEval({ ...stPz, bells: new Set(['Bell_SZX_001']), quests: lakeOpen }, rules);
    const bridge = rules.missables.find((m) => m.id === 'mirage-bridge-choice');
    check(evPz(rules.cutoffs.mirage.exactWhen) === true && evNo(rules.cutoffs.mirage.exactWhen) === false
      && evPz(bridge.activeWhen) === true && evNo(bridge.activeWhen) === false,
      'mirage: exactWhen and the bridge hint need a Pangzhen bell (Bell_SZ_…), a look-alike prefix does not count');
  }

  // TransientError for a truncated file, from the core directly.
  try { await core0.decodeSave(saveBytes.subarray(0, 100), key); check(false, 'truncated save throws'); } catch (e) {
    check(e instanceof core0.TransientError, `truncated save → TransientError (${e.message})`);
  }
  const bad = saveBytes.slice(); bad[bad.length - 1] ^= 0xFF; // flip a byte in the last slot's tag/ciphertext
  try { await core0.decodeSave(bad, key); check(false, 'corrupted save throws'); } catch (e) {
    check(e instanceof core0.TransientError, `corrupted block → TransientError (${e.message})`);
  }

  console.log(`\nkey derivation (core, fs reader): ${keyMs.toFixed(0)} ms`);
  console.log(fails ? `${fails} FAILURE(S)` : 'ALL OK');
  process.exitCode = fails ? 1 : 0;
}

main().catch((e) => { console.error(e && e.stack || e); process.exitCode = 2; });
