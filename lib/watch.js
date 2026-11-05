'use strict';
// Watches the save file and re-reads it when it changes. Used by the terminal watch mode (pbz.js --watch).
//   - fs.watch on the save folder (debounced: every event restarts the 1.5 s timer), plus
//   - a poll every `interval` seconds as a fallback (it never reschedules a pending timer).
// Change detection compares the save's mtime:size with the signature of the bytes actually decoded
// (lastSig), so a read that raced with the game's write is retried. A failed read is retried only when
// the file changes again.
const fs = require('fs');
const path = require('path');

const DEBOUNCE_MS = 1500;

/**
 * read():      async → { sig, ... }   (decode the save)
 * onRead(r):   called after every successful read
 * onError(e):  called after a failed read
 * Returns { start(): Promise (first read, then watching), setInterval(sec), refresh(), close() }.
 */
function watchSave({ savePath, interval, read, onRead, onError }) {
  let have = false, lastSig = '', busy = false, pending = false, timer = null, poll = null, watcher = null, closed = false;
  const sig = () => { try { const s = fs.statSync(savePath); return `${s.mtimeMs}:${s.size}`; } catch { return ''; } };

  const refresh = async () => {
    timer = null;
    if (closed) return;
    if (busy) { pending = true; return; }
    const before = sig();
    if (have && before === lastSig) return; // already showing these bytes
    busy = true;
    try {
      const r = await read();
      if (closed) return;
      have = true;
      lastSig = r.sig;              // signature of the bytes actually decoded
      onRead(r);
    } catch (e) {
      lastSig = before;             // retry only when the file changes again
      if (!closed) onError(e);
    } finally {
      busy = false;
      if (!closed && (pending || sig() !== lastSig)) { pending = false; schedule(); }
    }
  };
  const schedule = () => { if (closed) return; clearTimeout(timer); timer = setTimeout(refresh, DEBOUNCE_MS); };
  const startPoll = (sec) => {
    clearInterval(poll);
    poll = setInterval(() => { if (!busy && !timer && sig() !== lastSig) schedule(); }, sec * 1000);
  };

  return {
    async start() {
      await refresh();
      if (closed) return;
      const base = path.basename(savePath).toLowerCase();
      try {
        watcher = fs.watch(path.dirname(savePath), (ev, file) => { if (!file || file.toLowerCase() === base) schedule(); });
        watcher.on('error', () => { /* folder vanished: polling keeps working */ });
      } catch { /* polling below still works */ }
      startPoll(interval);
    },
    setInterval(sec) { interval = sec; if (poll) startPoll(sec); },
    // Force a re-read even if the file did not change.
    refresh() { have = false; schedule(); },
    close() {
      closed = true;
      clearTimeout(timer); clearInterval(poll);
      try { watcher?.close(); } catch { /* ignore */ }
    },
  };
}

module.exports = { watchSave, DEBOUNCE_MS };
