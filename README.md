# pbz-tracker

Phantom Blade Zero için yerel, **salt okunur** kaçırılabilir takipçisi (Türkçe / English). Save dosyanı okur ve yalnız bir şeyi kaçırmak üzereysen uyarır. Geri kalanı gizlidir.

## Kullanım

Tek exe, kurulum gerekmez (`dist/pbz-tracker.exe`, `node build/build.js` ile üretilir):

```
pbz-tracker.exe            # bir kez oku
pbz-tracker.exe --watch    # save değiştikçe yenile (oyun açıkken de çalışır); G = gizli bölümler, Q = çık
pbz-tracker.exe --show     # gizli bölümleri de göster
pbz-tracker.exe --lang en  # English
pbz-tracker.exe --help
```

Geliştirirken: `node pbz.js [aynı seçenekler]` (Node 18+, bağımlılık yok).

Oyun Steam'den bulunur (kayıt defterindeki SteamPath → `libraryfolders.vdf` → AppID 4115450). Birden fazla Steam hesabının kaydı varsa sorar (`--steamid` ile de seçilir).

## Görünüm (spoiler politikası)

1. **Varsayılan:** yalnız eyleme dönük uyarılar: önünde bir kesim noktası olan ve hâlâ açık bir kaçırılabilir. Kesim noktası konumuyla anlatılır ("Bu bölgenin son dövüşüne girmeden önce"), adıyla değil. Görev adı yalnız görev günlüğünde zaten başlamışsa yazılır; başlamamışsa yalnız konum ipucu verilir. Uyarı yoksa: "Şu an kaçırma riski yok."
2. **Gizli (`--show` ya da watch'ta G):** günlükteki görevlerin durumu, aşama sayaçları, kaçanlar, mor görev sayımı. Watch modunda her yenilemede yeniden gizlenir.
3. **Hiç gösterilmez:** kayda göre henüz ulaşılmamış her şey. Sınır her zaman çalıştıranın kendi save'ine göre çizilir.

Terminal seçildi, HTML/blur değil: tek exe, dosya yazmıyor, G tuşu yetiyor.

## Adlar

Arayüz dili (`--lang`) ve ad kaynağı (`--names`) ayrı seçilir.

- **Metin yaması:** `ProjectPBZ\Content\Paks` içindeki şifresiz ve `Game.locres` içeren her `.pak` aday sayılır (ör. Türkçe yama `ProjectPBZ-Windows_C.pak`). Bulunursa adlar çalışma anında oradan okunur (salt okunur) ve çıktı bunu bir kez söyler. Birden fazlaysa `--names <pak adı>` ile seçilir. Resmi oyun pak'ları şifreli olduğu için atlanır.
- **Ad tabloları:** yama yoksa `data/names.<dil>.json` (arayüz dilinde). `names.en.json` resmi İngilizce adları içerir (Game8, Maxroll, PowerPyx vb.). Eksik ad İngilizceye düşer ve çıktı bunu bir kez söyler.
- `data/names.json`: pinyin görev kodu → yamadaki locres anahtarı (dile bağlı değil).

### Ad tablosuna katkı

1. `data/names.en.json`'u `data/names.<dil>.json` olarak kopyala (ör. `names.de.json`) ve değerleri çevir. Anahtarlara dokunma: `quests` = kayıttaki pinyin görev kodu, `regions` = harita/seviye kodu, `missables` = `data/rules.json` içindeki kural kimliği.
2. `lib/names.js` içindeki `TABLES` listesine bir satır ekle: `de: require('../data/names.de.json'),`.
3. Bilmediğin adları sil; araç onları İngilizce gösterir.
4. Adları oyunun kendi arayüzünden yaz; rehber sitelerden metin kopyalama.

## Güvenlik kuralları

- Save'e, yedeklerine, yamaya ve oyun dosyalarına **asla yazmaz**. Save paylaşımlı okumayla belleğe alınır; okunurken değiştiyse, kısaysa ya da şifre doğrulaması tutmazsa kısa bekleyip yeniden dener.
- Anahtar her çalıştırmada çalıştıranın kendi `PBZ.exe`'sinden türetilir (işaret dizesi + SHA-256 öneki doğrulaması), yalnız bellekte tutulur. Exe'ye ya da depoya gömülmez.
- Oyun sürecine bağlanmaz, bellek okumaz.
- Oodle açma saf JavaScript'tir (`lib/oodle/`); DLL gerekmez.
- `--dump` çözülmüş JSON'u yazar; oyun, save ve exe klasörlerini reddeder. Dökümler `.gitignore`'da.
- Paylaşılan exe'de kullanıcı verisi (SteamID, save, JSON, anahtar) yoktur.

## Kural tablosu (`data/rules.json`, SPOILER içerir)

- `cutoffs`: kesim noktaları. `where` {tr,en} konumla anlatım (varsayılan görünüm), `label` adıyla (yalnız gizli bölümde, geçildikten sonra), `passedWhen` geçildi mi.
- `missables`: `quest` (pinyin; bilinmiyorsa `null`), `cutoff`, `visibleWhen`, isteğe bağlı `doneWhen` / `failedWhen`, `hintNotStarted` {tr,en}, `warn` {tr,en}, `detect: false` (kayıttan algılanamayan eşya vb.). `type: "info"` yalnız uyarıdır; `activeWhen` doğruyken varsayılan görünümde durur.
- `trueEnding`: gerçek son şartı olan mor görevlerin açık listesi (`quests[]`: `quest` pinyin ya da `null`, `en`, `guess`). Klasöre göre sayılmaz: `Branch` klasöründe mor olmayan görevler de var. Pinyin kodu bilinmeyenler kayıtta tanınamadığı için gösterilmez.
- `type: "info"` kurallarında `warn` adsız metindir (varsayılan görünüm), `warnNamed` adlı metindir (yalnız gizli bölüm).

Koşullar üç değerlidir (doğru / yanlış / bilinmiyor): `mapUnlocked`, `levelVisited`, `currentLevel`, `bellPrefix`, `bossKilled`, `bossSeen`, `questSeen`, `questDone`, `questBranch` + `branch` (+ `state`), `any`, `all`, `not`, `unknown`.

## Format notları

Ayrıntılar vault'ta: `10-Projects/pbz-tracker/sessions/2026-11-05-devir-save-cozumu.md`. `research/` ilk keşif betikleridir.

## Lisans

GPL-3.0-or-later; tam metin `LICENSE` dosyasında. `lib/oodle/` altındaki save açma kodu, Powzix'in GPL-3.0 lisanslı [ooz](https://github.com/powzix/ooz) projesinden (`kraken.cpp`) JavaScript'e uyarlanmış türev bir çalışmadır; bu yüzden projenin tamamı GPL-3.0 altındadır. Derlenmiş `pbz-tracker.exe` paylaşılırken kaynak kodu da (bu depo) alıcıya sunulmalıdır.

## Kaynaklar ve teşekkür

Kaçırılabilir kuralları şu rehberlerden derlendi. Her kuralın kaynağı `data/rules.json` içinde `source` alanında; `checked: "unverified"` olanlar sayfada tek tek kontrol edilmedi.

- Game8 — missables: https://game8.co/games/Phantom-Blade-Zero/archives/634952
- PowerPyx — trophy guide & roadmap: https://powerpyx.com/phantom-blade-zero-trophy-guide-roadmap
- DTGRE — Bai Chilian missables: https://www.dtgre.com/2026/10/phantom-blade-zero-bai-chilian-missable-quests.html
- DTGRE — true ending, purple quests: https://www.dtgre.com/2026/10/phantom-blade-zero-true-ending-purple-quests-mirage-estate.html
- Maxroll — true ending guide (adres eklenecek)
- allthings.how — missables (adres eklenecek)
- Showgamer — missables (adres eklenecek)

Teknik:

- Oodle açma, Powzix'in **ooz** projesinin JavaScript portu (github.com/powzix/ooz, GPL-3.0-or-later).
- Save formatı: phantombladezerosaves.com/save-file-format ve bir dev.to yazısı (adres eklenecek).
