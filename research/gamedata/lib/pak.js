'use strict';
// Unreal .pak reader (v12, AES-encrypted index, Oodle-compressed entries) for the game's main pak.
// Format notes (verified on ProjectPBZ-Windows.pak):
//  - footer: FPakInfo (magic 0x5A6F12E1, version 12, index offset/size, bEncryptedIndex, compression methods);
//  - primary index: mount point, entry count, path-hash seed, path-hash index and full-directory index
//    (offset/size/hash each), then the encoded entries blob;
//  - encoded entry: u32 flags (bit31 offset32, bit30 uncompressed32, bit29 size32, bits 23-28 compression
//    method, bit22 encrypted, bits 6-21 block count, bits 0-5 block size >> 11 or 0x3f = explicit u32 that
//    FOLLOWS THE FLAGS, before the offset); then offset, uncompressed size, [size], [block sizes];
//  - each entry's data is preceded by a serialized FPakEntry header (53 bytes + 4 + 16 per block when compressed);
//  - encrypted blocks are AES-256-ECB over the block padded to 16 bytes; compression blocks hold `blockSize`
//    uncompressed bytes except the last.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { decompressAll } = require('./oodle-batch');

const dec = (key, b) => { const d = crypto.createDecipheriv('aes-256-ecb', key, null); d.setAutoPadding(false); return Buffer.concat([d.update(b), d.final()]); };

function openPak(pakPath, key) {
  const fd = fs.openSync(pakPath, 'r');
  const sz = fs.fstatSync(fd).size;
  const ft = Buffer.alloc(300);
  fs.readSync(fd, ft, 0, 300, sz - 300);
  const m = ft.indexOf(Buffer.from('e1126f5a', 'hex'));
  if (m < 0) throw new Error('pak footer not found: ' + pakPath);
  const ver = ft.readUInt32LE(m + 4), io = Number(ft.readBigUInt64LE(m + 8)), isz = Number(ft.readBigUInt64LE(m + 16)), encIdx = ft[m - 1];
  let idx = Buffer.alloc(isz);
  fs.readSync(fd, idx, 0, isz, io);
  if (encIdx) { if (!key) throw new Error('pak index is encrypted; a key is required'); idx = dec(key, idx); }
  let p = 0;
  const rd = (b) => { const l = b.readInt32LE(p); p += 4; if (l < 0) { const s = b.subarray(p, p - 2 * l - 2).toString('utf16le'); p += -2 * l; return s; } const s = b.subarray(p, p + l).toString('utf8').replace(/\0+$/, ''); p += l; return s; };
  if (ver < 10) {
    // legacy index (pak v3..v9): mount point, count, then (name, FPakEntry) pairs inline — the Turkish text patch is v3
    const mountL = rd(idx);
    const n = idx.readInt32LE(p); p += 4;
    const filesL = [], ents = [];
    for (let i = 0; i < n; i++) {
      const name = rd(idx);
      const off = Number(idx.readBigInt64LE(p)), size = Number(idx.readBigInt64LE(p + 8)), unc = Number(idx.readBigInt64LE(p + 16)), cm = idx.readInt32LE(p + 24);
      p += 28 + 20;
      let nb = 0; const blocks = [];
      if (cm) { nb = idx.readInt32LE(p); p += 4; for (let k = 0; k < nb; k++) { blocks.push([Number(idx.readBigInt64LE(p)) - off, Number(idx.readBigInt64LE(p + 8)) - off]); p += 16; } }
      const encrypted = !!idx[p]; p += 1;
      const bs = idx.readUInt32LE(p); p += 4;
      filesL.push({ path: mountL + name, eo: ents.length });
      ents.push({ off, unc, size, compMethod: cm, encrypted, blocks, blockSize: bs || unc, nb });
    }
    return { version: ver, mount: mountL, files: filesL, entry: (eo) => ents[eo], extract: () => { throw new Error('extract() is not implemented for legacy paks'); }, close: () => fs.closeSync(fd) };
  }
  const mount = rd(idx);
  p += 4 + 8; // entry count, path hash seed
  if (idx.readInt32LE(p)) p += 4 + 16 + 20; else p += 4; // path hash index
  if (!idx.readInt32LE(p)) throw new Error('pak has no full directory index');
  p += 4;
  const fdOff = Number(idx.readBigInt64LE(p)), fdSz = Number(idx.readBigInt64LE(p + 8));
  p += 16 + 20;
  const encLen = idx.readInt32LE(p); p += 4;
  const encoded = idx.subarray(p, p + encLen);
  let fdb = Buffer.alloc(fdSz);
  fs.readSync(fd, fdb, 0, fdSz, fdOff);
  if (encIdx) fdb = dec(key, fdb);
  p = 0;
  const nd = fdb.readInt32LE(p); p += 4;
  const files = [];
  for (let i = 0; i < nd; i++) {
    const dir = rd(fdb);
    const nf = fdb.readInt32LE(p); p += 4;
    for (let j = 0; j < nf; j++) { const f = rd(fdb); const eo = fdb.readInt32LE(p); p += 4; files.push({ path: mount + dir + f, eo }); }
  }
  function entry(eo) {
    let r = eo;
    const fl = encoded.readUInt32LE(r); r += 4;
    const compMethod = (fl >> 23) & 0x3f, encrypted = !!(fl & (1 << 22)), bits = fl & 0x3f, nb = (fl >> 6) & 0xffff;
    const bOff32 = !!(fl & (1 << 31)), bUnc32 = !!(fl & (1 << 30)), bSz32 = !!(fl & (1 << 29));
    let blockSize = 0;
    if (bits === 0x3f) { blockSize = encoded.readUInt32LE(r); r += 4; } else blockSize = bits << 11;
    const off = bOff32 ? encoded.readUInt32LE(r) : Number(encoded.readBigUInt64LE(r)); r += bOff32 ? 4 : 8;
    const unc = bUnc32 ? encoded.readUInt32LE(r) : Number(encoded.readBigUInt64LE(r)); r += bUnc32 ? 4 : 8;
    let size = unc;
    if (compMethod) { size = bSz32 ? encoded.readUInt32LE(r) : Number(encoded.readBigUInt64LE(r)); r += bSz32 ? 4 : 8; }
    if (nb === 1) blockSize = unc;
    const hdr = 53 + (nb > 0 ? 4 + 16 * nb : 0);
    const blocks = [];
    if (nb === 1) blocks.push([hdr, hdr + size]);
    else { let bo = hdr; for (let i = 0; i < nb; i++) { const bs = encoded.readUInt32LE(r); r += 4; blocks.push([bo, bo + bs]); bo += encrypted ? Math.ceil(bs / 16) * 16 : bs; } }
    return { off, unc, size, compMethod, encrypted, blocks, blockSize, nb };
  }
  // read + decrypt the raw (still compressed) blocks of an entry
  function rawBlocks(e) {
    if (!e.compMethod) {
      const len = e.encrypted ? Math.ceil(e.unc / 16) * 16 : e.unc;
      const b = Buffer.alloc(len);
      fs.readSync(fd, b, 0, len, e.off + 53);
      return [{ src: (e.encrypted ? dec(key, b) : b).subarray(0, e.unc), raw: e.unc }];
    }
    const jobs = [];
    let remaining = e.unc;
    for (const [s, t] of e.blocks) {
      const clen = t - s, len = e.encrypted ? Math.ceil(clen / 16) * 16 : clen;
      const b = Buffer.alloc(len);
      fs.readSync(fd, b, 0, len, e.off + s);
      const want = Math.min(e.blockSize, remaining); remaining -= want;
      jobs.push({ src: (e.encrypted ? dec(key, b) : b).subarray(0, clen), raw: want });
    }
    return jobs;
  }
  // extract the entries whose path matches `re` under outDir (mount prefix ../../../ stripped); returns [{rel, ok}]
  function extract(re, outDir, tmpdir = path.join(outDir, '_tmp')) {
    const sel = files.filter((f) => re.test(f.path));
    const jobs = [], plan = [];
    for (const f of sel) {
      const e = entry(f.eo);
      const rel = f.path.replace(/^(\.\.\/)+/, '');
      const outp = path.join(outDir, rel);
      fs.mkdirSync(path.dirname(outp), { recursive: true });
      const jl = rawBlocks(e).map((j) => { jobs.push(j); return jobs.length - 1; });
      plan.push({ outp, rel, jl });
    }
    const res = decompressAll(jobs, tmpdir);
    const out = [];
    for (const pl of plan) {
      const parts = pl.jl.map((i) => res[i]);
      if (parts.some((x) => !x)) { out.push({ rel: pl.rel, ok: false }); continue; }
      fs.writeFileSync(pl.outp, Buffer.concat(parts));
      out.push({ rel: pl.rel, ok: true });
    }
    return out;
  }
  return { version: ver, mount, files, entry, extract, close: () => fs.closeSync(fd) };
}

module.exports = { openPak };
