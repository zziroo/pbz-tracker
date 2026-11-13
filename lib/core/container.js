'use strict';
// PBZS v3 save container (portable: Node and browser). AES-256-GCM blocks via WebCrypto,
// Oodle-compressed JSON slots. Works on bytes already in memory; reading the file (and retrying while
// the game writes it) is the caller's job (lib/savefile.js in Node, a File in the browser).
//
//   class TransientError extends Error   — the file is probably mid-write / being replaced: retry
//   async decodeSave(bytes, key) → { slots, latest }
//     bytes: Uint8Array of the whole save file; key: Uint8Array(32) (from key.js) or an AES-GCM CryptoKey.
//     slots: [{ name, dateTime, data }] for AutoSave<n>/ManualSave<n>/NightmareRun<n>, newest first
//     (DateTimeString, then play time, then name); latest = slots[0].
//     Throws TransientError for a short/truncated file, a bad block header or a GCM failure; Error for
//     an unknown container version, a broken directory, no game slots, bad JSON or compression.
//   async parseContainer(bytes, cryptoKey) → { entries, slotBlock(entry) → Promise<Uint8Array> }
//   async importKey(key) → CryptoKey
//
// Block layout: "PBZS" | 4 bytes | 12-byte IV | 16-byte GCM tag | ciphertext. WebCrypto wants
// ciphertext||tag, so the tag is moved behind the ciphertext before decrypting.
const oodle = require('./oodle');
const { t } = require('../i18n');
const { latin1, utf8, u16le, u32le, concatBytes } = require('./bytes');

class TransientError extends Error {}

const subtle = () => {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error('WebCrypto (crypto.subtle) is not available');
  return s;
};

async function importKey(key) {
  if (key && typeof key === 'object' && key.type === 'secret' && key.algorithm) return key; // CryptoKey
  return subtle().importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function openBlock(cryptoKey, blk) {
  if (blk.length < 36 || latin1(blk, 0, 4) !== 'PBZS') throw new TransientError(t('err.blockBad'));
  const iv = blk.slice(8, 20);
  const data = concatBytes(blk.subarray(36), blk.subarray(20, 36));
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, cryptoKey, data));
  } catch {
    throw new TransientError(t('err.gcm'));
  }
}

async function parseContainer(buf, cryptoKey) {
  if (buf.length < 12 || latin1(buf, 0, 4) !== 'PBZS') throw new TransientError(t('err.noHeader'));
  if (buf[4] !== 3) throw new Error(t('err.version', { v: buf[4] }));
  const dirLen = u32le(buf, 8);
  if (12 + dirLen > buf.length) throw new TransientError(t('err.short'));
  const dir = await openBlock(cryptoKey, buf.subarray(12, 12 + dirLen));
  const base = 12 + dirLen;
  const entries = [];
  let p = 12; // decrypted directory starts with a 12-byte copy of the header
  while (p < dir.length) {
    if (p + 2 > dir.length) throw new Error(t('err.dirBad'));
    const nl = u16le(dir, p); p += 2;
    if (p + nl + 14 > dir.length) throw new Error(t('err.dirBad'));
    const name = utf8(dir, p, p + nl); p += nl;
    const e = { name, alg: dir[p], flag: dir[p + 1], raw: u32le(dir, p + 2), off: u32le(dir, p + 6), size: u32le(dir, p + 10) };
    p += 14;
    if (base + e.off + e.size > buf.length) throw new TransientError(t('err.slotRange', { name }));
    entries.push(e);
  }
  return { entries, slotBlock: (e) => openBlock(cryptoKey, buf.subarray(base + e.off, base + e.off + e.size)) };
}

async function slotBytes(container, e) {
  const plain = await container.slotBlock(e);
  if (e.alg === 0) return plain;
  if (e.alg === 2) return oodle.decompress(plain, e.raw);
  throw new Error(t('err.compression', { name: e.name, alg: e.alg }));
}

function parseJson(name, buf) {
  const s = utf8(buf).replace(/^\uFEFF/, '').replace(/\0+$/, '');
  try { return JSON.parse(s); } catch (e) { throw new Error(t('err.slotJson', { name, msg: e.message })); }
}

// "2026.11.05-03.37.44": compare digits only.
const dtKey = (s) => (s || '').replace(/\D/g, '');

// The playable slots: autosaves, manual saves and the 66 Days mode runs (NightmareRun<n>, the only slot a 66 Days
// run is written to; save of 2026-11-13). Not slots: __Advanced__, __Achievements__ and the game's own snapshots
// (EndingReturn_<id>, NightmareCycleStart_<id>, NightmareLineStart_<id>: the state a run goes back to).
const GAME_SLOT = /^(AutoSave|ManualSave|NightmareRun)\d+$/;

async function decodeSave(bytes, key) {
  const c = await parseContainer(bytes, await importKey(key));
  const gameSlots = c.entries.filter((e) => GAME_SLOT.test(e.name));
  if (gameSlots.length === 0) throw new Error(t('err.noSlots'));
  const slots = [];
  for (const e of gameSlots) {
    const data = parseJson(e.name, await slotBytes(c, e));
    slots.push({ name: e.name, dateTime: data?.PBZGameSystem?.DateTimeString || '', data });
  }
  // Newest DateTimeString first; ties (the game often writes two identical slots) → more play time, then name.
  const playTime = (s) => s.data?.PBZGameSystem?.HasGameTime || 0;
  slots.sort((a, b) => dtKey(b.dateTime).localeCompare(dtKey(a.dateTime)) || playTime(b) - playTime(a) || a.name.localeCompare(b.name));
  return { slots, latest: slots[0] };
}

module.exports = { decodeSave, parseContainer, importKey, TransientError };
