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
