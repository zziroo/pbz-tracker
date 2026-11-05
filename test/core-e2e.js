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
    const { build } = sb.require('./lib/report');
    const { collectDiagnostics, formatDiagnostics } = sb.require('./lib/diagnostics');
    const { createTimeline, exportTimeline } = sb.require('./lib/timeline');
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
      if (id === 'final' || id === 'mirage') check(w.where === pickEn(c.where), `exact mode: ${id} keeps its vague text (region code unknown)`);
      else if (reached && id) console.log(`      exact: ${id} → ${w.where}`);
    }
    check(named > 0, `exact mode names ${named} warning(s), ${vague} stay vague`);

    // Diagnostics: no personal data, even with hostile inputs (full paths where only names belong).
    const user = (() => { try { return os.userInfo().username; } catch { return process.env.USERNAME || ''; } })();
    const needles = [os.homedir(), gameDir, save, path.dirname(save), exe, '7656119', user].filter((s) => s && s.length >= 3);
    const d = collectDiagnostics({
      mode: 'web', version: '0.0.0-test', uiLang: 'en', exact: true,
      rules: { version: rules.rulesVersion, schemaVersion: 1, source: 'sidecar' },
      keyMap: require('../data/names.json'),
      namesSource: path.join(paksDir, 'ProjectPBZ-Windows_C.pak'),
      nameFiles: [path.join(path.dirname(save), 'names.xx.json')],
      patches: [path.join(paksDir, 'ProjectPBZ-Windows_C.pak')],
      build: { id: buildId, tested: true },
      st, result: { ...exact, unmatched: [...exact.unmatched, { id: save, folder: path.dirname(save), completion: os.homedir() }] },
      ok: true,
      timeline: { enabled: true, count: 3, error: `EACCES ${os.homedir()}` },
    });
    const text = formatDiagnostics(d);
    const blob = `${text}\n${JSON.stringify(d)}`.toLowerCase();
    const leaks = needles.filter((n) => blob.includes(n.toLowerCase()) || blob.includes(n.toLowerCase().replace(/\\/g, '/')) || blob.includes(JSON.stringify(n).slice(1, -1).toLowerCase()));
    check(leaks.length === 0, `diagnostics report has no personal data (checked: home dir, game path, save path, exe, '7656119', OS user)${leaks.length ? ` — LEAK: ${leaks.length}` : ''}`);
    check(/text patch: ProjectPBZ-Windows_C\.pak/.test(text) && /date \d{4}-\d{2}-\d{2} /.test(text) && !/\d{2}\.\d{2}\.\d{2}\b/.test(text.split('\n').find((l) => l.startsWith('save:')) || ''),
      'diagnostics keep the pak file name and only the date of the save');
    const real = collectDiagnostics({ mode: 'web', version: '0.0.0-test', uiLang: 'en', rules: { version: rules.rulesVersion, schemaVersion: 1, source: 'embedded' },
      keyMap: require('../data/names.json'), namesSource: names.source, patches: [], build: { id: buildId, tested: true }, st, result: plain, ok: true, timeline: null });
    console.log(formatDiagnostics(real).trimEnd().split('\n').map((l) => `      | ${l}`).join('\n'));

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
