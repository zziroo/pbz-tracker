'use strict';
// Byte helpers for the portable core (Node and browser). Works on Uint8Array only; no Node built-ins.
//
//   view(u8)                      → DataView over exactly the bytes of u8 (honours byteOffset)
//   u16le/u32le/i32le(u8, p)      → little-endian integers
//   i64le(u8, p)                  → BigInt (signed, little-endian)
//   latin1(u8, start, end)        → string, one char per byte (same as the old latin1 decoding;
//                                   NOT TextDecoder('latin1'), which is windows-1252)
//   utf16le(u8, start, end)       → string from UTF-16LE code units, lone surrogates kept
//   utf8(u8, start, end)          → string (TextDecoder, BOM kept so callers can strip it themselves)
//   utf16leBytes(str)             → Uint8Array, UTF-16LE encoding of str
//   hexBytes(hex)                 → Uint8Array from a hex string
//   toHex(u8)                     → lower-case hex string
//   equalBytes(a, b)              → boolean
//   indexOfBytes(hay, needle, from = 0, end = hay.length) → first index or -1
//   concatBytes(...parts)         → Uint8Array

const view = (u8) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
const u16le = (u8, p) => u8[p] | (u8[p + 1] << 8);
const u32le = (u8, p) => (u8[p] | (u8[p + 1] << 8) | (u8[p + 2] << 16)) + u8[p + 3] * 0x1000000;
const i32le = (u8, p) => u8[p] | (u8[p + 1] << 8) | (u8[p + 2] << 16) | (u8[p + 3] << 24);
const i64le = (u8, p) => view(u8).getBigInt64(p, true);

const CHUNK = 0x2000; // String.fromCharCode argument count limit stays far away
function latin1(u8, start = 0, end = u8.length) {
  let s = '';
  for (let i = start; i < end; i += CHUNK) s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(end, i + CHUNK)));
  return s;
}
function utf16le(u8, start = 0, end = u8.length) {
  end = start + ((end - start) & ~1); // an odd trailing byte is ignored
  let s = '';
  const units = [];
  for (let i = start; i < end; i += 2) {
    units.push(u8[i] | (u8[i + 1] << 8));
    if (units.length === CHUNK) { s += String.fromCharCode.apply(null, units); units.length = 0; }
  }
  if (units.length) s += String.fromCharCode.apply(null, units);
  return s;
}
const UTF8 = new TextDecoder('utf-8', { ignoreBOM: true });
const utf8 = (u8, start = 0, end = u8.length) => UTF8.decode(u8.subarray(start, end));

function utf16leBytes(str) {
  const out = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); out[2 * i] = c & 0xFF; out[2 * i + 1] = c >> 8; }
  return out;
}
function hexBytes(hex) {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(2 * i, 2), 16);
  return out;
}
const toHex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');

function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Native single-byte search for the needle's first byte, then a byte compare.
function indexOfBytes(hay, needle, from = 0, end = hay.length) {
  const n = needle.length;
  if (n === 0) return from <= end ? from : -1;
  const first = needle[0];
  const last = end - n;
  let i = Math.max(0, from);
  while (i <= last) {
    i = hay.indexOf(first, i);
    if (i < 0 || i > last) return -1;
    let k = 1;
    while (k < n && hay[i + k] === needle[k]) k++;
    if (k === n) return i;
    i++;
  }
  return -1;
}

function concatBytes(...parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

module.exports = { view, u16le, u32le, i32le, i64le, latin1, utf16le, utf8, utf16leBytes, hexBytes, toHex, equalBytes, indexOfBytes, concatBytes };
