'use strict';
// Rule engine (three-valued: true / false / null = unknown) and the spoiler-free text report.

const SIDE_FOLDERS = new Set(['Branch', 'Simple', 'Collect']);

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
    if (c.bellPrefix) return [...st.bells].some((b) => b.startsWith(`Bell_${c.bellPrefix}`));
    if (c.bossKilled) return bossKeys(c.bossKilled).some((k) => (st.bosses.get(k)?.kills || 0) > 0);
    if (c.bossSeen) return bossKeys(c.bossSeen).some((k) => (st.bosses.get(k)?.attempts || 0) > 0);
    if (c.questSeen) return st.quests.has(c.questSeen);
    if (c.questDone) return st.quests.get(c.questDone)?.completion === 'Succeded';
    if (c.questBranch) {
      const q = st.quests.get(c.questBranch);
      return !!q && q.branches[c.branch] === (c.state || 'Completed');
    }
    throw new Error(`rules.json: bilinmeyen koşul ${JSON.stringify(c)}`);
  };
  return ev;
}

const STATUS = {
  missed: 'kaçtı',
  open: 'açık',
  notStarted: 'başlanmadı',
  done: 'tamamlandı',
  unknown: 'belirsiz',
  info: 'bilgi',
};

function questName(rules, id) {
  const q = rules.quests?.[id];
  return q ? q.name + (q.guess ? '*' : '') : id;
}

// Status of one quest against an optional cutoff.
function judge({ st, ev, rules, questId, doneWhen, failedWhen, cutoff, unmappedSide }) {
  const q = questId ? st.quests.get(questId) : null;
  const cut = cutoff ? ev(cutoff.passedWhen) : null;
  if (q?.completion === 'Succeded' || ev(doneWhen) === true) return { status: 'done', q, cut };
  if ((q && !['Started', 'Succeded'].includes(q.completion)) || ev(failedWhen) === true) {
    return { status: 'missed', q, cut, note: q ? `oyun başarısız saydı (${q.completion})` : undefined };
  }
  if (cut === true) {
    if (q) return { status: 'missed', q, cut, note: 'yarım kaldı' };
    if (questId === null && unmappedSide.length > 0) return { status: 'unknown', q, cut, note: 'kayıtta eşleşmemiş yan görev var' };
    return { status: 'missed', q, cut, note: 'hiç başlanmamış' };
  }
  if (q) return { status: 'open', q, cut };
  if (questId === null && unmappedSide.length > 0) return { status: 'unknown', q, cut, note: 'pinyin adı bilinmiyor' };
  return { status: 'notStarted', q, cut };
}

function build(st, rules, { detail = false } = {}) {
  const ev = makeEval(st, rules);
  const unmappedSide = [...st.quests.values()].filter((q) => SIDE_FOLDERS.has(q.folder) && !rules.quests?.[q.id]);
  const cutText = (id) => {
    const c = rules.cutoffs?.[id];
    if (!c) return { text: id, passed: null };
    const passed = ev(c.passedWhen);
    const reveal = detail || passed === true || ev(c.revealWhen) === true;
    return { text: (reveal ? c.label : c.hint) + (c.guess ? '*' : ''), passed };
  };

  const items = [];
  const covered = new Set();
  let hidden = 0;
  for (const m of rules.missables || []) {
    const visible = ev(m.visibleWhen) === true || (m.quest && st.quests.has(m.quest));
    if (!visible && !detail) { hidden++; continue; }
    if (m.quest) covered.add(m.quest);
    const base = m.name || questName(rules, m.quest);
    const name = base + (m.guess && !base.endsWith('*') ? '*' : '');
    if (m.type === 'info') {
      items.push({ key: m.id, group: 'info', status: 'info', name, warn: m.warn });
      continue;
    }
    const cutoff = rules.cutoffs?.[m.cutoff];
    const r = judge({ st, ev, rules, questId: m.quest, doneWhen: m.doneWhen, failedWhen: m.failedWhen, cutoff, unmappedSide });
    const ct = cutText(m.cutoff);
    const note = r.status === 'missed' && ct.passed === true ? [r.note, `geçildi: ${ct.text}`].filter(Boolean).join(' · ') : r.note;
    items.push({
      key: m.id, group: 'missable', status: r.status, name, note, warn: m.warn,
      progress: r.q?.progress, cutoff: ct.text, cutPassed: ct.passed,
    });
  }

  // True ending: every side quest in the configured folder (purple Tales, guessed).
  const te = rules.trueEnding;
  const tales = [];
  if (te) {
    const tct = cutText(te.cutoff);
    for (const q of st.quests.values()) {
      if (q.folder !== te.questFolder) continue;
      covered.add(q.id);
      const r = judge({ st, ev, rules, questId: q.id, cutoff: rules.cutoffs?.[te.cutoff], unmappedSide });
      tales.push({ key: `tale:${q.id}`, group: 'tale', status: r.status, name: questName(rules, q.id), note: r.note, progress: q.progress, cutoff: tct.text, cutPassed: tct.passed });
    }
  }

  const others = [];
  for (const q of st.quests.values()) {
    if (!SIDE_FOLDERS.has(q.folder) || covered.has(q.id)) continue;
    const status = q.completion === 'Succeded' ? 'done' : q.completion === 'Started' ? 'open' : 'missed';
    others.push({ key: `side:${q.id}`, group: 'side', status, name: questName(rules, q.id), progress: q.progress, note: status === 'missed' ? q.completion : undefined });
  }

  return { items, tales, others, hidden, unmappedSide: unmappedSide.map((q) => q.id), trueEnding: te };
}

// ---------- rendering ----------

function colorizer(enabled) {
  const wrap = (code) => (s) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : s);
  return { red: wrap('31'), yellow: wrap('33'), green: wrap('32'), grey: wrap('90'), bold: wrap('1'), cyan: wrap('36') };
}

const ORDER = { missed: 0, open: 1, notStarted: 2, unknown: 3, done: 4, info: 5 };

function regionLabel(rules, code) {
  const key = Object.keys(rules.regions || {}).find((k) => k.toLowerCase() === code.toLowerCase());
  if (!key || key.startsWith('_')) return code;
  const r = rules.regions[key];
  return r.label + (r.guess ? '*' : '');
}

function fmtTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `${h}sa ${String(m).padStart(2, '0')}dk`;
}

function render({ slot, st, result, rules, color, changes, savePath }) {
  const c = colorizer(color);
  const tag = (s) => {
    const label = `[${STATUS[s]}]`.padEnd(13);
    return { missed: c.red, open: c.yellow, notStarted: c.yellow, done: c.green, unknown: c.grey, info: c.cyan }[s](label);
  };
  const line = (it) => {
    let s = `  ${tag(it.status)} ${it.name}`;
    if (it.progress && it.status !== 'done') s += c.grey(`  (ilerleme ${it.progress.done}/${it.progress.total})`);
    if (it.note) s += c.grey(`  — ${it.note}`);
    return s;
  };
  const out = [];
  out.push(c.bold('Phantom Blade Zero — kaçırılabilir takipçisi'));
  out.push(c.grey(`Kayıt: ${slot.name} · ${st.dateTime} · oynama ${fmtTime(st.playSeconds)} · konum: ${regionLabel(rules, st.currentLevel)}`));
  const regions = [...st.maps].map((m) => regionLabel(rules, m));
  out.push(c.grey(`Açılmış haritalar: ${regions.join(', ') || '-'}`));
  if (changes && changes.length) {
    out.push('');
    out.push(c.bold('Son okumadan beri değişenler'));
    for (const ch of changes) out.push(`  • ${ch}`);
  }

  const mis = result.items.filter((i) => i.group === 'missable');
  const active = mis.filter((i) => ['open', 'notStarted', 'unknown'].includes(i.status) && i.cutPassed !== true)
    .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const closed = mis.filter((i) => !active.includes(i)).sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  out.push('');
  out.push(c.bold('Dikkat: şu noktayı geçmeden bitir'));
  if (active.length === 0) out.push(c.grey('  (görünür bekleyen kaçırılabilir yok)'));
  const byCut = new Map();
  for (const it of active) { if (!byCut.has(it.cutoff)) byCut.set(it.cutoff, []); byCut.get(it.cutoff).push(it); }
  for (const [cut, list] of byCut) {
    out.push(`  ${c.yellow('▶')} ${cut}`);
    for (const it of list) {
      out.push('  ' + line(it));
      if (it.warn) out.push(c.grey(`                    ${it.warn}`));
    }
  }

  if (closed.length) {
    out.push('');
    out.push(c.bold('Kesim noktası geçmiş ya da bitmiş'));
    for (const it of closed) out.push(line(it));
  }

  const info = result.items.filter((i) => i.group === 'info');
  if (info.length) {
    out.push('');
    out.push(c.bold('Bilgi'));
    for (const it of info) out.push(`  ${tag('info')} ${it.name}: ${it.warn}`);
  }

  if (result.trueEnding && result.tales.length) {
    const done = result.tales.filter((t) => t.status === 'done').length;
    out.push('');
    out.push(c.bold(`Gerçek son: mor Tale'ler${result.trueEnding.guess ? '*' : ''} — bulunan ${result.tales.length}, biten ${done}`));
    out.push(c.grey(`  Kesim noktası: ${result.tales[0].cutoff} — hepsi bundan önce bitmiş olmalı.`));
    for (const t of [...result.tales].sort((a, b) => ORDER[a.status] - ORDER[b.status])) out.push(line(t));
  }

  if (result.others.length) {
    out.push('');
    out.push(c.bold('Diğer yan görevler'));
    for (const t of [...result.others].sort((a, b) => ORDER[a.status] - ORDER[b.status])) out.push(line(t));
  }

  out.push('');
  const foot = [];
  if (result.hidden) foot.push(`${result.hidden} kural henüz görünür değil (ileride ya da adı bilinmiyor; --detay ile göster, spoiler).`);
  if (result.unmappedSide.length) foot.push(`Eşleşmemiş görev kodları: ${result.unmappedSide.join(', ')}`);
  foot.push('* = tahmin, doğrulanmadı.');
  if (savePath) foot.push(`Save: ${savePath}`);
  for (const f of foot) out.push(c.grey(f));
  return out.join('\n');
}

// Flat status map for change detection in watch mode.
function statusMap(result) {
  const m = new Map();
  for (const it of [...result.items, ...result.tales, ...result.others]) {
    m.set(it.key, { name: it.name, status: it.status, progress: it.progress ? `${it.progress.done}/${it.progress.total}` : '' });
  }
  return m;
}

function diff(prev, next) {
  if (!prev) return [];
  const out = [];
  for (const [k, v] of next) {
    const p = prev.get(k);
    if (!p) out.push(`${v.name}: yeni (${STATUS[v.status]})`);
    else if (p.status !== v.status) out.push(`${v.name}: ${STATUS[p.status]} → ${STATUS[v.status]}`);
    else if (p.progress !== v.progress && v.progress) out.push(`${v.name}: ilerleme ${p.progress || '-'} → ${v.progress}`);
  }
  return out;
}

module.exports = { build, render, statusMap, diff, STATUS };
