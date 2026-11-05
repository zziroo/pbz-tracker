'use strict';
// Rule engine (three-valued: true / false / null = unknown) and the layered, spoiler-safe report.
//   Layer 1 (always): actionable warnings only — cutoffs ahead with something still open.
//   Layer 2 (hidden, --show / G): journal status, step counters, missed items, true-ending tally.
//   Layer 3 (never): anything the save does not show the player has reached.
// No Node built-ins: also used by the browser build.
const { t, pick } = require('./i18n');
// The condition keys makeEval understands (one list, also used by lib/rules-schema.js at load time).
const { CONDITION_KEYS } = require('./conditions');

// Last path segment, either slash style, trailing separators ignored (like path.win32.basename).
const basename = (p) => String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop();

const SIDE_FOLDERS = new Set(['Branch', 'Simple', 'Collect']);
const FAILED = new Set(['Failed', 'Failure', 'Fail']);

// Keep the branches below in step with CONDITION_KEYS (lib/conditions.js).
function makeEval(st, rules) {
  const bossKeys = (name) => rules.bosses?.[name]?.keys || [name];
  const ev = (c) => {
    if (c == null) return null;
    if (c.any) { const v = c.any.map(ev); return v.includes(true) ? true : v.every((x) => x === false) ? false : null; }
    if (c.all) { const v = c.all.map(ev); return v.includes(false) ? false : v.every((x) => x === true) ? true : null; }
    if ('not' in c) { const v = ev(c.not); return v == null ? null : !v; }
    if ('unknown' in c) return null;
    if (c.mapUnlocked) return st.maps.has(c.mapUnlocked);
    if (c.levelVisited) return st.levels.has(c.levelVisited.toLowerCase());
    if (c.currentLevel) return st.currentLevel.toLowerCase() === c.currentLevel.toLowerCase();
    if (c.bellPrefix) return [...st.bells].some((b) => b.startsWith(`Bell_${c.bellPrefix}`));
    if (c.bossKilled) return bossKeys(c.bossKilled).some((k) => (st.bosses.get(k)?.kills || 0) > 0);
    if (c.bossSeen) return bossKeys(c.bossSeen).some((k) => (st.bosses.get(k)?.attempts || 0) > 0);
    if (c.questSeen) return st.quests.has(c.questSeen);
    if (c.questDone) return st.quests.get(c.questDone)?.completion === 'Succeded';
    if (c.questBranch) {
      const q = st.quests.get(c.questBranch);
      return !!q && q.branches[c.branch] === (c.state || 'Completed');
    }
    throw new Error(`rules.json: unknown condition ${JSON.stringify(c)}`);
  };
  return ev;
}

// Status of one quest against an optional cutoff.
function judge({ st, ev, questId, doneWhen, failedWhen, cutoff, unmappedSide, detect = true }) {
  const q = questId ? st.quests.get(questId) : null;
  const cut = cutoff ? ev(cutoff.passedWhen) : null;
  if (!detect) return cut === true ? { status: 'unknown', q, note: t('note.undetectable') } : { status: 'notStarted', q };
  if (q?.completion === 'Succeded' || ev(doneWhen) === true) return { status: 'done', q };
  if ((q && FAILED.has(q.completion)) || ev(failedWhen) === true) return { status: 'missed', q, note: t('note.failed') };
  if (q && q.completion !== 'Started') return { status: 'unknown', q, note: q.completion || '?' };
  if (cut === true) {
    if (q) return { status: 'missed', q, note: t('note.unfinished') };
    if (!questId && unmappedSide.length > 0) return { status: 'unknown', q, note: t('note.unmatched') };
    return { status: 'missed', q, note: t('note.neverStarted') };
  }
  if (q) return { status: 'open', q };
  if (!questId && unmappedSide.length > 0) return { status: 'unknown', q };
  return { status: 'notStarted', q };
}

// Cutoff text for the default view. Exact mode (opt-in setting) names places and bosses, but only for a
// cutoff whose `exactWhen` condition is true (the player has reached that area); otherwise the vague `where`.
function whereText(cutoff, ev, exact) {
  if (exact && cutoff?.whereExact && ev(cutoff.exactWhen) === true) {
    const named = pick(cutoff.whereExact);
    if (named) return named; // an empty exact text never replaces the vague one
  }
  return pick(cutoff?.where);
}

// Quest folders that count as "real" quests for the diagnostics (tutorial entries are never in the name table).
const QUEST_FOLDERS = new Set(['Main', ...SIDE_FOLDERS]);

/**
 * opts.exact: name places and bosses in the warnings (see whereText). Off by default.
 * result.unmatched / result.undetectable: diagnostics only (never rendered in the report).
 */
function build(st, rules, names, { exact = false } = {}) {
  const ev = makeEval(st, rules);
  const qname = (id) => names.quest(id) || id;
  const unmappedSide = [...st.quests.values()].filter((q) => SIDE_FOLDERS.has(q.folder) && !names.known(q.id));
  const warnings = new Map(); // cutoffId → { where, named:[], hints:Set, unnamed:n }
  const closed = [], infoNow = [], infoLater = [];
  const covered = new Set();
  const undetectable = [];

  const warnFor = (cid) => {
    if (!warnings.has(cid)) warnings.set(cid, { where: whereText(rules.cutoffs[cid], ev, exact), named: [], hints: new Set(), unnamed: 0, tales: 0 });
    return warnings.get(cid);
  };

  for (const m of rules.missables || []) {
    const seen = !!(m.quest && st.quests.has(m.quest));
    if (!(ev(m.visibleWhen) === true || seen)) continue; // layer 3: never shown
    if (m.quest) covered.add(m.quest);
    const record = m.type !== 'info' && (m.detect === false || !m.quest)
      ? { id: m.id, cutoff: m.cutoff || null, reason: m.detect === false ? 'detectFalse' : 'noQuestId' } : null;
    if (record) undetectable.push(record);
    const display = (m.quest ? qname(m.quest) : (names.missable(m.id) || pick(m.names))) + (m.suffix ? ` — ${pick(m.suffix)}` : '') + (m.guess ? '*' : '');
    // unverified rules never produce a default-view warning; they appear only in the hidden layer, marked.
    const unv = m.unverified ? t('note.unverified') : null;
    if (m.type === 'info') {
      const named = pick(m.warnNamed) || pick(m.warn);
      // Exact mode: a default-view info warning uses its named text only when the rule says the area is
      // reached (its own exactWhen is true); rules without exactWhen keep the anonymous text.
      const exactInfo = exact && m.exactWhen && pick(m.warnNamed) && ev(m.exactWhen) === true;
      (ev(m.activeWhen) === true && !m.unverified ? infoNow : infoLater)
        .push({ key: m.id, name: display, warn: exactInfo ? named : pick(m.warn), warnNamed: unv ? `${named} (${unv})` : named });
      continue;
    }
    const cutoff = rules.cutoffs?.[m.cutoff];
    const r = judge({ st, ev, questId: m.quest, doneWhen: m.doneWhen, failedWhen: m.failedWhen, cutoff, unmappedSide, detect: m.detect !== false });
    const passed = cutoff ? ev(cutoff.passedWhen) : null;
    // inSave / guess: only for the page's per-row blur (lib/viewmodel.js); the terminal report ignores them.
    const item = { key: m.id, status: r.status, name: display, note: [r.note, unv].filter(Boolean).join(' · ') || undefined, progress: r.q?.progress, warn: pick(m.warn), inSave: !!r.q && (r.q.completion === 'Started' || r.q.completion === 'Succeded' || FAILED.has(r.q.completion)), guess: !!m.guess };
    if (record) record.status = r.status;
    if (passed !== true && !m.unverified && ['open', 'notStarted', 'unknown'].includes(r.status)) {
      const w = warnFor(m.cutoff);
      if (r.status === 'open') w.named.push(item);
      else if (m.hintNotStarted) w.hints.add(pick(m.hintNotStarted));
      else w.unnamed++;
    }
    if (passed === true && r.status === 'missed') item.note = [item.note, t('note.passed', { c: pick(cutoff.label) })].filter(Boolean).join(' · ');
    closed.push(item);
  }

  // True ending: the explicit list of purple quests. Entries without a known pinyin id, or not yet
  // in the save, are never shown (layer 3).
  const te = rules.trueEnding;
  const tales = [];
  if (te) {
    const cutoff = rules.cutoffs?.[te.cutoff];
    const named = new Set((warnings.get(te.cutoff)?.named || []).map((i) => i.key));
    for (const entry of te.quests || []) {
      const q = entry.quest ? st.quests.get(entry.quest) : null;
      if (!q) continue;
      covered.add(q.id);
      const r = judge({ st, ev, questId: q.id, cutoff, unmappedSide });
      tales.push({ key: `tale:${q.id}`, status: r.status, name: qname(q.id), note: r.note, progress: q.progress, inSave: true, guess: !!entry.guess });
      const isNamedMissable = (rules.missables || []).some((m) => m.quest === q.id && named.has(m.id));
      if (r.status === 'open' && ev(cutoff?.passedWhen) !== true && !isNamedMissable) warnFor(te.cutoff).tales++;
    }
  }

  const others = [];
  for (const q of st.quests.values()) {
    if (!SIDE_FOLDERS.has(q.folder) || covered.has(q.id)) continue;
    const r = judge({ st, ev, questId: q.id, unmappedSide });
    others.push({ key: `side:${q.id}`, status: r.status, name: qname(q.id), progress: q.progress, note: r.note, inSave: true, guess: false });
  }

  // Quests in the save that the name table / key map does not know (a new side quest after a game update…).
  const unmatched = [...st.quests.values()].filter((q) => QUEST_FOLDERS.has(q.folder) && !names.known(q.id))
    .map((q) => ({ id: q.id, folder: q.folder, completion: q.completion || null }));

  return { warnings: [...warnings.values()], closed, tales, others, infoNow, infoLater, unmappedSide: unmappedSide.map((q) => q.id), unmatched, undetectable };
}

// ---------- rendering ----------

function colorizer(enabled) {
  const wrap = (code) => (s) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : s);
  return { red: wrap('31'), yellow: wrap('33'), green: wrap('32'), grey: wrap('90'), bold: wrap('1'), cyan: wrap('36') };
}

const ORDER = { missed: 0, open: 1, notStarted: 2, unknown: 3, done: 4 };
const byStatus = (a, b) => ORDER[a.status] - ORDER[b.status];

function fmtTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

// "2026.11.05-03.37.44" → "05.11.2026 03:37"
const fmtSaveTime = (s) => s.replace(/^(\d+)\.(\d+)\.(\d+)-(\d+)\.(\d+).*$/, '$3.$2.$1 $4:$5');

// Header line for the game build → { text, untested }.
function buildLine(build) {
  if (!build.id) return { text: t('build.unknown'), untested: false };
  if (build.tested) return { text: t('build.tested', { build: build.id }), untested: false };
  return { text: t('build.untested', { build: build.id }), untested: true };
}

// Header line for the rules / name-table source.
function dataLine(data) {
  const r = data.rules;
  const file = r.file ? basename(r.file) : '';
  const parts = [t(`rules.${r.source}`, { file, v: r.rules.rulesVersion })];
  if (data.nameFiles.length) parts.push(t('names.sidecar', { files: data.nameFiles.join(', ') }));
  return parts.join(' · ');
}

// Layer-1 warnings that have something to say.
const activeWarnings = (result) => result.warnings.filter((w) => w.named.length || w.hints.size || w.unnamed || w.tales);

function render({ st, result, names, build, data, color, show, changes, hiddenKey }) {
  const c = colorizer(color);
  const tag = (s) => {
    const label = `[${t(`st.${s}`)}]`.padEnd(14);
    return { missed: c.red, open: c.yellow, notStarted: c.yellow, done: c.green, unknown: c.grey }[s](label);
  };
  const line = (it) => {
    let s = `  ${tag(it.status)} ${it.name}`;
    if (it.progress && it.status !== 'done') s += c.grey(`  (${t('progress', { d: it.progress.done, t: it.progress.total })})`);
    if (it.note) s += c.grey(`  — ${it.note}`);
    return s;
  };
  const out = [];
  out.push(c.bold(t('title')));
  const loc = names.region(st.currentLevel);
  out.push(c.grey(t('header', { time: fmtSaveTime(st.dateTime), play: fmtTime(st.playSeconds) })
    + (loc ? ` · ${t('location', { loc })}` : '')));
  if (build) {
    const b = buildLine(build);
    out.push((b.untested ? c.yellow : c.grey)(b.text));
  }
  if (data) out.push(c.grey(dataLine(data)));
  if (names.notice) out.push(c.grey(names.notice));
  out.push('');

  // Layer 1
  const warns = activeWarnings(result);
  if (warns.length === 0 && result.infoNow.length === 0) {
    out.push(c.green(t('noRisk')));
  } else {
    out.push(c.bold(c.yellow(t('warnTitle'))));
    for (const w of warns) {
      out.push(`  ${c.yellow('▶')} ${w.where}:`);
      for (const it of w.named) out.push(`      • ${it.name}${it.warn ? c.grey(` — ${it.warn}`) : ''}`);
      for (const h of w.hints) out.push(`      • ${h}`);
      if (w.unnamed) out.push(`      • ${t('notStartedHint', { n: w.unnamed })}`);
      if (w.tales) out.push(`      • ${t('talesOpen', { n: w.tales })}`);
    }
    for (const i of result.infoNow) out.push(`  ${c.cyan('▶')} ${i.warn}`);
  }

  // Layer 2
  out.push('');
  if (!show) {
    out.push(c.grey(`${t('sec.journal')} ${t(hiddenKey ? 'hiddenHintKey' : 'hiddenHintFlag')}`));
    return out.join('\n');
  }
  if (changes && changes.length) {
    out.push(c.bold(t('sec.changes')));
    for (const ch of changes) out.push(`  • ${ch}`);
    out.push('');
  }
  out.push(c.bold(t('sec.journal')));
  if (result.closed.length) {
    out.push(c.bold(` ${t('sec.closed')}`));
    for (const it of [...result.closed].sort(byStatus)) out.push(line(it));
  }
  if (result.tales.length) {
    const done = result.tales.filter((x) => x.status === 'done').length;
    out.push(c.bold(` ${t('sec.tales', { found: result.tales.length, done })}`));
    for (const it of [...result.tales].sort(byStatus)) out.push(line(it));
  }
  if (result.others.length) {
    out.push(c.bold(` ${t('sec.other')}`));
    for (const it of [...result.others].sort(byStatus)) out.push(line(it));
  }
  const info = [...result.infoNow, ...result.infoLater];
  if (info.length) {
    out.push(c.bold(` ${t('sec.info')}`));
    for (const i of info) out.push(`  ${c.cyan(`[${t('st.info')}]`.padEnd(14))} ${i.warnNamed}`);
  }
  out.push('');
  out.push(c.grey(t('guessLegend')));
  return out.join('\n');
}

// Flat status map for change detection in watch mode (shown only in layer 2).
function statusMap(result) {
  const m = new Map();
  for (const it of [...result.closed, ...result.tales, ...result.others]) {
    m.set(it.key, { name: it.name, status: it.status, progress: it.progress ? `${it.progress.done}/${it.progress.total}` : '' });
  }
  return m;
}

function diff(prev, next) {
  if (!prev) return [];
  const out = [];
  for (const [k, v] of next) {
    const p = prev.get(k);
    if (!p) out.push(t('chg.new', { n: v.name, s: t(`st.${v.status}`) }));
    else if (p.status !== v.status) out.push(t('chg.status', { n: v.name, a: t(`st.${p.status}`), b: t(`st.${v.status}`) }));
    else if (p.progress !== v.progress && v.progress) out.push(t('chg.progress', { n: v.name, a: p.progress || '-', b: v.progress }));
  }
  return out;
}

module.exports = { build, makeEval, whereText, CONDITION_KEYS, render, statusMap, diff, byStatus, fmtTime, fmtSaveTime, buildLine, dataLine, activeWarnings };
