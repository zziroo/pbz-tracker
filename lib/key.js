'use strict';
// Derives the PBZ save AES-256 key from the game executable (read-only).
// The 64-byte key material sits right after a UTF-16LE marker string; key = first32 XOR last32.
const fs = require('fs');
const crypto = require('crypto');

const MARKER = Buffer.from('sealed but block is PLAINTEXT', 'utf16le');
const MATERIAL_OFFSET = 66;   // bytes from the start of the marker
const MATERIAL_LEN = 64;
const EXPECTED_SHA_PREFIX = 'cec857d9'; // SHA-256 of the 64-byte material (public, phantombladezerosaves.com)

function findMarkers(fd, size) {
  const CHUNK = 64 * 1024 * 1024;
  const hits = [];
  const buf = Buffer.alloc(CHUNK + MARKER.length);
  for (let pos = 0; pos < size; pos += CHUNK) {
    const len = Math.min(CHUNK + MARKER.length, size - pos);
    fs.readSync(fd, buf, 0, len, pos);
    const view = buf.subarray(0, len);
    let i = -1;
    while ((i = view.indexOf(MARKER, i + 1)) !== -1) {
      if (i < CHUNK) hits.push(pos + i); // overlap region is scanned by the next chunk
    }
  }
  return hits;
}

function deriveKey(exePath) {
  const fd = fs.openSync(exePath, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const hits = findMarkers(fd, size);
    if (hits.length === 0) {
      throw new Error(`Anahtar işaret dizesi exe içinde bulunamadı (${exePath}). Oyun güncellenmiş ve format değişmiş olabilir.`);
    }
    const seen = [];
    for (const h of hits) {
      const mat = Buffer.alloc(MATERIAL_LEN);
      fs.readSync(fd, mat, 0, MATERIAL_LEN, h + MATERIAL_OFFSET);
      const sha = crypto.createHash('sha256').update(mat).digest('hex');
      seen.push(sha.slice(0, 8));
      if (sha.startsWith(EXPECTED_SHA_PREFIX)) {
        const key = Buffer.alloc(32);
        for (let i = 0; i < 32; i++) key[i] = mat[i] ^ mat[32 + i];
        return key;
      }
    }
    throw new Error(`Anahtar doğrulanamadı: beklenen SHA-256 öneki ${EXPECTED_SHA_PREFIX}, bulunan(lar) ${seen.join(', ')}. ` +
      'Oyun güncellemesi anahtarı değiştirmiş olabilir; research/ betikleriyle yeniden incele.');
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { deriveKey };
