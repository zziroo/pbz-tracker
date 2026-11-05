'use strict';
// Finds text patches: unencrypted .pak files in ProjectPBZ/Content/Paks that carry a Game.locres
// (e.g. a fan translation overriding en-US). Read-only, positioned reads only. Each pak is read via
// its footer + legacy index (pak v1..v9); small (<= 32 MB) paks of any version fall back to a scan for
// the locres magic GUID. Compressed or encrypted entries are reported, not decoded. The official game
// paks (v12 path-hash index) are skipped without reading their index.
const fs = require('fs');
const path = require('path');

const PAK_MAGIC = 0x5A6F12E1;
const LOCRES_MAGIC = Buffer.from('0e147475674a03fc4a15909dc3377f1b', 'hex');

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
// `buf` is the file's tail starting at absolute offset `base`.
function findFooter(buf, base = 0) {
  // The footer ends the file; its size varies with the pak version, so scan the tail for the magic.
  const lo = Math.max(0, buf.length - 1024);
  for (let p = buf.length - 44; p >= lo; p--) {
    if (buf.readUInt32LE(p) !== PAK_MAGIC) continue;
    const version = buf.readInt32LE(p + 4);
    if (version < 1 || version > 20) continue;
    const indexOffset = Number(buf.readBigInt64LE(p + 8));
    const indexSize = Number(buf.readBigInt64LE(p + 16));
    if (indexOffset < 0 || indexSize <= 0 || indexOffset + indexSize > base + p) continue;
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
  return loc.find((e) => /\/Localization\/Game\/[^/]+\/Game\.locres$/i.test(e.path)) || null;
}

// ---- pak scanning (footer + index read with positioned reads; big paks are never read whole) ----
const TAIL_BYTES = 1024;
const MAX_INDEX_BYTES = 64 * 1024 * 1024;
const MAX_LOCRES_BYTES = 64 * 1024 * 1024;
const MAX_SCAN_BYTES = 32 * 1024 * 1024; // magic-GUID fallback only for small paks

function readAt(fd, pos, len) {
  const b = Buffer.alloc(len);
  let got = 0;
  while (got < len) {
    const n = fs.readSync(fd, b, got, len - got, pos + got);
    if (n === 0) break;
    got += n;
  }
  return got === len ? b : b.subarray(0, got);
}

function pakFooter(fd, size) {
  const tailLen = Math.min(size, TAIL_BYTES);
  const tail = readAt(fd, size - tailLen, tailLen);
  return findFooter(tail, size - tailLen); // offsets are absolute file offsets
}

// Inspect one .pak: is it an unencrypted pak with a Game.locres entry? Returns diagnostics; `map` set on success.
function inspectPak(pakPath) {
  const info = { pakPath, name: path.basename(pakPath), method: null, pakVersion: null, entry: null, culture: null,
    compressed: null, encrypted: null, locresVersion: null, count: 0, error: null, map: null };
  let fd;
  try {
    fd = fs.openSync(pakPath, 'r');
    const size = fs.fstatSync(fd).size;
    let data = null;
    try {
      const footer = pakFooter(fd, size);
      if (!footer) throw new Error('pak footer not found');
      info.pakVersion = footer.version;
      // Reject unsupported indexes before reading them (official paks can have tens of MB of index).
      if (footer.version >= 10) throw new Error(`pak v${footer.version} path-hash index not supported`);
      if (footer.encryptedIndex) throw new Error('pak index is encrypted');
      if (footer.indexSize > MAX_INDEX_BYTES) throw new Error('pak index too large');
      const idx = readAt(fd, footer.indexOffset, footer.indexSize);
      const { entries } = readIndex(idx, { ...footer, indexOffset: 0 });
      const e = pickLocres(entries);
      if (!e) { info.error = 'no Game.locres in pak'; return info; }
      info.entry = e.path;
      info.culture = (/\/Localization\/Game\/([^/]+)\//i.exec(e.path) || [])[1] || null;
      info.compressed = e.compression !== 0;
      info.encrypted = e.encrypted;
      if (info.compressed) { info.error = `locres entry is compressed (method ${e.compression}); not supported`; return info; }
      if (info.encrypted) { info.error = 'locres entry is encrypted; not supported'; return info; }
      if (e.size > MAX_LOCRES_BYTES) throw new Error('locres entry too large');
      // The entry header is repeated in front of the payload; find the locres magic right after it.
      const head = readAt(fd, e.offset, e.headerSize + 256 + e.size);
      let start = e.headerSize;
      if (!head.subarray(start, start + 16).equals(LOCRES_MAGIC)) {
        const hit = head.indexOf(LOCRES_MAGIC);
        if (hit < 0 || hit > e.headerSize + 256) throw new Error('locres magic not at entry payload');
        start = hit;
      }
      if (start + e.size > head.length) throw new Error('locres entry past end of pak');
      data = head.subarray(start, start + e.size);
      info.method = 'index';
    } catch (err) {
      if (info.compressed || info.encrypted || info.error) throw err;
      // Fallback for small paks only: raw scan for the locres magic GUID (uncompressed payloads).
      if (size > MAX_SCAN_BYTES) throw err;
      const buf = readAt(fd, 0, size);
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
    info.error = info.error || err.message;
    info.map = null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* ignore */ }
  }
  return info;
}

const paksDir = (gameDir) => path.join(gameDir, 'ProjectPBZ', 'Content', 'Paks');

// All readable text patches: unencrypted .pak files in Paks/ that carry a Game.locres. Never throws.
function findTextPatches(gameDir) {
  if (!gameDir) return [];
  let files = [];
  try { files = fs.readdirSync(paksDir(gameDir)).filter((f) => /\.pak$/i.test(f)).sort(); } catch { return []; }
  const out = [];
  for (const f of files) {
    const info = inspectPak(path.join(paksDir(gameDir), f));
    if (info.map) out.push(info);
  }
  return out;
}

// Heuristic: does this locres hold Turkish text? (Turkish-only letters in a good share of the strings.)
function looksTurkish(map) {
  if (!map) return false;
  let seen = 0, tr = 0;
  for (const v of map.values()) {
    if (typeof v !== 'string' || v.length < 4) continue;
    seen++;
    if (/[ğışĞİŞ]/.test(v)) tr++;
    if (seen >= 2000) break;
  }
  return seen > 0 && tr / seen > 0.1;
}

module.exports = { findTextPatches, inspectPak, parseLocres, looksTurkish };
