'use strict';
// UI strings in Turkish and English. Quest/region names come from lib/names.js, rule texts from data/rules.json.

const STRINGS = {
  tr: {
    'title': 'Phantom Blade Zero — kaçırılabilir takipçisi',
    'header': 'Kayıt {time} · oynama {play}',
    'location': 'Konum: {loc}',
    'noRisk': 'Şu an kaçırma riski yok.',
    'warnTitle': 'Dikkat',
    'notStartedHint': 'Bu bölgede henüz başlamadığın {n} kaçırılabilir görev var.',
    'talesOpen': '{n} mor görev hâlâ açık.',
    'hiddenHintKey': '[gizli, açmak için G]',
    'hiddenHintFlag': '[gizli, görmek için --show ile çalıştır]',
    'sec.journal': 'Günlük durumu',
    'sec.closed': 'Kaçırılabilirler',
    'sec.tales': 'Gerçek son: mor görevler — bulunan {found}, biten {done}',
    'sec.other': 'Diğer yan görevler',
    'sec.info': 'Bilgi',
    'sec.changes': 'Son okumadan beri değişenler',
    'st.missed': 'kaçtı', 'st.open': 'açık', 'st.notStarted': 'başlanmadı', 'st.done': 'tamamlandı', 'st.unknown': 'belirsiz', 'st.info': 'bilgi',
    'progress': 'aşama {d}/{t}',
    'note.neverStarted': 'hiç başlanmamış',
    'note.unfinished': 'yarım kaldı',
    'note.failed': 'oyun başarısız saydı',
    'note.unmatched': 'kayıtta eşleşmemiş yan görev var',
    'note.undetectable': 'kayıttan algılanamıyor',
    'note.passed': 'geçildi: {c}',
    'chg.new': '{n}: yeni ({s})',
    'chg.status': '{n}: {a} → {b}',
    'chg.progress': '{n}: aşama {a} → {b}',
    'guessLegend': '* = tahmin, doğrulanmadı.',
    'watching': '{time} okundu · izleniyor ({keys})',
    'watchKeys': 'G: gizli bölümleri aç/kapat · Q: çık',
    'watchKeysNoTty': 'Ctrl+C ile çık',
    'readFail': '{time} okunamadı: {msg} · dosya değişince yeniden denenecek',
    'msg.multiSave': 'Birden fazla Steam hesabının kaydı var:',
    'msg.pick': 'Hangisi? [1-{n}, Enter = 1]: ',
    'msg.multiSaveAuto': 'Birden fazla Steam hesabı var; en yeni kayıt kullanılıyor ({id}). Seçmek için --steamid.',
    'err.gameDir': 'Oyun klasörü yok: {p}',
    'err.noGame': 'Phantom Blade Zero kurulumu bulunamadı (Steam AppID 4115450). --game ile oyun klasörünü ver.',
    'err.noExe': 'PBZ.exe bulunamadı: {p}',
    'err.noSaveFile': 'Save dosyası yok: {p}',
    'err.noSave': 'Save bulunamadı: {p}\\<SteamID64>\\PBZSaveGame.sav',
    'err.noSteamId': '{id} için kayıt yok. Bulunanlar: {ids}',
    'err.badPick': 'Geçersiz seçim.',
    'err.dumpInGame': '--dump oyun ya da save klasörünün içine yazamaz',
    'err.prefix': 'Hata: {msg}',
    'rules.embedded': 'Kurallar: gömülü (sürüm {v})',
    'rules.sidecar': 'Kurallar: yanındaki {file} (sürüm {v})',
    'rules.explicit': 'Kurallar: {file} (sürüm {v})',
    'names.sidecar': 'ad tablosu: yanındaki {files}',
    'err.dataRead': '{file} okunamadı ({msg})',
    'err.dataJson': '{file} geçerli JSON değil: {msg}',
    'err.rulesSchema': '{file}: kural dosyası biçimi {got}, bu araç {want} bekliyor; aracın ya da dosyanın uygun sürümünü kullan',
    'err.rulesShape': '{file}: geçersiz kural dosyası ({msg})',
    'err.namesShape': '{file}: geçersiz ad tablosu ({msg})',
    'names.patch': 'Yama bulundu: {pak} → adlar oradan',
    'names.patchMulti': 'birden fazla yama var ({list}); --names ile seç',
    'names.unknown': '--names {v} bulunamadı (seçenekler: {opts})',
    'names.fallback': 'bazı adlar İngilizce gösteriliyor (ad tablosu eksik)',
    'err.keyBuild': '(oyun build {build}; aracın doğrulandığı build: {tested})',
    'build.tested': 'Oyun build {build} · araç bu build ile doğrulandı',
    'build.untested': 'Oyun build {build}: oyun güncellenmiş, araç bu sürümde henüz doğrulanmadı',
    'build.unknown': 'Oyun build bilinmiyor (Steam manifesti okunamadı)',
    'err.saveBusy': 'save okunamadı ({code})',
    'err.saveChanged': 'save okunurken değişti',
    'err.blockBad': 'mühürlü blok başlığı bozuk ya da kısa',
    'err.gcm': 'şifre doğrulaması tutmadı (dosya yazılıyor olabilir)',
    'err.noHeader': 'PBZS başlığı yok ya da dosya kısa',
    'err.version': 'bilinmeyen save sürümü {v} (beklenen 3)',
    'err.short': 'dosya dizin bloğundan kısa',
    'err.dirBad': 'save dizini bozuk (format değişmiş olabilir)',
    'err.slotRange': '{name} slotu dosya sonunu aşıyor',
    'err.noSlots': 'save içinde AutoSave/ManualSave slotu yok',
    'err.slotJson': '{name} slotu JSON değil: {msg}',
    'err.compression': '{name} slotu: bilinmeyen sıkıştırma {alg}',
    'err.keyNoMarker': 'anahtar işaret dizesi exe içinde yok ({p}); oyun güncellenmiş olabilir',
    'err.keyNoMatch': 'anahtar doğrulanamadı: beklenen SHA-256 öneki {want}, bulunan {got}; oyun güncellenmiş olabilir',
    'err.unknownOpt': 'Bilinmeyen seçenek: {o}',
    'err.needsValue': '{o} bir değer bekliyor',
    'help': `Kullanım: pbz-tracker [seçenekler]

  --watch, -w        Save değiştikçe yeniden oku (oyun açıkken de çalışır)
  --show             Gizli bölümleri de göster (günlük durumu, kaçanlar)
  --lang tr|en       Arayüz dili (varsayılan: sistem dili)
  --rules <yol>      Kural dosyası (varsayılan: yanındaki rules.json, yoksa gömülü)
  --names <pak|dil>  Ad kaynağı: bulunan bir yama (ör. ProjectPBZ-Windows_C) ya da tablo dili (en, tr)
  --steamid <id>     Birden fazla Steam hesabı varsa hangisi
  --save <yol>       Save dosyası (varsayılan: otomatik bulunur)
  --game <yol>       Oyun klasörü (varsayılan: Steam'den bulunur)
  --exe <yol>        PBZ.exe yolu
  --dump [klasör]    En yeni slotun JSON'unu yaz (varsayılan: ./out)
  --interval <sn>    Watch modunda yoklama aralığı (varsayılan 5)
  --no-color         Renksiz çıktı
  --version, -v      Sürümü yaz
`,
  },
  en: {
    'title': 'Phantom Blade Zero — missables tracker',
    'header': 'Save {time} · played {play}',
    'location': 'Location: {loc}',
    'noRisk': 'No risk of missing anything right now.',
    'warnTitle': 'Heads up',
    'notStartedHint': 'There are {n} missable quests in this area you have not started yet.',
    'talesOpen': '{n} purple quests are still open.',
    'hiddenHintKey': '[hidden, press G to show]',
    'hiddenHintFlag': '[hidden, run with --show to see it]',
    'sec.journal': 'Journal status',
    'sec.closed': 'Missables',
    'sec.tales': 'True ending: purple quests — found {found}, finished {done}',
    'sec.other': 'Other side quests',
    'sec.info': 'Info',
    'sec.changes': 'Changed since last read',
    'st.missed': 'missed', 'st.open': 'open', 'st.notStarted': 'not started', 'st.done': 'done', 'st.unknown': 'unknown', 'st.info': 'info',
    'progress': 'step {d}/{t}',
    'note.neverStarted': 'never started',
    'note.unfinished': 'left unfinished',
    'note.failed': 'game marked it failed',
    'note.unmatched': 'save has unmatched side quests',
    'note.undetectable': 'cannot be detected from the save',
    'note.passed': 'passed: {c}',
    'chg.new': '{n}: new ({s})',
    'chg.status': '{n}: {a} → {b}',
    'chg.progress': '{n}: step {a} → {b}',
    'guessLegend': '* = guess, not verified.',
    'watching': 'read at {time} · watching ({keys})',
    'watchKeys': 'G: toggle hidden sections · Q: quit',
    'watchKeysNoTty': 'Ctrl+C to quit',
    'readFail': '{time} could not read: {msg} · will retry when the file changes',
    'msg.multiSave': 'Saves from more than one Steam account found:',
    'msg.pick': 'Which one? [1-{n}, Enter = 1]: ',
    'msg.multiSaveAuto': 'More than one Steam account; using the newest save ({id}). Use --steamid to choose.',
    'err.gameDir': 'Game folder not found: {p}',
    'err.noGame': 'Phantom Blade Zero install not found (Steam AppID 4115450). Pass the game folder with --game.',
    'err.noExe': 'PBZ.exe not found: {p}',
    'err.noSaveFile': 'Save file not found: {p}',
    'err.noSave': 'No save found: {p}\\<SteamID64>\\PBZSaveGame.sav',
    'err.noSteamId': 'No save for {id}. Found: {ids}',
    'err.badPick': 'Invalid choice.',
    'err.dumpInGame': '--dump cannot write inside the game or save folder',
    'err.prefix': 'Error: {msg}',
    'rules.embedded': 'Rules: built-in (version {v})',
    'rules.sidecar': 'Rules: {file} next to the app (version {v})',
    'rules.explicit': 'Rules: {file} (version {v})',
    'names.sidecar': 'name table: {files} next to the app',
    'err.dataRead': 'cannot read {file} ({msg})',
    'err.dataJson': '{file} is not valid JSON: {msg}',
    'err.rulesSchema': '{file}: rules file format {got}, this tool expects {want}; use a matching tool or rules version',
    'err.rulesShape': '{file}: invalid rules file ({msg})',
    'err.namesShape': '{file}: invalid name table ({msg})',
    'names.patch': 'Patch found: {pak} → names taken from it',
    'names.patchMulti': 'several patches found ({list}); choose with --names',
    'names.unknown': '--names {v} not found (options: {opts})',
    'names.fallback': 'some names shown in English (name table incomplete)',
    'err.keyBuild': '(game build {build}; tool verified on: {tested})',
    'build.tested': 'Game build {build} · tool verified on this build',
    'build.untested': 'Game build {build}: the game was updated, the tool is not verified on this version yet',
    'build.unknown': 'Game build unknown (could not read the Steam manifest)',
    'err.saveBusy': 'could not read the save ({code})',
    'err.saveChanged': 'the save changed while being read',
    'err.blockBad': 'sealed block header is broken or short',
    'err.gcm': 'decryption check failed (the file may be mid-write)',
    'err.noHeader': 'no PBZS header or the file is short',
    'err.version': 'unknown save version {v} (expected 3)',
    'err.short': 'file is shorter than its directory block',
    'err.dirBad': 'save directory is malformed (format may have changed)',
    'err.slotRange': 'slot {name} runs past the end of the file',
    'err.noSlots': 'no AutoSave/ManualSave slot in the save',
    'err.slotJson': 'slot {name} is not JSON: {msg}',
    'err.compression': 'slot {name}: unknown compression {alg}',
    'err.keyNoMarker': 'key marker string not found in the exe ({p}); the game may have been updated',
    'err.keyNoMatch': 'could not verify the key: expected SHA-256 prefix {want}, found {got}; the game may have been updated',
    'err.unknownOpt': 'Unknown option: {o}',
    'err.needsValue': '{o} needs a value',
    'help': `Usage: pbz-tracker [options]

  --watch, -w        Re-read whenever the save changes (works while the game runs)
  --show             Also show hidden sections (journal status, missed items)
  --lang tr|en       UI language (default: system language)
  --rules <path>     Rules file (default: rules.json next to the app, else built-in)
  --names <pak|lang> Name source: a detected patch (e.g. ProjectPBZ-Windows_C) or a table language (en, tr)
  --steamid <id>     Which Steam account, if there are several
  --save <path>      Save file (default: found automatically)
  --game <path>      Game folder (default: found via Steam)
  --exe <path>       Path to PBZ.exe
  --dump [folder]    Write the newest slot's JSON (default: ./out)
  --interval <s>     Poll interval in watch mode (default 5)
  --no-color         No colours
  --version, -v      Print the version
`,
  },
};

function detectLang() {
  const env = (process.env.PBZ_LANG || '').toLowerCase();
  if (env === 'tr' || env === 'en') return env;
  let loc = '';
  try { loc = Intl.DateTimeFormat().resolvedOptions().locale || ''; } catch { /* ignore */ }
  return /^tr\b/i.test(loc) ? 'tr' : 'en';
}

let current = detectLang();
function setLang(l) { if (STRINGS[l]) current = l; return current; }
function getLang() { return current; }
function t(key, vars = {}) {
  const s = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
// Picks the current language from a {tr, en} object (or returns a plain string).
function pick(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v[current] ?? v.en ?? v.tr ?? '';
}

module.exports = { t, pick, setLang, getLang, detectLang };
