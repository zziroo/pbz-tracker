'use strict';
// PBZS v3 container: read-only in-memory snapshot, AES-256-GCM blocks, Oodle-compressed JSON slots.
const fs = require('fs');
const crypto = require('crypto');
const oodle = require('./oodle');
const { t } = require('./i18n');

class TransientError extends Error {}   // file likely mid-write / being replaced: retry

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sigOf = (st) => `${st.mtimeMs}:${st.size}`;

function transientFs(fn) {
  try { return fn(); } catch (e) {
    if (['EBUSY', 'EPERM', 'EACCES', 'ENOENT'].includes(e.code)) throw new TransientError(t('err.saveBusy', { code: e.code }));
    throw e;
  }
}

// Read the whole save into memory. libuv opens files with FILE_SHARE_READ|WRITE|DELETE and we open
// read-only, so the game can keep writing. If the file changed while we read it, retry.
function snapshot(savePath) {
  const before = transientFs(() => fs.statSync(savePath));
  const buf = transientFs(() => fs.readFileSync(savePath, { flag: 'r' }));
  const after = transientFs(() => fs.statSync(savePath));
  if (sigOf(before) !== sigOf(after) || buf.length !== after.size) throw new TransientError(t('err.saveChanged'));
  return { buf, mtime: after.mtime, sig: sigOf(after) };
}

function openBlock(key, blk) {
  if (blk.length < 36 || blk.toString('latin1', 0, 4) !== 'PBZS') throw new TransientError(t('err.blockBad'));
  const d = crypto.createDecipheriv('aes-256-gcm', key, blk.subarray(8, 20));
  d.setAuthTag(blk.subarray(20, 36));
  try {
    return Buffer.concat([d.update(blk.subarray(36)), d.final()]);
  } catch {
    throw new TransientError(t('err.gcm'));
  }
}

function parseContainer(buf, key) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'PBZS') throw new TransientError(t('err.noHeader'));
  if (buf[4] !== 3) throw new Error(t('err.version', { v: buf[4] }));
  const dirLen = buf.readUInt32LE(8);
  if (12 + dirLen > buf.length) throw new TransientError(t('err.short'));
  const dir = openBlock(key, buf.subarray(12, 12 + dirLen));
  const base = 12 + dirLen;
  const entries = [];
  let p = 12; // decrypted directory starts with a 12-byte copy of the header
  while (p < dir.length) {
    if (p + 2 > dir.length) throw new Error(t('err.dirBad'));
    const nl = dir.readUInt16LE(p); p += 2;
    if (p + nl + 14 > dir.length) throw new Error(t('err.dirBad'));
    const name = dir.toString('utf8', p, p + nl); p += nl;
    const e = { name, alg: dir[p], flag: dir[p + 1], raw: dir.readUInt32LE(p + 2), off: dir.readUInt32LE(p + 6), size: dir.readUInt32LE(p + 10) };
    p += 14;
    if (base + e.off + e.size > buf.length) throw new TransientError(t('err.slotRange', { name }));
    entries.push(e);
  }
  return { entries, slotBlock: (e) => openBlock(key, buf.subarray(base + e.off, base + e.off + e.size)) };
}

function slotBytes(container, e) {
  const plain = container.slotBlock(e);
  if (e.alg === 0) return plain;
  if (e.alg === 2) return oodle.decompress(plain, e.raw);
  throw new Error(t('err.compression', { name: e.name, alg: e.alg }));
}

function parseJson(name, buf) {
  const s = buf.toString('utf8').replace(/^\uFEFF/, '').replace(/\0+$/, '');
  try { return JSON.parse(s); } catch (e) { throw new Error(t('err.slotJson', { name, msg: e.message })); }
}

// "2026.11.05-03.37.44": compare digits only.
const dtKey = (s) => (s || '').replace(/\D/g, '');

async function loadSave({ savePath, key, retries = 6, delayMs = 750 }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { buf, mtime, sig } = snapshot(savePath);
      const c = parseContainer(buf, key);
      const gameSlots = c.entries.filter((e) => /^(AutoSave|ManualSave)\d+$/.test(e.name));
      if (gameSlots.length === 0) throw new Error(t('err.noSlots'));
      const slots = gameSlots.map((e) => {
        const data = parseJson(e.name, slotBytes(c, e));
        return { name: e.name, dateTime: data?.PBZGameSystem?.DateTimeString || '', data };
      });
      // Newest DateTimeString first; ties (the game often writes two identical slots) → more play time, then name.
      const playTime = (s) => s.data?.PBZGameSystem?.HasGameTime || 0;
      slots.sort((a, b) => dtKey(b.dateTime).localeCompare(dtKey(a.dateTime)) || playTime(b) - playTime(a) || a.name.localeCompare(b.name));
      return { mtime, sig, slots, latest: slots[0] };
    } catch (e) {
      lastErr = e;
      if (!(e instanceof TransientError) || attempt === retries) break;
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

module.exports = { loadSave, TransientError, sigOf };
