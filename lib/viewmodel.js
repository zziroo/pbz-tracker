'use strict';
// Turns a build() result into the `State` JSON of docs/ui-api.md, in the current UI language.
// Same texts and layers as the terminal report (lib/report.js render):
//   layer 1 → warnings / info / noRisk (always visible in the page),
//   layer 2 → journal (blurred in the page; per row part, see row() below).
// Layer 3 never reaches this module: build() already drops everything the save has not shown.
const i18n = require('./i18n');
const { t } = i18n;
const { byStatus, fmtTime, fmtSaveTime, buildLine, dataLine, activeWarnings, regionLine, groupTitle } = require('./report');

function header({ st, names, build, data }) {
  const notices = [];
  if (data) notices.push(dataLine(data));
  if (names.notice) notices.push(names.notice);
  const loc = regionLine(st, names);
  return {
    saveTime: fmtSaveTime(st.dateTime),
    playTime: fmtTime(st.playSeconds),
    location: loc ? loc.loc : null,
    locationNote: loc ? loc.src : null,
    build: { id: build?.id || null, tested: !!build?.tested, text: build ? buildLine(build).text : t('build.unknown') },
    notices,
  };
}

const warningRow = (w) => {
  const items = [];
  for (const it of w.named) items.push({ text: it.name, note: it.warn || null, hint: it.hint || null });
  for (const h of w.hints) items.push({ text: h, note: null });
  if (w.unnamed) items.push({ text: t('notStartedHint', { n: w.unnamed }), note: null });
  if (w.tales) items.push({ text: t('talesOpen', { n: w.tales }), note: null });
  return { where: w.where, items };
};

function layer1(result) {
  const warnings = activeWarnings(result).map(warningRow);
  const info = result.infoNow.map((i) => i.warn);
  // The same items grouped by game region (lib/report.js build → groups), heading text included.
  const groups = (result.groups || []).filter((g) => g.warnings.length || g.info.length)
    .map((g) => ({ region: { ...g.region }, title: groupTitle(g), warnings: g.warnings.map(warningRow), info: g.info.map((i) => i.warn) }));
  return { noRisk: warnings.length === 0 && info.length === 0, warnings, info, groups };
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
    return { ...base, header: null, noRisk: false, noRiskText: t('noRisk'), warnings: [], info: [], groups: [], mapLocks: [], journal: emptyJournal() };
  }
  const l1 = layer1(view.result);
  return {
    ...base,
    header: header(view),
    noRisk: l1.noRisk,
    noRiskText: t('noRisk'),
    warnings: l1.warnings,
    info: l1.info,
    groups: l1.groups,
    mapLocks: mapLocks(view.result),
    journal: journal(view.result, view.changes),
  };
}

// Map locks still closed in reached regions (lib/report.js mapLocksOf, via build): the same localized texts as
// the terminal block, one entry per region. Always visible in the page (reached regions only, no ids).
function mapLocks(result) {
  return (Array.isArray(result.mapLocks) ? result.mapLocks : [])
    .map((r) => ({ region: r.region, items: r.items.map(({ type, need, needKind, text }) => ({ type, need, needKind, text })) }));
}

module.exports = { toState };
