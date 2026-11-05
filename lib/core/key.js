'use strict';
// Derives the PBZ save AES-256 key from the game executable (portable: Node and browser).
// The 64-byte key material sits right after a UTF-16LE marker string; key = first32 XOR last32.
//
//   async deriveKeyFromReader(reader, { label } = {}) → Uint8Array(32)
//     reader: { size, read(offset, length) → Promise<Uint8Array> } (see readers.js) over PBZ.exe.
//     Scans in CHUNK-sized windows that overlap by the marker length, so the exe is never held in
//     memory as a whole. Each hit's material is checked against a known SHA-256 prefix (WebCrypto).
//     label: shown in the "marker not found" error (defaults to reader.name).
//     Errors carry the localized messages err.keyNoMarker / err.keyNoMatch.
const { t } = require('../i18n');
const { utf16leBytes, indexOfBytes, toHex } = require('./bytes');

const MARKER = utf16leBytes('sealed but block is PLAINTEXT');
const MATERIAL_OFFSET = 66;   // bytes from the start of the marker
const MATERIAL_LEN = 64;
const EXPECTED_SHA_PREFIX = 'cec857d9'; // SHA-256 of the 64-byte material (public, phantombladezerosaves.com)
const CHUNK = 32 * 1024 * 1024;

const subtle = () => {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error('WebCrypto (crypto.subtle) is not available');
  return s;
};

async function findMarkers(reader, chunk = CHUNK) {
  const hits = [];
  for (let pos = 0; pos < reader.size; pos += chunk) {
    const buf = await reader.read(pos, Math.min(chunk + MARKER.length, reader.size - pos));
    let i = -1;
    while ((i = indexOfBytes(buf, MARKER, i + 1)) !== -1) {
      if (i < chunk) hits.push(pos + i); // the overlap region is scanned again by the next chunk
    }
  }
  return hits;
}

async function deriveKeyFromReader(reader, { label, chunk } = {}) {
  const hits = await findMarkers(reader, chunk);
  if (hits.length === 0) throw new Error(t('err.keyNoMarker', { p: label ?? reader.name ?? '' }));
  const seen = [];
  for (const h of hits) {
    const mat = new Uint8Array(MATERIAL_LEN); // zero-padded if the file ends early
    mat.set(await reader.read(h + MATERIAL_OFFSET, MATERIAL_LEN));
    const sha = toHex(new Uint8Array(await subtle().digest('SHA-256', mat)));
    seen.push(sha.slice(0, 8));
    if (sha.startsWith(EXPECTED_SHA_PREFIX)) {
      const key = new Uint8Array(32);
      for (let i = 0; i < 32; i++) key[i] = mat[i] ^ mat[32 + i];
      return key;
    }
  }
  throw new Error(t('err.keyNoMatch', { want: EXPECTED_SHA_PREFIX, got: seen.join(', ') }));
}

module.exports = { deriveKeyFromReader, MARKER, EXPECTED_SHA_PREFIX };
