'use strict';
// Diagnostics for the Settings tab and for bug reports. Pure (no Node built-ins): the web transport
// (web/transport.js) collects this object and formats this text.
//
// The object and the report carry NO personal data: no paths, no Steam account ids or folder names, no
// user names, no key material, and of the save time only the date (item times are given as an offset
// before the save, never as a time of day). Every free-form value goes through
// safe() (a short token of letters, digits, "._-"; anything else becomes "?"), and file names through
// fileName() (the last path segment only), so a hostile or unexpected value cannot leak a path.
//
//   collectDiagnostics(input) → Diagnostics
//   formatDiagnostics(d) → plain text (English, for a GitHub issue)

const SAFE = /^[A-Za-z0-9_.\-]{1,80}$/;
const safe = (v) => (typeof v === 'string' && SAFE.test(v) ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '?');
const fileName = (p) => safe(String(p == null ? '' : p).replace(/[\\/]+$/, '').split(/[\\/]/).pop());
// "2026.11.05-22.15.21" → "2026-11-05" (the time of day is left out on purpose)
const saveDate = (s) => { const m = /^(\d{4})\.(\d{2})\.(\d{2})/.exec(String(s || '')); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
// "2026.11.05-22.15.21" → ms (the clock fields as UTC: only differences are used) | null
const saveMs = (s) => {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/.exec(String(s || ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
};
const RECENT_WINDOW_S = 24 * 3600;
const RECENT_MAX = 30;
// Items (st.items, lib/state.js) acquired within 24 hours before the save's own timestamp (not the system
// clock; if the save has none, the newest item time), newest first, at most RECENT_MAX:
// [{ code, ago }] with ago = seconds before that reference (negative if after it). Codes only, no names.
function recentItems(st) {
  if (!st || !st.items || typeof st.items.entries !== 'function') return null; // a Map (not instanceof: realms)
  const list = [];
  for (const [code, it] of st.items) { const ms = saveMs(it && it.time); if (ms != null) list.push({ code, ms }); }
  let ref = saveMs(st.dateTime);
  if (ref == null) ref = list.reduce((a, x) => (a == null || x.ms > a ? x.ms : a), null);
  if (ref == null) return [];
  return list.filter((x) => ref - x.ms <= RECENT_WINDOW_S * 1000)
    .sort((a, b) => b.ms - a.ms || (a.code < b.code ? -1 : 1))
    .slice(0, RECENT_MAX)
    .map((x) => ({ code: safe(x.code), ago: Math.round((ref - x.ms) / 1000) }));
}
// 640 → "-0:10:40" (before the save), -5 → "+0:00:05"
const fmtAgo = (s) => {
  const a = Math.abs(s);
  return `${s < 0 ? '+' : '-'}${Math.floor(a / 3600)}:${String(Math.floor((a % 3600) / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
};
const knownCount = (table) => Object.keys((table && table.quests) || {}).filter((k) => !k.startsWith('_')).length;

/**
 * input:
 *   mode: 'web' | 'cli';  version; uiLang; exact: boolean
 *   rules: { version, schemaVersion, source: 'embedded' | 'sidecar' | 'explicit' }
 *   keyMap: data/names.json (only its quest count is used)
 *   namesSource: names.source of lib/core/names.js (a .pak name or a table language) or null
 *   nameFiles: sidecar name-table file names
 *   patches: text patch file names found
 *   build: { id, tested } | null
 *   st, result: the last good read (extract() / build()), or null
 *   ok: last read succeeded
 *   timeline: { enabled, count, error } | null
 * recentItems: see recentItems() (null when nothing was read)
 */
function collectDiagnostics(input) {
  const i = input || {};
  const src = typeof i.namesSource === 'string' ? i.namesSource : null;
  const result = i.result || null;
  const st = i.st || null;
  return {
    tool: { version: safe(i.version), mode: safe(i.mode), uiLang: i.uiLang === 'tr' ? 'tr' : 'en', exact: !!i.exact },
    rules: {
      version: safe(i.rules?.version == null ? '' : String(i.rules.version)),
      schemaVersion: safe(i.rules?.schemaVersion),
      source: ['embedded', 'sidecar', 'explicit'].includes(i.rules?.source) ? i.rules.source : '?',
    },
    names: {
      keyMapQuests: knownCount(i.keyMap),
      source: src == null ? null : /\.pak$/i.test(src) ? 'patch' : 'table',
      sourceName: src == null ? null : fileName(src),
      sidecars: (i.nameFiles || []).map(fileName),
    },
    patches: (i.patches || []).map(fileName),
    build: { id: i.build?.id ? safe(String(i.build.id)) : null, tested: !!i.build?.tested },
    save: {
      read: !!i.ok,
      date: st ? saveDate(st.dateTime) : null,
      level: st && st.currentLevel ? safe(st.currentLevel) : null,  // raw World Partition level name
      map: st && st.region ? safe(st.region.code) : null,             // region map of the header (lib/state.js regionOf)
      quests: st ? st.quests.size : null,
      inventory: st ? !!(st.items && typeof st.items.entries === 'function') : null,  // false: no Inventory tables in the save
    },
    unmatched: (result?.unmatched || []).map((q) => ({ id: safe(q.id), folder: safe(q.folder), completion: q.completion ? safe(q.completion) : null })),
    recentItems: recentItems(st),
    undetectable: (result?.undetectable || []).map((r) => ({ id: safe(r.id), cutoff: r.cutoff ? safe(r.cutoff) : null, reason: safe(r.reason), status: r.status ? safe(r.status) : null })),
    timeline: i.timeline
      ? { enabled: !!i.timeline.enabled, count: Number.isFinite(i.timeline.count) ? i.timeline.count : 0, error: i.timeline.error ? safe(String(i.timeline.error)) : null }
      : null,
  };
}

function formatDiagnostics(d) {
  const L = [];
  L.push('pbz-tracker diagnostics');
  L.push(`tool: ${d.tool.version} (${d.tool.mode}) · UI language: ${d.tool.uiLang} · exact names: ${d.tool.exact ? 'on' : 'off'}`);
  L.push(`rules: ${d.rules.version} (${d.rules.source}) · schema ${d.rules.schemaVersion}`);
  const from = d.names.source === 'patch' ? `patch ${d.names.sourceName}` : d.names.source === 'table' ? `table ${d.names.sourceName}` : 'unknown';
  L.push(`names: key map knows ${d.names.keyMapQuests} quests · names from: ${from}${d.names.sidecars.length ? ` · sidecar tables: ${d.names.sidecars.join(', ')}` : ''}`);
  L.push(`text patch: ${d.patches.length ? d.patches.join(', ') : 'none found'}`);
  L.push(`game build: ${d.build.id ? `${d.build.id}${d.build.tested ? ' (tested)' : ' (not tested)'}` : 'unknown'}`);
  L.push(d.save.read || d.save.date
    ? `save: ${d.save.read ? 'read' : 'last read failed'} · date ${d.save.date || '?'} · level ${d.save.level || '?'} · map ${d.save.map || '?'} · ${d.save.quests ?? '?'} quests`
    : 'save: not read');
  L.push(`unmatched quests (${d.unmatched.length})${d.unmatched.length ? ':' : ': none'}`);
  for (const q of d.unmatched) L.push(`  - ${q.id} (${q.folder}, ${q.completion || '?'})`);
  L.push(`undetectable rules in range for this save (${d.undetectable.length})${d.undetectable.length ? ':' : ': none'}`);
  for (const r of d.undetectable) L.push(`  - ${r.id} (cutoff ${r.cutoff || '-'}, ${r.reason}, ${r.status || '?'})`);
  if (d.recentItems) {
    L.push(`items acquired in the 24 h before the save (${d.recentItems.length}, codes, newest first)${d.recentItems.length ? ':' : ': none'}`);
    for (const x of d.recentItems) L.push(`  - ${x.code}  ${fmtAgo(x.ago)}`);
  } else if (d.save.inventory === false) L.push('items acquired in the 24 h before the save: no Inventory in this save');
  if (d.timeline) L.push(`timeline: ${d.timeline.enabled ? 'on' : 'off'} · ${d.timeline.count} records${d.timeline.error ? ` · error ${d.timeline.error}` : ''}`);
  return `${L.join('\n')}\n`;
}

module.exports = { collectDiagnostics, formatDiagnostics, saveDate, fmtAgo, RECENT_MAX };
