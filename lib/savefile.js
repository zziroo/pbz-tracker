'use strict';
// PBZS v3 container: read-only snapshot, AES-256-GCM blocks, Oodle-compressed JSON slots.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

class TransientError extends Error {}   // file likely mid-write: retry

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Read the whole save into memory. libuv opens files with FILE_SHARE_READ|WRITE|DELETE,
// so the game can keep writing; we never open it for writing.
function snapshot(savePath) {
  const before = fs.statSync(savePath);
  let buf;
  try {
    buf = fs.readFileSync(savePath, { flag: 'r' });
  } catch (e) {
    if (['EBUSY', 'EPERM', 'EACCES', 'ENOENT'].includes(e.code)) throw new TransientError(`Save okunamadı (${e.code})`);
    throw e;
  }
  const after = fs.statSync(savePath);
  if (before.mtimeMs !== after.mtimeMs || before.size !== after.size || buf.length !== after.size) {
    throw new TransientError('Save okunurken değişti');
  }
  return { buf, mtime: after.mtime };
}

function openBlock(key, blk) {
  if (blk.length < 36 || blk.toString('latin1', 0, 4) !== 'PBZS') throw new TransientError('Mühürlü blok başlığı bozuk/kısa');
  const d = crypto.createDecipheriv('aes-256-gcm', key, blk.subarray(8, 20));
  d.setAuthTag(blk.subarray(20, 36));
  try {
    return Buffer.concat([d.update(blk.subarray(36)), d.final()]);
  } catch {
    throw new TransientError('GCM doğrulama hatası');
  }
}

function parseContainer(buf, key) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'PBZS') throw new TransientError('PBZS başlığı yok ya da dosya kısa');
  const ver = buf[4];
  if (ver !== 3) throw new Error(`Bilinmeyen save sürümü ${ver} (beklenen 3)`);
  const dirLen = buf.readUInt32LE(8);
  if (12 + dirLen > buf.length) throw new TransientError('Dosya dizin bloğundan kısa');
  const dir = openBlock(key, buf.subarray(12, 12 + dirLen));
  const base = 12 + dirLen;
  const entries = [];
  let p = 12; // decrypted directory starts with a 12-byte copy of the header
  while (p < dir.length) {
    const nl = dir.readUInt16LE(p); p += 2;
    const name = dir.toString('utf8', p, p + nl); p += nl;
    const e = { name, alg: dir[p], flag: dir[p + 1], raw: dir.readUInt32LE(p + 2), off: dir.readUInt32LE(p + 6), size: dir.readUInt32LE(p + 10) };
    p += 14;
    if (base + e.off + e.size > buf.length) throw new TransientError(`Slot ${name} dosya sonunu aşıyor`);
    entries.push(e);
  }
  return { entries, slotBlock: (e) => openBlock(key, buf.subarray(base + e.off, base + e.off + e.size)) };
}

// Decompress the given entries via the PowerShell Oodle helper. Temp files are removed afterwards.
function decompress(container, entries, oodleDll) {
  const out = {};
  const need = [];
  for (const e of entries) {
    const plain = container.slotBlock(e);
    if (e.alg === 0) out[e.name] = plain;
    else if (e.alg === 2) need.push({ e, plain });
    else throw new Error(`Slot ${e.name}: bilinmeyen sıkıştırma ${e.alg}`);
  }
  if (need.length === 0) return out;
  if (!oodleDll || !fs.existsSync(oodleDll)) throw new Error(`Oodle DLL bulunamadı: ${oodleDll}. --oodle ile oo2core_*_win64.dll yolunu ver.`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbz-tracker-'));
  try {
    const idx = need.map(({ e }, i) => ({ file: `${i}.cmp`, out: `${i}.bin`, raw: e.raw }));
    need.forEach(({ plain }, i) => fs.writeFileSync(path.join(dir, `${i}.cmp`), plain));
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(idx));
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(__dirname, 'oodle.ps1'), '-Dir', dir, '-Dll', oodleDll], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      throw new Error(`Oodle çözme hatası: ${(err.stderr || '').toString().trim() || err.message}`);
    }
    need.forEach(({ e }, i) => { out[e.name] = fs.readFileSync(path.join(dir, `${i}.bin`)); });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

function parseJson(name, buf) {
  let s = buf.toString('utf8');
  s = s.replace(/^\uFEFF/, '').replace(/\0+$/, '');
  try { return JSON.parse(s); } catch (e) { throw new Error(`Slot ${name} JSON değil: ${e.message}`); }
}

// "2026.11.05-03.37.12" style strings sort lexicographically; normalise digits only to be safe.
const dtKey = (s) => (s || '').replace(/\D/g, '');

async function loadSave({ savePath, key, oodleDll, retries = 6, delayMs = 750 }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { buf, mtime } = snapshot(savePath);
      const c = parseContainer(buf, key);
      const gameSlots = c.entries.filter((e) => /^(AutoSave|ManualSave)\d+$/.test(e.name));
      const extra = c.entries.filter((e) => e.name === '__Achievements__');
      if (gameSlots.length === 0) throw new Error('Save içinde AutoSave/ManualSave slotu yok');
      const raw = decompress(c, [...gameSlots, ...extra], oodleDll);
      const slots = gameSlots.map((e) => {
        const data = parseJson(e.name, raw[e.name]);
        return { name: e.name, dateTime: data?.PBZGameSystem?.DateTimeString || '', data };
      });
      // Newest DateTimeString first; ties (the game often writes two identical slots) → more play time, then name.
      const playTime = (s) => s.data?.PBZGameSystem?.HasGameTime || 0;
      slots.sort((a, b) => dtKey(b.dateTime).localeCompare(dtKey(a.dateTime)) || playTime(b) - playTime(a) || a.name.localeCompare(b.name));
      const achievements = raw.__Achievements__ ? parseJson('__Achievements__', raw.__Achievements__) : null;
      return { mtime, slots, latest: slots[0], achievements, entries: c.entries };
    } catch (e) {
      lastErr = e;
      if (!(e instanceof TransientError) || attempt === retries) break;
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

module.exports = { loadSave, TransientError };
