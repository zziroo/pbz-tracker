'use strict';
// Turns a build() result into the `State` JSON of docs/ui-api.md, in the current UI language.
// Same texts and layers as the terminal report (lib/report.js render):
//   layer 1 → warnings / info / noRisk (always visible in the page),
//   layer 2 → journal (blurred in the page; per row part, see row() below).
// Layer 3 never reaches this module: build() already drops everything the save has not shown.
const i18n = require('./i18n');
const { t } = i18n;
const { byStatus, fmtTime, fmtSaveTime, buildLine, dataLine, activeWarnings, regionLine, groupTitle, stakeLabels, cycleText } = require('./report');
const { completion, reached, CATEGORIES, CHALLENGES } = require('./completion');
const { titleCaseTr } = require('./core/names');
const MAP_TABLE = require('./map-table');

function header({ st, names, build, data }) {
  const notices = [];
  if (data) notices.push(dataLine(data));
  if (names.notice) notices.push(names.notice);
  const loc = regionLine(st, names);
  return {
    saveTime: fmtSaveTime(st.dateTime),
    playTime: fmtTime(st.playSeconds),
    cycle: cycleText(st),
    location: loc ? loc.loc : null,
    locationNote: loc ? loc.src : null,
    build: { id: build?.id || null, tested: !!build?.tested, text: build ? buildLine(build).text : t('build.unknown') },
    notices,
  };
}

// stakes: the "what you lose" labels of a default-view item ({ id, text }, lib/report.js stakeLabels); the purple-quest
// count has none (its text says it is about the true ending).
const warningRow = (w) => {
  const items = [];
  for (const it of w.named) items.push({ text: it.name, note: it.warn || null, hint: it.hint || null, stakes: stakeLabels(it.stakes) });
  for (const h of w.hints) items.push({ text: h, note: null, stakes: stakeLabels(w.hintStakes && w.hintStakes.get(h)) });
  if (w.unnamed) items.push({ text: t('notStartedHint', { n: w.unnamed }), note: null, stakes: stakeLabels(w.unnamedStakes && [...w.unnamedStakes]) });
  if (w.tales) items.push({ text: t(w.tales === 1 ? 'talesOpen.one' : 'talesOpen', { n: w.tales }), note: null, stakes: [] });
  return { where: w.where, items };
};

// info stays string[] (docs/ui-api.md); infoStakes holds the labels of info[i] at the same index.
function layer1(result) {
  const warnings = activeWarnings(result).map(warningRow);
  const info = result.infoNow.map((i) => i.warn);
  const infoStakes = result.infoNow.map((i) => stakeLabels(i.stakes));
  // The same items grouped by game region (lib/report.js build → groups), heading text included.
  const groups = (result.groups || []).filter((g) => g.warnings.length || g.info.length)
    .map((g) => ({ region: { ...g.region }, title: groupTitle(g), warnings: g.warnings.map(warningRow), info: g.info.map((i) => i.warn), infoStakes: g.info.map((i) => stakeLabels(i.stakes)) }));
  return { noRisk: warnings.length === 0 && info.length === 0, warnings, info, infoStakes, groups };
}

// A row is "in the journal" when its quest is in the save (Started / Succeded / Failed → open / done /
// missed) and the rule is not a guess: the player has met it, so its name stays readable in the page.
// A row whose status is "done" is also readable, whatever it is (item/step rules, guesses): the player has
// already done it. Everything else (not started, unknown, guesses, item rules without a quest) is blurred as a
// whole. Step counters and notes are blurred (detailBlur) while a row is still open: they can tell what is
// still to come. Finished rows (done / missed) are readable as a whole, details included: nothing is left to spoil.
const IN_JOURNAL = new Set(['open', 'done', 'missed']);
const FINISHED = new Set(['done', 'missed']);
// Open guess rules (*) stay blurred: their status is inferred and their names can be spoilery.
const inJournal = (it) => FINISHED.has(it.status) || (!!it.inSave && !it.guess && IN_JOURNAL.has(it.status));

const ROW_KINDS = new Set(['quest', 'item', 'accessory', 'flower', 'chest', 'weapon']);
const row = (it) => ({
  name: it.name,
  kind: ROW_KINDS.has(it.kind) ? it.kind : 'quest', // what the row is about (lib/report.js kindOf): the page's row icon
  status: it.status,
  statusText: t(`st.${it.status}`),
  progress: it.progress && it.status !== 'done' ? t('progress', { d: it.progress.done, t: it.progress.total }) : null,
  note: it.note || null,
  nameBlur: !inJournal(it),
  detailBlur: !FINISHED.has(it.status),
});

function journal(result, changes) {
  const sections = [];
  if (result.closed.length) sections.push({ title: t('sec.closed'), rows: [...result.closed].sort(byStatus).map(row) });
  if (result.tales.length) {
    const done = result.tales.filter((x) => x.status === 'done').length;
    sections.push({ title: t('sec.tales', { found: result.tales.length, done }), rows: [...result.tales].sort(byStatus).map(row) });
  }
  if (result.others.length) sections.push({ title: t('sec.other'), rows: [...result.others].sort(byStatus).map(row) });
  return {
    sections,
    info: [...result.infoNow, ...result.infoLater].map((i) => i.warnNamed),
    changes: changes || [],
    legend: t('guessLegend'),
  };
}

const emptyJournal = () => ({ sections: [], info: [], changes: [], legend: t('guessLegend') });

/**
 * view: { st, result, names, build, data, changes } of the last good read, or null if nothing was read.
 * ok/error: error is a localized one-liner (null when ok).
 */
function toState({ ok, error, readAt, view }) {
  const base = { ok: !!ok, error: error || null, readAt: readAt || null, ui: { lang: i18n.getLang() } };
  if (!view) {
    return { ...base, header: null, noRisk: false, noRiskText: t('noRisk'), warnings: [], info: [], infoStakes: [], groups: [], mapLocks: [], maps: [], journal: emptyJournal() };
  }
  const l1 = layer1(view.result);
  return {
    ...base,
    header: header(view),
    noRisk: l1.noRisk,
    noRiskText: t('noRisk'),
    warnings: l1.warnings,
    info: l1.info,
    infoStakes: l1.infoStakes,
    groups: l1.groups,
    mapLocks: mapLocks(view.result),
    maps: maps(view),
    journal: journal(view.result, view.changes),
  };
}

// Map completion per region map (lib/completion.js, the game's own count), for the Maps tab. Spoiler policy: only
// groups the player has reached are listed at all (lib/completion.js reached: map unlocked, a bell of it used, or the
// header's region map); the missing entries are blurred in the page (the row says what kind of thing it is, the
// name is revealed on click); the nearest bell is named only in exact mode (view.exact), like places in the warnings.
// Names: the player's text patch when it has the key (names.text), else the embedded table in the UI language.
const allCaps = (s) => typeof s === 'string' && s.trim() !== '' && s === s.toUpperCase() && s !== s.toLowerCase();
const titleCaseEn = (s) => (allCaps(s) ? s.toLowerCase().replace(/(^|[\s\-(["'])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : s);
function maps(view) {
  const { st, names } = view;
  if (!st) return [];
  const lang = i18n.getLang();
  const text = (n, code) => {
    if (!n) return code || null;
    const patch = names && typeof names.text === 'function' && n.key ? names.text(n.key) : null;
    if (patch) return titleCaseTr(patch);
    if (lang === 'tr' && n.tr) return titleCaseTr(n.tr);
    return n.en ? titleCaseEn(n.en) : n.tr ? titleCaseTr(n.tr) : code || null;
  };
  const itemText = (it) => {
    if (it.cat === 'challenge') return t(CHALLENGES.includes(it.det && it.det.kind) ? `maps.item.challenge.${it.det.kind}` : 'maps.cat.challenge');
    if (it.cat === 'amber' || it.cat === 'blackstone') return t(`maps.item.${it.cat}`);
    return text(it.name, it.code) || t(`maps.cat.${it.cat}`);
  };
  const out = [];
  for (const g of completion(st, MAP_TABLE)) {
    if (!reached(st, g)) continue; // never list an unreached map (its name alone is a spoiler)
    let name = null;
    for (const m of g.maps) if ((name = names && typeof names.region === 'function' ? names.region(m) : null)) break;
    const categories = CATEGORIES.filter((c) => g.categories[c] && g.categories[c][1] > 0)
      .map((c) => ({ cat: c, label: t(`maps.cat.${c}`), done: g.categories[c][0], total: g.categories[c][1] }));
    const missing = g.items.filter((it) => !it.done).map((it) => ({
      cat: it.cat,
      text: itemText(it),
      bell: view.exact && it.bell && it.cat !== 'bell' ? text(MAP_TABLE.bellNames[it.bell], it.bell) : null, // a bell is its own place
    }));
    out.push({ id: g.id, name: name || text(g.name, g.maps[0]), percent: g.percent, current: g.current, total: g.total, categories, missing, note: t('maps.note') });
  }
  return out;
}

// Map locks still closed in reached regions (lib/report.js mapLocksOf, via build): the same localized texts as
// the terminal block, one entry per region. Always visible in the page (reached regions only, no ids).
function mapLocks(result) {
  return (Array.isArray(result.mapLocks) ? result.mapLocks : [])
    .map((r) => ({ region: r.region, items: r.items.map(({ type, need, needKind, text }) => ({ type, need, needKind, text })) }));
}

module.exports = { toState };
