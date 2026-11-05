'use strict';
// Positioned readers for the portable core. A reader is any object of the shape
//
//   { size: number, name?: string, read(offset, length) → Promise<Uint8Array> }
//
// read() returns `length` bytes, or fewer when the range runs past the end (never throws for that).
// The core never assumes it can hold a whole file: big inputs (the 476 MB game exe) are read in chunks.
// The Node wrappers build readers on positioned fs reads; a browser passes a File through fromBlob().
//
//   fromBytes(u8, name?)   → reader over bytes already in memory
//   fromBlob(blob, name?)  → reader over a Blob / File (blob.slice().arrayBuffer(), browser or Node)

function clampRange(size, offset, length) {
  const start = Math.max(0, Math.min(size, offset));
  return [start, Math.max(start, Math.min(size, offset + length))];
}

function fromBytes(u8, name) {
  return {
    size: u8.length,
    name,
    async read(offset, length) {
      const [s, e] = clampRange(u8.length, offset, length);
      return u8.subarray(s, e);
    },
  };
}

function fromBlob(blob, name = blob.name) {
  return {
    size: blob.size,
    name,
    async read(offset, length) {
      const [s, e] = clampRange(blob.size, offset, length);
      return new Uint8Array(await blob.slice(s, e).arrayBuffer());
    },
  };
}

module.exports = { fromBytes, fromBlob };
