#!/usr/bin/env node
'use strict';
// Phantom Blade Zero missable tracker. Strictly read-only: never writes to the save, its backups or game files.
const fs = require('fs');
const path = require('path');
const { deriveKey } = require('./lib/key');
const { loadSave } = require('./lib/savefile');
const { findGameDir, findExe, findSave, findOodle } = require('./lib/paths');
const { extract } = require('./lib/state');
const { build, render, statusMap, diff } = require('./lib/report');

const HELP = `Kullanım: node pbz.js [seçenekler]

  --watch, -w        Save değiştikçe yeniden oku ve ekranı yenile
  --detay            Spoiler: gizli kuralları ve kesim noktası adlarını göster
  --dump [klasör]    En yeni slotun JSON'unu yaz (varsayılan: out/, depoya girmez)
  --save <yol>       Save dosyası (varsayılan: oyun klasöründeki en yeni PBZSaveGame.sav)
  --game <yol>       Oyun klasörü (varsayılan: Steam kütüphanelerinde PBZ)
  --exe <yol>        PBZ.exe yolu
  --oodle <yol>      oo2core_*_win64.dll yolu (ya da PBZ_OODLE ortam değişkeni)
  --rules <yol>      Kural dosyası (varsayılan: data/rules.json)
  --interval <sn>    Watch modunda yoklama aralığı (varsayılan 5)
  --no-color         Renksiz çıktı
`;

function parseArgs(argv) {
  const o = { watch: false, detail: false, dump: null, color: process.stdout.isTTY, interval: 5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { if (i + 1 >= argv.length) throw new Error(`${a} bir değer bekliyor`); return argv[++i]; };
    switch (a) {
      case '-w': case '--watch': o.watch = true; break;
      case '--detay': case '--detail': o.detail = true; break;
      case '--dump': o.dump = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : path.join(__dirname, 'out'); break;
      case '--save': o.save = val(); break;
      case '--game': o.game = val(); break;
      case '--exe': o.exe = val(); break;
      case '--oodle': o.oodle = val(); break;
      case '--rules': o.rules = val(); break;
      case '--interval': o.interval = Math.max(1, Number(val()) || 5); break;
      case '--no-color': o.color = false; break;
      case '-h': case '--help': o.help = true; break;
      default: throw new Error(`Bilinmeyen seçenek: ${a}`);
    }
  }
  return o;
}

// Refuse to dump decrypted JSON into the game folder (keeps the "never write there" rule airtight).
function safeDumpDir(dir, gameDir) {
  const d = path.resolve(dir).toLowerCase(), g = path.resolve(gameDir).toLowerCase();
  if (d === g || d.startsWith(g + path.sep)) throw new Error('--dump oyun klasörünün içine yazamaz');
  return path.resolve(dir);
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (opt.help) { process.stdout.write(HELP); return; }

  const needGame = !opt.save || !opt.exe;
  const gameDir = needGame ? findGameDir(opt.game) : (opt.game || path.dirname(opt.exe));
  const exe = findExe(gameDir, opt.exe);
  const savePath = findSave(gameDir, opt.save);
  const oodleDll = findOodle(opt.oodle);
  const rules = JSON.parse(fs.readFileSync(opt.rules || path.join(__dirname, 'data', 'rules.json'), 'utf8'));
  const key = deriveKey(exe); // kept in memory only

  let prev = null;
  let lastSig = '';
  const once = async () => {
    const save = await loadSave({ savePath, key, oodleDll });
    const slot = save.latest;
    const st = extract(slot.data);
    const result = build(st, rules, { detail: opt.detail });
    const now = statusMap(result);
    const changes = diff(prev, now);
    prev = now;
    if (opt.dump) {
      const dir = safeDumpDir(opt.dump, gameDir);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${slot.name}.json`), JSON.stringify(slot.data, null, 1));
      fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(slot.data, null, 1));
    }
    return render({ slot, st, result, rules, color: opt.color, changes: opt.watch ? changes : null, savePath });
  };

  if (!opt.watch) { console.log(await once()); return; }

  // Watch: directory events + stat polling as a fallback. Only the main save file triggers a reload.
  const sig = () => { try { const s = fs.statSync(savePath); return `${s.mtimeMs}:${s.size}`; } catch { return ''; } };
  let busy = false, pending = false, timer = null;
  const refresh = async (reason) => {
    if (busy) { pending = true; return; }
    busy = true;
    try {
      const s = sig();
      if (s && s === lastSig && reason !== 'start') return;
      const text = await once();
      lastSig = sig();
      if (opt.color) process.stdout.write('\x1b[2J\x1b[H');
      console.log(text);
      console.log(`\n${new Date().toLocaleTimeString('tr-TR')} okundu · izleniyor (Ctrl+C ile çık)`);
    } catch (e) {
      console.error(`\n${new Date().toLocaleTimeString('tr-TR')} okunamadı: ${e.message} · sonraki değişiklikte yeniden denenecek`);
      lastSig = '';
    } finally {
      busy = false;
      if (pending) { pending = false; schedule('pending'); }
    }
  };
  const schedule = (reason) => { clearTimeout(timer); timer = setTimeout(() => refresh(reason), 1500); };

  await refresh('start');
  const base = path.basename(savePath).toLowerCase();
  try {
    fs.watch(path.dirname(savePath), (ev, file) => { if (!file || file.toLowerCase() === base) schedule('fs'); });
  } catch { /* polling below still works */ }
  setInterval(() => { if (!busy && sig() !== lastSig) schedule('poll'); }, opt.interval * 1000);
}

main().catch((e) => { console.error(`Hata: ${e.message}`); process.exit(1); });
