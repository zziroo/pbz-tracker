'use strict';
// Node wrapper for the PBZS v3 save: read-only in-memory snapshot of the file plus a retry loop while
// the game writes it. Decrypting and decoding is portable and lives in lib/core/container.js.
//   async loadSave({ savePath, key, retries = 6, delayMs = 750 }) → { mtime, sig, slots, latest }
//   TransientError (same class as the core's), sigOf(stat)
const fs = require('fs');
const { decodeSave, TransientError } = require('./core/container');
const { t } = require('./i18n');

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

async function loadSave({ savePath, key, retries = 6, delayMs = 750 }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { buf, mtime, sig } = snapshot(savePath);
      const { slots, latest } = await decodeSave(new Uint8Array(buf.buffer, buf.byteOffset, buf.length), key);
      return { mtime, sig, slots, latest };
    } catch (e) {
      lastErr = e;
      if (!(e instanceof TransientError) || attempt === retries) break;
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

module.exports = { loadSave, TransientError, sigOf };
