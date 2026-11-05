'use strict';
// Tiny key/value store for the web version: IndexedDB database "pbz-tracker", object store "kv".
// Holds the settings, the chosen file-system handles and the derived key cache, in this browser only.
// When IndexedDB is unavailable (private windows in some browsers) or a value cannot be stored (e.g. a
// handle that is not cloneable), it falls back to memory for this visit; it never throws.
//   get(key) → value | undefined;  set(key, value) → boolean (true = persisted);  del(key);  clear()
const DB = 'pbz-tracker';
const STORE = 'kv';
const mem = new Map();
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      let req;
      try { req = globalThis.indexedDB.open(DB, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    dbp.catch(() => {});
  }
  return dbp;
}

function run(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  }));
}

// This visit's values win (they include values that could not be persisted); IndexedDB fills in the rest.
async function get(key) {
  if (mem.has(key)) return mem.get(key);
  try {
    const v = await run('readonly', (s) => s.get(key));
    if (v !== undefined) mem.set(key, v);
    return v;
  } catch { return undefined; }
}

async function set(key, value) {
  mem.set(key, value);
  try { await run('readwrite', (s) => s.put(value, key)); return true; } catch {
    try { await run('readwrite', (s) => s.delete(key)); } catch { /* no stale copy left behind if possible */ }
    return false;
  }
}

async function del(key) {
  mem.delete(key);
  try { await run('readwrite', (s) => s.delete(key)); } catch { /* memory only */ }
}

async function clear() {
  mem.clear();
  try { await run('readwrite', (s) => s.clear()); } catch { /* memory only */ }
}

module.exports = { get, set, del, clear };
