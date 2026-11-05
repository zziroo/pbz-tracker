#!/usr/bin/env node
'use strict';
// Byte-for-byte comparison of the pure-JS Oodle decoder (lib/oodle) against the oo2core DLL
// (via test/oodle-dll.ps1) on every compressed slot of the real save and all of its backups,
// plus robustness checks on truncated/garbled input and a DLL compress -> JS decompress
// round trip on synthetic data to cover entropy modes the saves don't use.
//
// Read-only on the save, backup and game folders. Decrypted slot data only lives in memory,
// except for the DLL run, which uses a temp folder under os.tmpdir() that is always removed.
//
// Usage: node test/oodle-compare.js [--game <PBZ dir>] [--dll <oo2core_*.dll>] [--no-roundtrip]
// Exit code: 0 all OK, 1 any mismatch/failure, 2 setup error.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { Worker } = require('worker_threads');
const { deriveKey } = require('../lib/key');
const { decompress, OodleError } = require('../lib/oodle');

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
// Paths come from flags or env vars (no user-specific defaults in the repo).
const GAME = arg('--game', process.env.PBZ_GAME);
const DLL = arg('--dll', process.env.PBZ_OODLE_DLL);
if (!GAME || !DLL) { console.error('usage: node test/oodle-compare.js --game <PBZ folder> --dll <oo2core_*_win64.dll>  (or PBZ_GAME / PBZ_OODLE_DLL)'); process.exit(2); }
const EXE = path.join(GAME, 'platform', 'steam', 'PBZ.exe');
const SAVE_ROOT = path.join(GAME, 'ProjectPBZ', 'Saved', 'SaveGames', 'Steam');
const PS1 = path.join(__dirname, 'oodle-dll.ps1');

// ---- container + AES-GCM (copied from lib/savefile.js, which does not export it) ----
function openBlock(key, blk) {
  if (blk.length < 36 || blk.toString('latin1', 0, 4) !== 'PBZS') throw new Error('sealed block header bad/short');
  const d = crypto.createDecipheriv('aes-256-gcm', key, blk.subarray(8, 20));
  d.setAuthTag(blk.subarray(20, 36));
  return Buffer.concat([d.update(blk.subarray(36)), d.final()]);
}
function parseContainer(buf, key) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'PBZS') throw new Error('no PBZS header');
  if (buf[4] !== 3) throw new Error(`unknown save version ${buf[4]}`);
  const dirLen = buf.readUInt32LE(8);
  const dir = openBlock(key, buf.subarray(12, 12 + dirLen));
  const base = 12 + dirLen;
  const entries = [];
  let p = 12;
  while (p < dir.length) {
    const nl = dir.readUInt16LE(p); p += 2;
    const name = dir.toString('utf8', p, p + nl); p += nl;
    const e = { name, alg: dir[p], flag: dir[p + 1], raw: dir.readUInt32LE(p + 2), off: dir.readUInt32LE(p + 6), size: dir.readUInt32LE(p + 10) };
    p += 14;
    if (base + e.off + e.size > buf.length) throw new Error(`slot ${name} past end of file`);
    entries.push(e);
  }
  return entries.map((e) => ({ ...e, plain: openBlock(key, buf.subarray(base + e.off, base + e.off + e.size)) }));
}

// ---- save discovery (read-only) ----
function findSaves() {
  const files = [];
  for (const id of fs.readdirSync(SAVE_ROOT)) {
    const dir = path.join(SAVE_ROOT, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    const main = path.join(dir, 'PBZSaveGame.sav');
    if (fs.existsSync(main)) files.push(main);
    for (const sub of ['1RealTime', '2Hourly', '3Daily']) {
      const sd = path.join(dir, sub);
      if (!fs.existsSync(sd)) continue;
      for (const f of fs.readdirSync(sd).sort()) if (f.toLowerCase().endsWith('.sav')) files.push(path.join(sd, f));
    }
  }
  return files;
}

// ---- DLL path: one PowerShell run for all slots; temp folder under os.tmpdir() ----
function dllDecompressAll(items) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbz-oodle-cmp-'));
  try {
    const idx = items.map((it, i) => ({ file: `${i}.cmp`, out: `${i}.bin`, raw: it.raw }));
    items.forEach((it, i) => fs.writeFileSync(path.join(dir, `${i}.cmp`), it.plain));
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(idx));
    const t0 = process.hrtime.bigint();
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', PS1, '-Dir', dir, '-Dll', DLL], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      console.error(`DLL run reported errors: ${(err.stderr || '').toString().trim() || err.message}`);
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const outs = items.map((_, i) => {
      const f = path.join(dir, `${i}.bin`);
      return fs.existsSync(f) ? fs.readFileSync(f) : null;
    });
    return { outs, ms };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// PowerShell + Add-Type startup cost (DLL run with an empty job list), to isolate decode time.
function dllOverheadMs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbz-oodle-cmp-'));
  try {
    fs.writeFileSync(path.join(dir, 'index.json'), '[]');
    const t0 = process.hrtime.bigint();
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', PS1, '-Dir', dir, '-Dll', DLL], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch { /* ignore */ }
    return Number(process.hrtime.bigint() - t0) / 1e6;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---- bad-input checks, run in a worker so a hang is caught by a timeout ----
const WORKER_SRC = `
const { parentPort, workerData } = require('worker_threads');
const { decompress, OodleError } = require(workerData.lib);
const r = [];
for (const c of workerData.cases) {
  const src = Buffer.from(c.src);
  try {
    const out = decompress(src, c.raw);
    r.push({ name: c.name, result: 'returned', len: out.length, sha: require('crypto').createHash('sha256').update(out).digest('hex') });
  } catch (e) {
    r.push({ name: c.name, result: e instanceof OodleError ? 'oodle-error' : 'other-error', msg: String(e && e.message) });
  }
}
parentPort.postMessage(r);
`;
function runCasesInWorker(cases, timeoutMs) {
  return new Promise((resolve) => {
    const w = new Worker(WORKER_SRC, { eval: true, workerData: { lib: path.join(__dirname, '..', 'lib', 'oodle'), cases } });
    const timer = setTimeout(() => { w.terminate(); resolve({ timeout: true }); }, timeoutMs);
    w.once('message', (m) => { clearTimeout(timer); w.terminate(); resolve({ results: m }); });
    w.once('error', (e) => { clearTimeout(timer); resolve({ crash: String(e && e.stack) }); });
  });
}

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

function prng(seed) { // xorshift32, deterministic garbling
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 0x100000000; };
}

async function badInputTests(sample) {
  console.log('\n== Bad-input checks ==');
  const { plain, raw } = sample;
  // Must throw OodleError:
  const mustThrow = [
    { name: 'empty input', src: Buffer.alloc(0), raw },
    { name: 'header only', src: plain.subarray(0, 2), raw },
    { name: 'truncated to 50%', src: plain.subarray(0, plain.length >> 1), raw },
    { name: 'truncated by 1 byte', src: plain.subarray(0, plain.length - 1), raw },
    { name: 'extra trailing byte', src: Buffer.concat([plain, Buffer.from([0])]), raw },
    { name: 'rawSize + 1', src: plain, raw: raw + 1 },
    // Decoding a shorter prefix is legitimate (Oodle supports partial decodes): it may throw,
    // or must return exactly the first rawSize-1 bytes.
    { name: 'rawSize - 1', src: plain, raw: raw - 1, prefixOk: sha256(sample.out.subarray(0, raw - 1)) },
    { name: 'decoder type 6 (Kraken)', src: Buffer.concat([plain.subarray(0, 1), Buffer.from([0x06]), plain.subarray(2)]), raw, expect: /unsupported decoder type 6/ },
    { name: 'decoder type 12 (Leviathan)', src: Buffer.concat([plain.subarray(0, 1), Buffer.from([0x0c]), plain.subarray(2)]), raw, expect: /unsupported decoder type 12/ },
    { name: 'bad block header', src: Buffer.concat([Buffer.from([0x00]), plain.subarray(1)]), raw },
    { name: 'random bytes', src: crypto.randomBytes(plain.length), raw },
  ];
  // May throw OodleError or return garbage of the right length, but must never hang or throw anything else:
  const rnd = prng(0xC0FFEE);
  const garbled = [];
  for (let i = 0; i < 300; i++) {
    const g = Buffer.from(plain);
    const flips = 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < flips; k++) g[2 + Math.floor(rnd() * (g.length - 2))] ^= 1 + Math.floor(rnd() * 255);
    garbled.push({ name: `garbled #${i} (${flips} byte flip(s))`, src: g, raw });
  }
  for (let i = 0; i < 40; i++) {
    const cut = 2 + Math.floor(rnd() * (plain.length - 3));
    garbled.push({ name: `random truncation at ${cut}`, src: plain.subarray(0, cut), raw, mustThrow: true });
  }

  const toMsg = (c) => ({ name: c.name, src: new Uint8Array(c.src), raw: c.raw });
  let failures = 0;
  const t0 = Date.now();
  const res1 = await runCasesInWorker(mustThrow.map(toMsg), 60000);
  if (res1.timeout || res1.crash) { console.log(`FAIL  must-throw cases: ${res1.timeout ? 'TIMEOUT (hang)' : res1.crash}`); failures++; }
  else {
    res1.results.forEach((r, i) => {
      const c = mustThrow[i];
      const ok = (r.result === 'oodle-error' && (!c.expect || c.expect.test(r.msg))) ||
        (c.prefixOk && r.result === 'returned' && r.sha === c.prefixOk);
      if (!ok) failures++;
      const how = r.result === 'returned' && c.prefixOk ? (r.sha === c.prefixOk ? ' (exact prefix of full output)' : ' (WRONG prefix)') : '';
      console.log(`${ok ? 'OK  ' : 'FAIL'}  ${r.name.padEnd(28)} -> ${r.result}${how}${r.msg ? `: ${r.msg}` : ''}`);
    });
  }
  const res2 = await runCasesInWorker(garbled.map(toMsg), 120000);
  if (res2.timeout || res2.crash) { console.log(`FAIL  garbled cases: ${res2.timeout ? 'TIMEOUT (hang)' : res2.crash}`); failures++; }
  else {
    const tally = { 'oodle-error': 0, returned: 0, 'other-error': 0 };
    res2.results.forEach((r, i) => {
      tally[r.result]++;
      const c = garbled[i];
      const bad = r.result === 'other-error' || (r.result === 'returned' && r.len !== c.raw) || (c.mustThrow && r.result !== 'oodle-error');
      if (bad) { failures++; console.log(`FAIL  ${r.name} -> ${r.result}${r.msg ? `: ${r.msg}` : ''}`); }
    });
    console.log(`${garbled.length} garbled/truncated inputs: ${tally['oodle-error']} clean OodleError, ${tally.returned} decoded to garbage of the right size, ${tally['other-error']} other errors (must be 0); no hangs`);
  }
  console.log(`bad-input checks took ${Date.now() - t0} ms, ${failures} failure(s)`);
  return failures;
}

// ---- coverage round-trip: synthetic data compressed by the DLL, decoded by JS ----
// The real saves only use memcopy + Huffman + Mermaid raw-literal mode. To also cover RLE,
// tANS, recursive/multi-array blocks, old Huffman headers, delta literals and stored/memset
// quanta, synthetic inputs (no save data) are compressed with the DLL's OodleLZ_Compress:
//  - Mermaid(9)/Selkie(11) at many levels: full JS decompress must give back the input;
//  - Kraken(8)/Leviathan(13): only their entropy-only 128 KiB chunks are decoded (with the
//    shared entropy layer) and compared; their LZ decoders are not implemented.
const COMPRESS_PS1 = `param([Parameter(Mandatory)][string]$Dir, [Parameter(Mandatory)][string]$Dll)
$ErrorActionPreference = 'Stop'
$dllEsc = $Dll.Replace('"', '""')
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class PbzOodleC {
  [DllImport(@"$dllEsc", CallingConvention=CallingConvention.StdCall)]
  public static extern long OodleLZ_Compress(int compressor, byte[] raw, long rawLen, byte[] comp, int level, IntPtr opts, IntPtr dictBase, IntPtr lrm, IntPtr scratch, long scratchSize);
}
"@
$idx = Get-Content -LiteralPath (Join-Path $Dir 'cindex.json') -Raw | ConvertFrom-Json
foreach ($e in $idx) {
  $src = [IO.File]::ReadAllBytes((Join-Path $Dir $e.file))
  $dst = New-Object byte[] ($src.Length + 65536 + [int]($src.Length / 8))
  $n = [PbzOodleC]::OodleLZ_Compress([int]$e.comp, $src, $src.Length, $dst, [int]$e.level, [IntPtr]::Zero, [IntPtr]::Zero, [IntPtr]::Zero, [IntPtr]::Zero, 0)
  if ($n -gt 0) { $o = New-Object byte[] $n; [Array]::Copy($dst, $o, $n); [IO.File]::WriteAllBytes((Join-Path $Dir $e.out), $o) } else { [Console]::Error.WriteLine("$($e.file): $n") }
}
`;

function syntheticInputs() {
  const rnd = prng(12345);
  const r = () => Math.floor(rnd() * 0x100000000);
  const geo = (p) => { let k = 0; while (r() % 1000 < p) k++; return k & 255; };
  const n = 300000, q = 0x40000, inp = {};
  const mk = (len, f) => { const b = Buffer.alloc(len); f(b); return b; };
  // Mermaid/Selkie full round trip
  inp.zeros = { comps: 'lz', data: Buffer.alloc(n) };
  inp.random = { comps: 'lz', data: mk(n, (b) => { for (let i = 0; i < n; i++) b[i] = r() & 255; }) };
  inp.skewed = { comps: 'lz', data: mk(n, (b) => { for (let i = 0; i < n; i++) b[i] = geo(700); }) };
  inp.sparse = { comps: 'lz', data: mk(n, (b) => { for (let i = 0; i < n; i += 1 + (r() % 40)) b[i] = r() & 255; }) };
  inp.ramp = { comps: 'lz', data: mk(n, (b) => { let v = 0; for (let i = 0; i < n; i += 4) { v += 1 + (r() % 3); b.writeUInt32LE(v >>> 0, i); } }) };
  inp.floats = { comps: 'lz', data: mk(n, (b) => { for (let i = 0; i < n; i += 4) b.writeFloatLE(Math.sin(i / 400) * 100 + (r() % 7) / 50, i); }) };
  inp.runs = { comps: 'lz', data: mk(n, (b) => { let i = 0; while (i < n) { const len = 1 + (r() % 200); b.fill((r() & 3) * 60, i, Math.min(n, i + len)); i += len; if (i < n && r() % 3 === 0) b[i++] = r() & 255; } }) };
  inp.json = { comps: 'lz', data: Buffer.from(Array.from({ length: 30000 }, (_, i) => `{"id":${i},"name":"item_${r() % 500}","v":${(r() % 10000) / 100}}`).join(',')).subarray(0, n) };
  inp.tiny = { comps: 'lz', data: Buffer.from('hello hello hello hello world') };
  // Kraken/Leviathan entropy-only chunks (one 256 KiB quantum each)
  for (const p of [300, 700, 950]) inp[`geo${p}`] = { comps: 'ent', data: mk(q, (b) => { for (let i = 0; i < q; i++) b[i] = geo(p); }) };
  inp.halves = { comps: 'ent', data: mk(q, (b) => { for (let i = 0; i < q; i++) b[i] = i < q / 2 ? geo(300) : (200 + geo(600)) & 255; }) };
  inp.blocks = { comps: 'ent', data: mk(q, (b) => { for (let i = 0; i < q; i++) b[i] = ((i >>> 12) & 1 ? geo(950) : geo(100) + ((i >>> 13) % 5) * 40) & 255; }) };
  return inp;
}

function roundTripTests() {
  console.log('\n== DLL round-trip coverage (synthetic data) ==');
  const { decodeBytes } = require('../lib/oodle/entropy');
  const inputs = syntheticInputs();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbz-oodle-rt-'));
  let failures = 0;
  try {
    const jobs = [];
    for (const [k, { comps, data }] of Object.entries(inputs)) {
      fs.writeFileSync(path.join(dir, `${k}.raw`), data);
      const cs = comps === 'lz' ? [9, 11] : [8, 13];
      const levels = comps === 'lz' ? [-3, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [5, 6, 7, 8, 9];
      for (const comp of cs) for (const level of levels) jobs.push({ k, file: `${k}.raw`, out: `${k}.${comp}.${level}.cmp`, comp, level, comps });
    }
    fs.writeFileSync(path.join(dir, 'cindex.json'), JSON.stringify(jobs));
    fs.writeFileSync(path.join(dir, 'compress.ps1'), COMPRESS_PS1);
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(dir, 'compress.ps1'), '-Dir', dir, '-Dll', DLL], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      console.log(`FAIL  DLL compress run: ${(err.stderr || '').toString().trim() || err.message}`);
      return 1;
    }
    let lzOk = 0, lzN = 0, entOk = 0, entN = 0;
    for (const j of jobs) {
      const f = path.join(dir, j.out);
      if (!fs.existsSync(f)) { failures++; console.log(`FAIL  ${j.out}: DLL produced no output`); continue; }
      const c = fs.readFileSync(f);
      const raw = inputs[j.k].data;
      if (j.comps === 'lz') {
        lzN++;
        try {
          if (decompress(c, raw.length).equals(raw)) lzOk++;
          else { failures++; console.log(`FAIL  ${j.out}: output differs`); }
        } catch (e) { failures++; console.log(`FAIL  ${j.out}: ${e.message}`); }
        continue;
      }
      // Single 256 KiB quantum: 2-byte block header + 3-byte quantum header, then 128 KiB chunks.
      const v = (c[2] << 16) | (c[3] << 8) | c[4];
      if ((v & 0x3ffff) === 0x3ffff || (v & 0x3ffff) + 1 === raw.length) continue; // memset/stored
      let p = 5, d = 0;
      const end = 5 + (v & 0x3ffff) + 1;
      while (d < raw.length) {
        const cnt = Math.min(raw.length - d, 0x20000);
        const h = (c[p] << 16) | (c[p + 1] << 8) | c[p + 2];
        if (h & 0x800000) { p += 3 + (h & 0x7ffff); d += cnt; continue; } // LZ chunk: skip
        entN++;
        try {
          const r = decodeBytes(c, p, end, cnt, null, 0);
          if (r.size === cnt && Buffer.from(r.buf.buffer, r.buf.byteOffset + r.pos, r.size).equals(raw.subarray(d, d + cnt))) entOk++;
          else { failures++; console.log(`FAIL  ${j.out} chunk @${d}: output differs`); }
          p += r.used;
        } catch (e) { failures++; console.log(`FAIL  ${j.out} chunk @${d}: ${e.message}`); break; }
        d += cnt;
      }
    }
    console.log(`${lzOk}/${lzN} Mermaid/Selkie streams round-trip OK`);
    console.log(`${entOk}/${entN} Kraken/Leviathan entropy-only chunks decode OK`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return failures;
}

async function main() {
  const key = deriveKey(EXE);
  const saves = findSaves();
  if (saves.length === 0) throw new Error(`no saves under ${SAVE_ROOT}`);
  if (!fs.existsSync(DLL)) throw new Error(`Oodle DLL not found: ${DLL}`);

  const items = [];
  for (const f of saves) {
    const buf = fs.readFileSync(f, { flag: 'r' });
    const entries = parseContainer(buf, key);
    for (const e of entries) {
      if (e.alg === 0) continue;
      if (e.alg !== 2) throw new Error(`${f}: slot ${e.name} has unknown alg ${e.alg}`);
      items.push({ file: path.relative(SAVE_ROOT, f), name: e.name, raw: e.raw, plain: e.plain });
    }
  }
  console.log(`${saves.length} save files, ${items.length} compressed slots`);

  // Decoder types per slot (first block header only; informational)
  const types = new Map();
  for (const it of items) { const t = it.plain[1] & 0x7f; types.set(t, (types.get(t) || 0) + 1); }
  console.log(`first-block decoder types: ${[...types].map(([t, n]) => `${t}x${n}`).join(', ')}`);

  const overhead = dllOverheadMs();
  const dll = dllDecompressAll(items);

  console.log('\n== JS vs DLL ==');
  let fails = 0, jsTotal = 0, rawTotal = 0, cmpTotal = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let out, err, ms;
    const t0 = process.hrtime.bigint();
    try { out = decompress(it.plain, it.raw); } catch (e) { err = e; }
    ms = Number(process.hrtime.bigint() - t0) / 1e6;
    jsTotal += ms; rawTotal += it.raw; cmpTotal += it.plain.length;
    const ref = dll.outs[i];
    let status;
    if (!ref) status = 'FAIL (DLL produced no output)';
    else if (err) status = `FAIL (JS threw: ${err.message})`;
    else if (ref.length !== out.length) status = `FAIL (length ${out.length} vs DLL ${ref.length})`;
    else if (!ref.equals(out)) {
      let k = 0; while (k < out.length && out[k] === ref[k]) k++;
      status = `FAIL (first difference at byte ${k})`;
    } else status = 'OK';
    if (status !== 'OK') fails++;
    console.log(`${status.startsWith('OK') ? 'OK  ' : 'FAIL'}  ${it.file.padEnd(48)} ${it.name.padEnd(18)} ${String(it.plain.length).padStart(7)} -> ${String(it.raw).padStart(7)} B  ${ms.toFixed(2).padStart(7)} ms${status === 'OK' ? '' : `  ${status}`}`);
  }
  const mb = rawTotal / 1048576;
  console.log(`\n${items.length - fails}/${items.length} slots match byte-for-byte (${(cmpTotal / 1048576).toFixed(2)} MB -> ${mb.toFixed(2)} MB)`);
  console.log(`JS decode total: ${jsTotal.toFixed(1)} ms (${(mb / (jsTotal / 1000)).toFixed(0)} MB/s, includes JIT warm-up)`);
  // Warm second pass for a steadier JS number
  const t1 = process.hrtime.bigint();
  for (const it of items) decompress(it.plain, it.raw);
  const warm = Number(process.hrtime.bigint() - t1) / 1e6;
  console.log(`JS decode total (warm, 2nd pass): ${warm.toFixed(1)} ms (${(mb / (warm / 1000)).toFixed(0)} MB/s)`);
  console.log(`DLL path total: ${dll.ms.toFixed(0)} ms wall (PowerShell + Add-Type startup ~${overhead.toFixed(0)} ms, so ~${Math.max(0, dll.ms - overhead).toFixed(0)} ms for file I/O + decode)`);

  const bigIdx = items.reduce((bi, it, i) => (it.raw > items[bi].raw ? i : bi), 0);
  const bad = await badInputTests({ ...items[bigIdx], out: dll.outs[bigIdx] || Buffer.alloc(0) });
  const rt = process.argv.includes('--no-roundtrip') ? 0 : roundTripTests();
  const total = fails + bad + rt;
  console.log(`\n${total === 0 ? 'ALL OK' : `${total} FAILURE(S)`}`);
  process.exitCode = total === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e && e.stack || e); process.exitCode = 2; });
