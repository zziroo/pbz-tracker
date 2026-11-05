'use strict';
// Local timeline of quest state transitions, for checking the rules after a playthrough. Pure (no Node
// built-ins): the storage is passed in; the web version (web/transport.js) keeps it in IndexedDB.
//
// Every successful save read is compared with the last stored snapshot of the quests; quests that
// appeared or changed (completion, a branch state, the step counter) become records:
//   { t: <save DateTimeString>, readAt: <ISO>, questId, folder, from: <completion|null>, to: <completion>,
//     branches: { <changed branch id>: <new type> }, progress: "d/t" | null, level: <CurrentLevelName code> }
// A quest that is no longer in the save (e.g. an older save was loaded) gets one record with to: null.
// The snapshot is stored with the records, so a restart does not log everything again. At most CAP
// records are kept (the oldest are dropped). Failures never reach the caller: record() resolves to []
// and the first failure is reported once through warn(); a stored file that cannot be parsed is never
// overwritten (the timeline stays off for this run).
//
//   createTimeline({ load, save, remove?, warn?, cap? }) → { record(st, readAt), count(), records(), status(), clear() }
//     load(): → stored object | null (nothing stored yet); may throw / reject
//     save(data): persists { version, snapshot, records }; may throw / reject
//     remove(): deletes the stored timeline (clear() rejects if it fails)
//   snapshotOf(st), diffSnapshots(prev, next, meta), exportTimeline(records, version, exportedAt)

const CAP = 2000;
const FORMAT = 1;

const progressText = (p) => (p && Number.isFinite(p.done) && Number.isFinite(p.total) ? `${p.done}/${p.total}` : null);

// { questId: { folder, completion, branches, progress } } of an extract() result.
function snapshotOf(st) {
  const out = {};
  for (const q of st.quests.values()) {
    out[q.id] = { folder: q.folder, completion: q.completion || null, branches: { ...q.branches }, progress: progressText(q.progress) };
  }
  return out;
}

function diffSnapshots(prev, next, { t, readAt, level }) {
  const recs = [];
  for (const [id, q] of Object.entries(next)) {
    const p = prev && Object.prototype.hasOwnProperty.call(prev, id) ? prev[id] : null;
    const branches = {};
    for (const [b, type] of Object.entries(q.branches || {})) if (!p || !p.branches || p.branches[b] !== type) branches[b] = type;
    const changed = !p || p.completion !== q.completion || p.progress !== q.progress || Object.keys(branches).length > 0;
    if (!changed) continue;
    recs.push({ t, readAt, questId: id, folder: q.folder, from: p ? p.completion : null, to: q.completion, branches, progress: q.progress, level });
  }
  // Gone from the save: one record with to: null.
  for (const [id, p] of Object.entries(prev || {})) {
    if (Object.prototype.hasOwnProperty.call(next, id)) continue;
    recs.push({ t, readAt, questId: id, folder: p.folder, from: p.completion, to: null, branches: {}, progress: null, level });
  }
  return recs;
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function normalize(d, cap) {
  if (d == null) return { version: FORMAT, snapshot: null, records: [] };
  if (!isObj(d) || !Array.isArray(d.records) || (d.snapshot != null && !isObj(d.snapshot))) throw new Error('timeline file has an unknown shape');
  return { version: FORMAT, snapshot: d.snapshot || null, records: d.records.length > cap ? d.records.slice(-cap) : d.records };
}

const errCode = (e) => String((e && (e.code || e.name)) || 'error');

function createTimeline({ load, save, remove = async () => {}, warn = () => {}, cap = CAP }) {
  let data = null;      // { version, snapshot, records } once loaded
  let broken = null;    // error code of a failed load: never overwrite what could not be read
  let lastError = null; // error code of the last failed save
  let warned = false;
  let chain = Promise.resolve();
  let loaded = null;

  const warnOnce = (e) => { if (!warned) { warned = true; try { warn(e); } catch { /* ignore */ } } };
  const ensure = () => {
    if (!loaded) {
      loaded = Promise.resolve().then(load).then((d) => { data = normalize(d, cap); }, (e) => { broken = errCode(e); warnOnce(e); });
      loaded = loaded.catch((e) => { broken = errCode(e); warnOnce(e); });
    }
    return loaded;
  };

  async function doRecord(st, readAt) {
    await ensure();
    if (broken || !data) return [];
    const snap = snapshotOf(st);
    const recs = diffSnapshots(data.snapshot, snap, { t: st.dateTime || null, readAt, level: st.currentLevel || null });
    if (!recs.length && data.snapshot) return [];
    let records = data.records.concat(recs);
    if (records.length > cap) records = records.slice(-cap);
    data = { version: FORMAT, snapshot: snap, records }; // memory is the source of truth; the next save writes all
    try { await save(data); lastError = null; } catch (e) { lastError = errCode(e); warnOnce(e); }
    return recs;
  }

  return {
    // Never rejects.
    record(st, readAt = new Date().toISOString()) {
      const p = chain.then(() => doRecord(st, readAt)).catch((e) => { lastError = errCode(e); warnOnce(e); return []; });
      chain = p;
      return p;
    },
    async count() { await ensure(); return data ? data.records.length : 0; },
    async records() { await ensure(); return data ? data.records.slice() : []; },
    // { ok, error } — error is a short code (never a message: those may contain paths).
    async status() { await ensure(); return { ok: !broken && !lastError, error: broken || lastError || null }; },
    // Delete the stored timeline and start over (the next read records a fresh baseline). Rejects if
    // remove() fails; the in-memory state is reset only after a successful remove.
    clear() {
      const p = chain.then(async () => {
        await remove();
        data = normalize(null, cap); broken = null; lastError = null; warned = false;
        loaded = Promise.resolve();
      });
      chain = p.catch(() => {});
      return p;
    },
  };
}

// The exported JSON (Diagnostics → Export / Copy timeline in the web version).
function exportTimeline(records, version, exportedAt = new Date().toISOString()) {
  return { tool: 'pbz-tracker', version, format: FORMAT, exportedAt, count: records.length, records };
}

module.exports = { createTimeline, snapshotOf, diffSnapshots, exportTimeline, CAP };
