'use strict';
// Reads the Turkish fan patch's Game.locres out of ProjectPBZ-Windows_C.pak. Read-only.
// The pak is located via its footer + index (legacy index, pak v1..v9); if that fails, the
// locres is found by its magic GUID. Compressed or encrypted entries are reported, not decoded.
const fs = require('fs');
const path = require('path');

const PATCH_PAK = ['ProjectPBZ', 'Content', 'Paks', 'ProjectPBZ-Windows_C.pak'];
const PAK_MAGIC = 0x5A6F12E1;
const LOCRES_MAGIC = Buffer.from('0e147475674a03fc4a15909dc3377f1b', 'hex');
const MAX_PAK_BYTES = 256 * 1024 * 1024;

class Reader {
  constructor(buf, pos = 0, end = buf.length) { this.b = buf; this.p = pos; this.end = end; }
  need(n) { if (n < 0 || this.p + n > this.end) throw new Error(`read past end (${this.p}+${n})`); }
  u8() { this.need(1); return this.b[this.p++]; }
  i32() { this.need(4); const v = this.b.readInt32LE(this.p); this.p += 4; return v; }
  u32() { this.need(4); const v = this.b.readUInt32LE(this.p); this.p += 4; return v; }
  i64() { this.need(8); const v = this.b.readBigInt64LE(this.p); this.p += 8; if (v < 0n || v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('bad int64'); return Number(v); }
  skip(n) { this.need(n); this.p += n; }
  fstring() {
    const n = this.i32();
    if (n === 0) return '';
    if (n > 0) { if (n > 1 << 20) throw new Error('string too long'); this.need(n); const s = this.b.toString('latin1', this.p, this.p + n); this.p += n; return s.replace(/\0+$/, ''); }
    if (n < -(1 << 20)) throw new Error('string too long');
    const bytes = -n * 2; this.need(bytes);
    const s = this.b.toString('utf16le', this.p, this.p + bytes); this.p += bytes;
    return s.replace(/\0+$/, '');
  }
}

// ---- locres (v0..v3) -------------------------------------------------------
function parseLocres(buf) {
  const r = new Reader(buf);
  let ver = 0;
  if (buf.length >= 17 && buf.subarray(0, 16).equals(LOCRES_MAGIC)) { r.skip(16); ver = r.u8(); }
  if (ver > 3) throw new Error(`unknown locres version ${ver}`);
  const out = new Map();
  const put = (ns, key, val) => {
    if (typeof val !== 'string') return;
    if (!out.has(key)) out.set(key, val);
    if (ns && ns !== 'Default') out.set(`${ns}::${key}`, val); // non-default namespaces also as "ns::key"
  };
  let strings = null;
  if (ver >= 1) {
    const strOff = r.i64();
    if (ver >= 2) r.u32(); // total entry count
    const s = new Reader(buf, strOff);
    const cnt = s.i32();
    if (cnt < 0 || cnt > 4e6) throw new Error('bad string count');
    strings = new Array(cnt);
    for (let i = 0; i < cnt; i++) { strings[i] = s.fstring(); if (ver >= 2) s.i32(); }
  }
  const nsCount = r.u32();
  if (nsCount > 1e5) throw new Error('bad namespace count');
  for (let n = 0; n < nsCount; n++) {
    if (ver >= 2) r.u32();
    const ns = r.fstring();
    const kc = r.u32();
    if (kc > 4e6) throw new Error('bad key count');
    for (let k = 0; k < kc; k++) {
      if (ver >= 2) r.u32();
      const key = r.fstring();
      r.u32(); // source string hash
      if (ver >= 1) { const idx = r.i32(); put(ns, key, strings[idx]); }
      else put(ns, key, r.fstring());
    }
  }
  return { version: ver, map: out, strings: strings ? strings.length : out.size };
}

// ---- pak (legacy index) ----------------------------------------------------
function findFooter(buf) {
  // The footer ends the file; its size varies with the pak version, so scan the tail for the magic.
  const lo = Math.max(0, buf.length - 1024);
  for (let p = buf.length - 44; p >= lo; p--) {
    if (buf.readUInt32LE(p) !== PAK_MAGIC) continue;
    const version = buf.readInt32LE(p + 4);
    if (version < 1 || version > 20) continue;
    const indexOffset = Number(buf.readBigInt64LE(p + 8));
    const indexSize = Number(buf.readBigInt64LE(p + 16));
    if (indexOffset < 0 || indexSize <= 0 || indexOffset + indexSize > p) continue;
    const encryptedIndex = version >= 7 && p >= 1 ? buf[p - 1] === 1 : false;
    return { version, indexOffset, indexSize, encryptedIndex };
  }
  return null;
}

// FPakEntry as serialized in the legacy index (and again in front of the data).
function readPakEntry(r, version) {
  const offset = r.i64();
  const size = r.i64();
  const uncompressedSize = r.i64();
  const compression = version >= 8 ? r.u32() : r.i32();
  if (version === 1) r.i64(); // timestamp
  r.skip(20); // SHA1
  let blocks = 0, encrypted = false;
  if (version >= 3) {
    if (compression !== 0) { blocks = r.u32(); if (blocks > 1e6) throw new Error('bad block count'); r.skip(blocks * 16); }
    encrypted = (r.u8() & 1) === 1;
    r.u32(); // compression block size
  }
  return { offset, size, uncompressedSize, compression, encrypted, blocks };
}

function readIndex(buf, footer) {
  if (footer.version >= 10) throw new Error(`pak v${footer.version} path-hash index not supported`);
  if (footer.encryptedIndex) throw new Error('pak index is encrypted');
  const r = new Reader(buf, footer.indexOffset, footer.indexOffset + footer.indexSize);
  const mount = r.fstring();
  const count = r.i32();
  if (count < 0 || count > 1e6) throw new Error('bad entry count');
  const entries = [];
  for (let i = 0; i < count; i++) {
    const name = r.fstring();
    const start = r.p;
    const e = readPakEntry(r, footer.version);
    e.name = name;
    e.path = (mount + name).replace(/\\/g, '/');
    e.headerSize = r.p - start; // same layout is repeated in front of the payload
    entries.push(e);
  }
  return { mount, entries };
}

function pickLocres(entries) {
  const loc = entries.filter((e) => /\.locres$/i.test(e.path));
  return loc.find((e) => /\/Localization\/Game\/[^/]+\/Game\.locres$/i.test(e.path)) || loc[0] || null;
}

// Returns diagnostics; `map` is set only when the locres was read successfully.
function inspectPatchPak(gameDir) {
  const info = { pakPath: null, found: false, method: null, pakVersion: null, entry: null, compressed: null, encrypted: null, locresVersion: null, count: 0, error: null, map: null };
  try {
    if (!gameDir) { info.error = 'gameDir missing'; return info; }
    info.pakPath = path.join(gameDir, ...PATCH_PAK);
    let st;
    try { st = fs.statSync(info.pakPath); } catch { info.error = 'patch pak not found'; return info; }
    if (!st.isFile()) { info.error = 'patch pak not a file'; return info; }
    info.found = true;
    if (st.size > MAX_PAK_BYTES) { info.error = 'patch pak unexpectedly large'; return info; }
    const buf = fs.readFileSync(info.pakPath, { flag: 'r' });

    let data = null;
    try {
      const footer = findFooter(buf);
      if (!footer) throw new Error('pak footer not found');
      info.pakVersion = footer.version;
      const { entries } = readIndex(buf, footer);
      const e = pickLocres(entries);
      if (!e) throw new Error('no .locres entry in pak');
      info.entry = e.path;
      info.compressed = e.compression !== 0;
      info.encrypted = e.encrypted;
      if (info.compressed) { info.error = `locres entry is compressed (method ${e.compression}); not supported`; return info; }
      if (info.encrypted) { info.error = 'locres entry is encrypted; not supported'; return info; }
      let start = e.offset + e.headerSize;
      if (!buf.subarray(start, start + 16).equals(LOCRES_MAGIC)) {
        // Header size guess was off: look for the magic right after the entry offset.
        const hit = buf.indexOf(LOCRES_MAGIC, e.offset);
        if (hit < 0 || hit > e.offset + e.headerSize + 256) throw new Error('locres magic not at entry payload');
        start = hit;
      }
      if (start + e.size > buf.length) throw new Error('locres entry past end of pak');
      data = buf.subarray(start, start + e.size);
      info.method = 'index';
    } catch (err) {
      if (info.compressed || info.encrypted) throw err;
      // Fallback: raw scan for the locres magic GUID (only works for uncompressed payloads).
      const hit = buf.indexOf(LOCRES_MAGIC);
      if (hit < 0) throw new Error(`${err.message}; locres magic not found`);
      data = buf.subarray(hit);
      info.method = 'scan';
      info.compressed = false;
    }

    const res = parseLocres(data);
    info.locresVersion = res.version;
    info.count = res.strings;
    if (res.map.size === 0) throw new Error('locres is empty');
    info.map = res.map;
  } catch (err) {
    info.error = err.message;
    info.map = null;
  }
  return info;
}

// Map<key, string> from the patch's Game.locres, or null if the patch is missing/unreadable. Never throws.
function loadPatchLocres(gameDir) {
  return inspectPatchPak(gameDir).map;
}

module.exports = { loadPatchLocres, inspectPatchPak, parseLocres, PATCH_PAK };
