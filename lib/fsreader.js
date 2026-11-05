'use strict';
// Node side of the core's positioned-reader interface (lib/core/readers.js): read-only fs handles.
//   async openFileReader(file) → { size, name, pakPath, read(offset, length) → Promise<Uint8Array>, close() }
// read() loops over short reads and returns fewer bytes only at end of file.
const fs = require('fs');
const path = require('path');

async function openFileReader(file) {
  const fh = await fs.promises.open(file, 'r');
  let size;
  try { size = (await fh.stat()).size; } catch (e) { await fh.close().catch(() => {}); throw e; }
  return {
    size,
    name: path.basename(file),
    pakPath: file,
    async read(offset, length) {
      const len = Math.max(0, Math.min(length, size - offset));
      const b = new Uint8Array(len);
      let got = 0;
      while (got < len) {
        const { bytesRead } = await fh.read(b, got, len - got, offset + got);
        if (bytesRead === 0) break;
        got += bytesRead;
      }
      return got === len ? b : b.subarray(0, got);
    },
    close: () => fh.close(),
  };
}

// Run fn(reader) and always close the file.
async function withFileReader(file, fn) {
  const r = await openFileReader(file);
  try { return await fn(r); } finally { await r.close().catch(() => {}); }
}

module.exports = { openFileReader, withFileReader };
