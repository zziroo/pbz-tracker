'use strict';
// UI strings in Turkish and English. Quest/region names come from lib/names.js, rule texts from data/rules.json.

const STRINGS = {
  tr: {
    'title': 'Phantom Blade Zero — kaçırılabilir takipçisi',
    'header': 'Kayıt {time} · oynama {play}',
    'location': 'Bölge: {loc} ({src})',
    'loc.bell': 'son kullanılan çan',
    'loc.map': 'son açılan harita',
    'noRisk': 'Şu an kaçırma riski yok.',
    'warnTitle': 'Dikkat',
    'grp.here': 'Şu an: {region}',
    'grp.hereUnnamed': 'Şu an bulunduğun bölge',
    'grp.reached': 'Ulaştığın bir bölge',
    'grp.endgame': 'Son çana kadar',
    'grp.later': 'İleride',
    'notStartedHint': 'Bu bölgede henüz başlamadığın {n} kaçırılabilir görev var.',
    'talesOpen': '{n} mor görev hâlâ açık.',
    'hiddenHintKey': '[gizli, açmak için G]',
    'hiddenHintFlag': '[gizli, görmek için --show ile çalıştır]',
    'locks.title': 'Haritada açık kilitler',
    'locks.line': '{region}: {count} — {items}',
    'locks.one': '1 kilit',
    'locks.many': '{n} kilit',
    'locks.item': '{type} ({need})',
    'locks.type.stoneWall': 'taş duvar',
    'locks.type.gate': 'kapı',
    'locks.type.door': 'kapı',
    'locks.type.lock': 'kilit',
    'locks.lockedDoor': 'kilitli kapı',
    'locks.keyItem': 'anahtar eşya {code}',
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
    'note.unverified': 'doğrulanmamış',
    'note.passed': 'geçildi: {c}',
    'note.notPickedUp': 'alınmamış',
    'note.stepDone': 'bu adım tamam; görev sürüyor',
    'note.infoDone': 'yapıldı',
    'chg.new': '{n}: yeni ({s})',
    'chg.status': '{n}: {a} → {b}',
    'chg.progress': '{n}: aşama {a} → {b}',
    'guessLegend': '* = tahmin, doğrulanmadı.',
    'watching': '{time} okundu · izleniyor ({keys})',
    'watchKeys': 'G: gizli bölümleri aç/kapat · Q: çık',
    'watchKeysNoTty': 'Ctrl+C ile çık',
    'readFail': '{time} okunamadı: {msg} · dosya değişince yeniden denenecek',
    'archived': 'arşivlendi: {file}',
    'archiveFail': 'arşive yazılamadı: {msg}',
    'msg.multiSave': 'Birden fazla Steam hesabının kaydı var:',
    'msg.pick': 'Hangisi? [1-{n}, Enter = 1]: ',
    'msg.multiSaveAuto': 'Birden fazla Steam hesabı var; en yeni kayıt kullanılıyor ({id}). Seçmek için --steamid.',
    'err.gameDir': 'Oyun klasörü yok: {p}',
    'err.noGame': 'Oyun bulunamadı. Oyun klasörünü --game ile ver (ya da PBZ klasörünü veya PBZSaveGame.sav dosyasını argüman olarak).',
    'err.noGameForSave': 'Save bulundu ama oyun klasörü bulunamadı (anahtar oyunun exe\'sinden okunur); oyun klasörünü de ver: --game <PBZ klasörü>',
    'err.unknownPath': 'Tanınmayan argüman: {p} (beklenen: .sav dosyası, save klasörü, oyun klasörü ya da PBZ.exe)',
    'cfg.forgotten': 'Hatırlanan oyun ve save yolu silindi.',
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
    'build.unknown': 'Oyun build bilinmiyor (Steam manifesti yok; Steam dışı kurulum olabilir)',
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
    'ui.useSettings': 'Ayarlar sekmesinden oyun klasörünü ya da save dosyasını seç.',
    'ui.readFail': 'Save okunamadı: {msg} · dosya değişince yeniden denenecek',
    'ui.namesAuto': 'Otomatik',
    'ui.namesPatch': 'Yama: {pak}',
    'ui.namesTable': 'Ad tablosu: {lang}',
    'link.game8': 'Game8: kaçırılabilirler rehberi',
    'link.powerpyx': 'PowerPyx: kupa rehberi ve yol haritası',
    'link.dtgre': 'DTGRE: rehberler',
    'link.steamGuides': 'Steam Topluluğu: oyunun rehberleri',
    'link.steamForum': 'Steam forumu: geri dönüşü olmayan nokta tartışması',
    'link.ooz': 'ooz (Powzix): Oodle açma kodunun kaynağı',
    'help': `Kullanım: node pbz.js [seçenekler] [save dosyası | save klasörü | oyun klasörü | PBZ.exe]

  Geliştiriciler ve kural kontrolü için terminal sürümü. Oyuncular web sürümünü kullanır:
  https://zziroo.github.io/pbz-tracker/
  Seçeneksiz çalışınca raporu bir kez yazar; --watch ile güncel tutar.

  --watch, -w        Save değiştikçe yeniden oku (oyun açıkken de çalışır)
  --show             Gizli bölümleri de göster (günlük durumu, kaçanlar)
  --exact            Uyarılarda yer ve boss adlarını göster (yalnız ulaştığın bölgelerde)
  --lang tr|en       Arayüz dili (varsayılan: İngilizce; sistem Türkçe ve Türkçe yama kuruluysa Türkçe)
  --forget           Hatırlanan oyun/save yolunu sil (pbz-tracker.config.json)
  --rules <yol>      Kural dosyası (varsayılan: proje kökündeki rules.json, yoksa gömülü)
  --names <pak|dil>  Ad kaynağı: bulunan bir yama (ör. ProjectPBZ-Windows_C) ya da tablo dili (en, tr)
  --steamid <id>     Birden fazla Steam hesabı varsa hangisi
  --save <yol>       Save dosyası (varsayılan: otomatik bulunur)
  --game <yol>       Oyun klasörü (varsayılan: Steam'den bulunur)
  --exe <yol>        PBZ.exe yolu
  --dump [klasör]    En yeni slotun JSON'unu yaz (varsayılan: ./out)
  --archive [klasör] Okunan her save'in kopyasını sakla (.sav + çözülmüş JSON, save tarihiyle adlı; varsayılan: ./archive)
  --interval <sn>    Watch modunda yoklama aralığı (varsayılan 5)
  --no-color         Renksiz çıktı
  --cli              Uyumluluk için kabul edilir (tek mod terminal)
  --help, -h         Bu yardımı yaz
  --version, -v      Sürümü yaz
`,
  },
  en: {
    'title': 'Phantom Blade Zero — missables tracker',
    'header': 'Save {time} · played {play}',
    'location': 'Area: {loc} ({src})',
    'loc.bell': 'last bell used',
    'loc.map': 'last map unlocked',
    'noRisk': 'No risk of missing anything right now.',
    'warnTitle': 'Heads up',
    'grp.here': 'Now: {region}',
    'grp.hereUnnamed': 'Where you are now',
    'grp.reached': 'An area you have reached',
    'grp.endgame': 'Until the final bell',
    'grp.later': 'Later',
    'notStartedHint': 'There are {n} missable quests in this area you have not started yet.',
    'talesOpen': '{n} purple quests are still open.',
    'hiddenHintKey': '[hidden, press G to show]',
    'hiddenHintFlag': '[hidden, run with --show to see it]',
    'locks.title': 'Open map locks',
    'locks.line': '{region}: {count} — {items}',
    'locks.one': '1 lock',
    'locks.many': '{n} locks',
    'locks.item': '{type} ({need})',
    'locks.type.stoneWall': 'stone wall',
    'locks.type.gate': 'gate',
    'locks.type.door': 'door',
    'locks.type.lock': 'lock',
    'locks.lockedDoor': 'locked door',
    'locks.keyItem': 'key item {code}',
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
    'note.unverified': 'unverified',
    'note.passed': 'passed: {c}',
    'note.notPickedUp': 'not picked up',
    'note.stepDone': 'this step is done; the quest goes on',
    'note.infoDone': 'done',
    'chg.new': '{n}: new ({s})',
    'chg.status': '{n}: {a} → {b}',
    'chg.progress': '{n}: step {a} → {b}',
    'guessLegend': '* = guess, not verified.',
    'watching': 'read at {time} · watching ({keys})',
    'watchKeys': 'G: toggle hidden sections · Q: quit',
    'watchKeysNoTty': 'Ctrl+C to quit',
    'readFail': '{time} could not read: {msg} · will retry when the file changes',
    'archived': 'archived: {file}',
    'archiveFail': 'could not write the archive: {msg}',
    'msg.multiSave': 'Saves from more than one Steam account found:',
    'msg.pick': 'Which one? [1-{n}, Enter = 1]: ',
    'msg.multiSaveAuto': 'More than one Steam account; using the newest save ({id}). Use --steamid to choose.',
    'err.gameDir': 'Game folder not found: {p}',
    'err.noGame': 'Game not found. Pass the game folder with --game (or the PBZ folder or your PBZSaveGame.sav as an argument).',
    'err.noGameForSave': 'Save found but not the game folder (the key is read from the game exe); also pass the game folder: --game <PBZ folder>',
    'err.unknownPath': 'Unrecognised argument: {p} (expected a .sav file, a save folder, the game folder or PBZ.exe)',
    'cfg.forgotten': 'Remembered game and save paths deleted.',
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
    'build.unknown': 'Game build unknown (no Steam manifest; possibly a non-Steam install)',
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
    'ui.useSettings': 'Choose the game folder or the save file in Settings.',
    'ui.readFail': 'Could not read the save: {msg} · will retry when the file changes',
    'ui.namesAuto': 'Automatic',
    'ui.namesPatch': 'Patch: {pak}',
    'ui.namesTable': 'Name table: {lang}',
    'link.game8': 'Game8: missables guide',
    'link.powerpyx': 'PowerPyx: trophy guide and roadmap',
    'link.dtgre': 'DTGRE: guides',
    'link.steamGuides': 'Steam Community: the game\'s guides',
    'link.steamForum': 'Steam forum: point-of-no-return thread',
    'link.ooz': 'ooz (Powzix): source of the Oodle decompressor',
    'help': `Usage: node pbz.js [options] [save file | save folder | game folder | PBZ.exe]

  Terminal version for developers and rule checks. Players use the web version:
  https://zziroo.github.io/pbz-tracker/
  Without options it prints the report once; --watch keeps it up to date.

  --watch, -w        Re-read whenever the save changes (works while the game runs)
  --show             Also show hidden sections (journal status, missed items)
  --exact            Name places and bosses in the warnings (only in areas you have reached)
  --lang tr|en       UI language (default: English; Turkish if the system is Turkish and the Turkish patch is installed)
  --forget           Delete the remembered game/save path (pbz-tracker.config.json)
  --rules <path>     Rules file (default: rules.json in the project root, else built-in)
  --names <pak|lang> Name source: a detected patch (e.g. ProjectPBZ-Windows_C) or a table language (en, tr)
  --steamid <id>     Which Steam account, if there are several
  --save <path>      Save file (default: found automatically)
  --game <path>      Game folder (default: found via Steam)
  --exe <path>       Path to PBZ.exe
  --dump [folder]    Write the newest slot's JSON (default: ./out)
  --archive [folder] Keep a copy of every save read (.sav + decoded JSON, named by the save's date; default: ./archive)
  --interval <s>     Poll interval in watch mode (default 5)
  --no-color         No colours
  --cli              Accepted for compatibility (the terminal is the only mode)
  --help, -h         Show this help
  --version, -v      Print the version
`,
  },
};

// Default language is English. Turkish is picked automatically only when the system language is
// Turkish AND a Turkish text patch is installed (applyAutoLang, called once the game folder is known).
// An explicit choice (--lang, PBZ_LANG, the web page's setting) always wins.
// No bare Node globals here: this module is also used by the browser build (environment read via globalThis).
function envLang() {
  const env = String(globalThis.process?.env?.PBZ_LANG || '').toLowerCase();
  return env === 'tr' || env === 'en' ? env : null;
}
function systemPrefersTr() {
  let loc = '';
  try { loc = Intl.DateTimeFormat().resolvedOptions().locale || ''; } catch { /* ignore */ }
  return /^tr\b/i.test(loc);
}
const detectLang = () => envLang() || 'en';

let current = detectLang();
let chosen = !!envLang();
function setLang(l) { if (STRINGS[l]) { current = l; chosen = true; } return current; }
function applyAutoLang(hasTurkishPatch) {
  if (!chosen && hasTurkishPatch && systemPrefersTr()) current = 'tr';
  return current;
}
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

module.exports = { t, pick, setLang, getLang, detectLang, applyAutoLang, systemPrefersTr };
