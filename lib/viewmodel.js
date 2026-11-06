'use strict';
// Turns a build() result into the `State` JSON of docs/ui-api.md, in the current UI language.
// Same texts and layers as the terminal report (lib/report.js render):
//   layer 1 → warnings / info / noRisk (always visible in the page),
//   layer 2 → journal (blurred in the page; per row part, see row() below).
// Layer 3 never reaches this module: build() already drops everything the save has not shown.
const i18n = require('./i18n');
const { t } = i18n;
const { byStatus, fmtTime, fmtSaveTime, buildLine, dataLine, activeWarnings, regionLine } = require('./report');

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

function layer1(result) {
  const warnings = activeWarnings(result).map((w) => {
    const items = [];
    for (const it of w.named) items.push({ text: it.name, note: it.warn || null });
    for (const h of w.hints) items.push({ text: h, note: null });
    if (w.unnamed) items.push({ text: t('notStartedHint', { n: w.unnamed }), note: null });
    if (w.tales) items.push({ text: t('talesOpen', { n: w.tales }), note: null });
    return { where: w.where, items };
  });
  const info = result.infoNow.map((i) => i.warn);
  return { noRisk: warnings.length === 0 && info.length === 0, warnings, info };
}

// A row is "in the journal" when its quest is in the save (Started / Succeded / Failed → open / done /
// missed) and the rule is not a guess: the player has met it, so its name stays readable in the page.
// A row whose status is "done" is also readable, whatever it is (item/step rules, guesses): the player has
// already done it. Everything else (not started, unknown, guesses, item rules without a quest) is blurred as a
// whole. Step counters and notes are always blurred (detailBlur), they can tell what is still to come.
const IN_JOURNAL = new Set(['open', 'done', 'missed']);
// Guess rules (*) stay blurred even when done: their 'done' is inferred and their names can be spoilery.
const inJournal = (it) => (it.status === 'done' && !it.guess) || (!!it.inSave && !it.guess && IN_JOURNAL.has(it.status));

const row = (it) => ({
  name: it.name,
  status: it.status,
  statusText: t(`st.${it.status}`),
  progress: it.progress && it.status !== 'done' ? t('progress', { d: it.progress.done, t: it.progress.total }) : null,
  note: it.note || null,
  nameBlur: !inJournal(it),
  detailBlur: true,
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
    return { ...base, header: null, noRisk: false, noRiskText: t('noRisk'), warnings: [], info: [], journal: emptyJournal() };
  }
  const l1 = layer1(view.result);
  return {
    ...base,
    header: header(view),
    noRisk: l1.noRisk,
    noRiskText: t('noRisk'),
    warnings: l1.warnings,
    info: l1.info,
    journal: journal(view.result, view.changes),
  };
}

module.exports = { toState };
