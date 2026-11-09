'use strict';
// Unreal IoStore (.utoc/.ucas, TOC version 8) reader for the game's main container.
// Format notes (verified on ProjectPBZ-Windows.utoc):
//  - header 0x90 bytes: magic, version, header size, chunk count, compressed block count, block entry size (12),
//    compression method count/length, compression block size (0x40000), directory index size, partition count,
//    container id, encryption key guid, container flags (1 compressed, 2 encrypted, 4 signed, 8 indexed),
//    perfect-hash seed count, partition size (0x80000000 → .ucas, _s1.ucas, ...), chunks-without-hash count;
//  - chunk ids (12 bytes, type in the last byte), FIoOffsetAndLength (5-byte BIG-endian offset and length),
//    perfect hash seeds, compression blocks (5-byte offset, 3-byte compressed size, 3-byte uncompressed size,
//    1-byte method; little-endian), method names, [signatures], AES-256-ECB encrypted directory index
//    (mount point, directory entries, file entries, string table);
//  - a chunk's data = its compression blocks (block index = offset / block size) decrypted per block
//    (padded to 16), decompressed, then sliced at offset % block size.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { decompressAll } = require('./oodle-batch');

const dec = (key, b) => { const d = crypto.createDecipheriv('aes-256-ecb', key, null); d.setAutoPadding(false); return Buffer.concat([d.update(b), d.final()]); };
const rd5 = (b, o) => b.readUInt32LE(o) + b[o + 4] * 2 ** 32;
const rd5be = (b, o) => b[o] * 2 ** 32 + b.readUInt32BE(o + 1);
const rd3 = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

function openToc(utoc, key) {
  const base = utoc.replace(/\.utoc$/i, '');
  const fd = fs.openSync(utoc, 'r');
  const h = Buffer.alloc(0x90);
  fs.readSync(fd, h, 0, 0x90, 0);
  const hs = h.readUInt32LE(0x14), n = h.readUInt32LE(0x18), nb = h.readUInt32LE(0x1c), bes = h.readUInt32LE(0x20), ncm = h.readUInt32LE(0x24), cml = h.readUInt32LE(0x28), cbs = h.readUInt32LE(0x2c), dsz = h.readUInt32LE(0x30), flags = h.readUInt32LE(0x50), nph = h.readUInt32LE(0x54), partSize = Number(h.readBigUInt64LE(0x58)), nwo = h.readUInt32LE(0x60);
  const enc = !!(flags & 2);
  if (enc && !key) throw new Error('container is encrypted; a key is required');
  let off = hs;
  const ids = Buffer.alloc(n * 12); fs.readSync(fd, ids, 0, n * 12, off); off += n * 12;
  const ols = Buffer.alloc(n * 10); fs.readSync(fd, ols, 0, n * 10, off); off += n * 10;
  off += nph * 4 + nwo * 4;
  const blocks = Buffer.alloc(nb * bes); fs.readSync(fd, blocks, 0, nb * bes, off); off += nb * bes;
  const methods = ['None'];
  const mb = Buffer.alloc(ncm * cml); fs.readSync(fd, mb, 0, ncm * cml, off); off += ncm * cml;
  for (let i = 0; i < ncm; i++) methods.push(mb.subarray(i * cml, (i + 1) * cml).toString().replace(/\0+$/, ''));
  if (flags & 4) { const sb = Buffer.alloc(4); fs.readSync(fd, sb, 0, 4, off); off += 4 + sb.readUInt32LE(0) * 2 + nb * 20; }
  // directory index
  const files = [];
  let mount = '';
  if (dsz) {
    const dirb = Buffer.alloc(dsz); fs.readSync(fd, dirb, 0, dsz, off);
    const dir = enc ? dec(key, dirb) : dirb;
    let p = 0;
    const fstr = () => { const l = dir.readInt32LE(p); p += 4; if (l < 0) { const s = dir.subarray(p, p - 2 * l - 2).toString('utf16le'); p += -2 * l; return s; } const s = dir.subarray(p, p + l - 1).toString('utf8'); p += l; return s; };
    mount = fstr();
    const ndr = dir.readUInt32LE(p); p += 4;
    const dirs = []; for (let i = 0; i < ndr; i++) { dirs.push({ name: dir.readUInt32LE(p), child: dir.readUInt32LE(p + 4), sib: dir.readUInt32LE(p + 8), file: dir.readUInt32LE(p + 12) }); p += 16; }
    const nf = dir.readUInt32LE(p); p += 4;
    const fents = []; for (let i = 0; i < nf; i++) { fents.push({ name: dir.readUInt32LE(p), next: dir.readUInt32LE(p + 4), ud: dir.readUInt32LE(p + 8) }); p += 12; }
    const ns = dir.readUInt32LE(p); p += 4;
    const strs = []; for (let i = 0; i < ns; i++) strs.push(fstr());
    const NONE = 0xffffffff;
    (function walk(di, prefix) {
      while (di !== NONE) {
        const d = dirs[di]; const name = d.name === NONE ? '' : strs[d.name]; const pth = prefix + (name ? name + '/' : '');
        let fi = d.file; while (fi !== NONE) { const f = fents[fi]; files.push({ path: pth + strs[f.name], ud: f.ud }); fi = f.next; }
        walk(d.child, pth); di = d.sib;
      }
    })(0, mount);
  }
  const chunk = (i) => ({ off: rd5be(ols, i * 10), len: rd5be(ols, i * 10 + 5), type: ids[i * 12 + 11], id: ids.subarray(i * 12, i * 12 + 12).toString('hex') });
  const parts = {};
  function readRaw(o, len) {
    const part = Math.floor(o / partSize), po = o - part * partSize;
    const f = part === 0 ? base + '.ucas' : `${base}_s${part}.ucas`;
    if (!parts[f]) parts[f] = fs.openSync(f, 'r');
    const b = Buffer.alloc(len); fs.readSync(parts[f], b, 0, len, po); return b;
  }
  // the (still compressed, decrypted) blocks covering a chunk + the slice to apply after decompression
  function rawBlocks(c) {
    const first = Math.floor(c.off / cbs), last = Math.floor((c.off + c.len - 1) / cbs);
    const jobs = [];
    for (let bi = first; bi <= last; bi++) {
      const bo = bi * bes; const boff = rd5(blocks, bo), csz = rd3(blocks, bo + 5), usz = rd3(blocks, bo + 8);
      const rlen = enc ? Math.ceil(csz / 16) * 16 : csz;
      let b = readRaw(boff, rlen); if (enc) b = dec(key, b);
      jobs.push({ src: b.subarray(0, csz), raw: usz });
    }
    return { jobs, skip: c.off % cbs, len: c.len };
  }
  // read one chunk by index (small assets only; everything goes through one Oodle batch)
  function readChunkIndices(indices, tmpdir) {
    const jobs = [], plan = [];
    for (const i of indices) { const c = chunk(i); const { jobs: jl, skip, len } = rawBlocks(c); plan.push({ idx: jl.map((j) => { jobs.push(j); return jobs.length - 1; }), skip, len }); }
    const res = decompressAll(jobs, tmpdir);
    return plan.map((pl) => { const ps = pl.idx.map((i) => res[i]); if (ps.some((x) => !x)) return null; return Buffer.concat(ps).subarray(pl.skip, pl.skip + pl.len); });
  }
  function extract(re, outDir, tmpdir = path.join(outDir, '_tmp')) {
    const sel = files.filter((f) => re.test(f.path));
    const bufs = readChunkIndices(sel.map((f) => f.ud), tmpdir);
    return sel.map((f, i) => {
      const rel = f.path.replace(/^(\.\.\/)+/, '');
      if (!bufs[i]) return { rel, ok: false };
      const outp = path.join(outDir, rel); fs.mkdirSync(path.dirname(outp), { recursive: true }); fs.writeFileSync(outp, bufs[i]);
      return { rel, ok: true };
    });
  }
  return { mount, flags, methods, chunkCount: n, files, chunk, readChunkIndices, extract, close: () => { fs.closeSync(fd); for (const f in parts) fs.closeSync(parts[f]); } };
}

module.exports = { openToc };
