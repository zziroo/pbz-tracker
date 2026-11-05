# pbz-tracker

**Phantom Blade Zero** (PC, Steam) için yerel, **salt okunur**, spoilersız kaçırılabilir takipçisi. Save'ini okur ve yalnız bir şeyi kalıcı olarak kaçırmak üzereysen uyarır. Geri kalanı, sen isteyene kadar gizli kalır.

*English: [README.md](README.md)*

## Ne yapar / ne yapmaz

- Save'ini okur, hâlâ açık kaçırılabilir görevleri bulur ve hangi noktayı henüz geçmemen gerektiğini söyler. Bunu adla değil konumla yapar: "Bu bölgenin son dövüşüne girmeden önce".
- Save'e, yedeklerine, oyun klasörüne ve yamalara **asla yazmaz**. Yalnız exe'nin yanındaki `pbz-tracker.config.json` dosyasını (seçme penceresinde seçtiğin yollar ve pencerenin ayarları) ve isteğe bağlı `--dump` çıktısını yazar. Save paylaşımlı okumayla okunur, oyun açık kalabilir.
- **İnternete çıkmaz.** Telemetri ya da güncelleme kontrolü yok. Pencere, aracın içindeki küçük bir sunucuyla konuşur. Bu sunucu yalnız `127.0.0.1` üzerinde (bu bilgisayar) rastgele bir portta dinler ve her açılışta rastgele bir anahtar kullanır. Ağdaki başka bir cihaz ona ulaşamaz, araç da internete bağlanmaz. Hakkında sekmesindeki bağlantılar yalnız tıklarsan normal tarayıcında açılır.
- **Anahtar ve kişisel veri içermez.** Save anahtarı her çalıştırmada *senin* `PBZ.exe`'nden türetilir ve yalnız bellekte tutulur. Exe'de SteamID, save verisi ya da anahtar yoktur; derleme, exe'de derleyenin ev klasörü yolunu, kullanıcı adını ya da bir SteamID64 bulursa hata verip exe'yi siler (`node build/build.js --check <exe>` aynı taramayı yapar).
- Oyun sürecine bağlanmaz, belleğini okumaz.

## Kurulum

Releases sayfasından `pbz-tracker-v0.4.0.exe`'yi indir. Tek dosya, kurulum gerekmez.

Exe kod imzalı olmadığı için Windows SmartScreen ilk çalıştırmada uyarabilir. "Ek bilgi → Yine de çalıştır" de, ya da exe'yi kaynaktan kendin derle (aşağıda).

## Kullanım

**Çift tıkla; bir pencere açılır.** Save dosyanı exe'nin üstüne de bırakabilirsin. Pencere, oyun her kaydettiğinde kendiliğinden yenilenir; oyunun yanında açık bırakabilirsin.

![Uyarılar sekmesi](docs/screenshots/ui-warnings.png)

- **Uyarılar** (varsayılan sekme): yalnız kaçırmak üzere olduğun şeyler, ya da "Şu an kaçırma riski yok."
- **Günlük**: günlüğündeki görevlerin durumu, aşama sayaçları, kaçanlar ve mor görev sayımı. Adlar bulanıktır, bir satıra tıklayınca açılır; her yenilemede yeniden bulanıklaşır.
- **Ayarlar**: dil (TR/EN), ad kaynağı, yenileme aralığı, oyun klasörü / save dosyası (seç ya da unut).
- **Hakkında**: sürüm, doğrulanan oyun build'i, lisans, rehber bağlantıları.

![Günlük sekmesi, bulanık](docs/screenshots/ui-journal.png)

Pencere, uygulama modunda açılan Microsoft Edge'dir (ya da Chrome); sekme ve adres çubuğu yoktur. Edge ya da Chrome yoksa sayfa varsayılan tarayıcında açılır. Pencereyi kapatınca araç yaklaşık 10 saniye içinde kapanır. Exe'nin üstüne `PBZSaveGame.sav` dosyasını, `SaveGames\Steam` altındaki hesap klasörünü, oyun klasörünü ya da `PBZ.exe`'yi bırakabilirsin.

### Terminal (`--cli`)

v0.3'ün terminal modu duruyor. `--cli` tek başına save'i konsolda izler (G gizli bölümleri açar/kapatır, Q çıkar). `--show`, `--watch`, `--dump`, `--save` gibi terminal seçenekleri de terminalde çalışır:

```
pbz-tracker-v0.4.0.exe --cli         # konsolda izle; G = gizli bölümler, Q = çık
pbz-tracker-v0.4.0.exe --no-color    # bir kez oku ve yaz
pbz-tracker-v0.4.0.exe --watch       # oyun kaydettikçe yenile
pbz-tracker-v0.4.0.exe --show        # gizli bölümleri de yaz
pbz-tracker-v0.4.0.exe --lang tr     # arayüz dili: tr ya da en (varsayılan: İngilizce; sistem dili Türkçe ve Türkçe yama kuruluysa Türkçe)
pbz-tracker-v0.4.0.exe --names en    # ad kaynağı: bulunan bir metin yaması ya da ad tablosu
pbz-tracker-v0.4.0.exe --dump        # en yeni save slotunu JSON olarak .\out klasörüne yaz (hata ayıklama)
pbz-tracker-v0.4.0.exe --ui          # pencereyi terminalden aç (--no-edge: varsayılan tarayıcı)
pbz-tracker-v0.4.0.exe --version
pbz-tracker-v0.4.0.exe --help
```

`--dump`, save'inin çözülmüş tam dökümünü yazar (`out\latest.json`). Oynama geçmişin gibi kişisel veri içerebilir; paylaşma. Oyun ya da save klasörüne yazmayı reddeder.

Oyun Steam üzerinden bulunur (kayıt defterindeki `SteamPath` → `libraryfolders.vdf` → AppID 4115450), sonra yaygın klasörlerde aranır (`<sürücü>:\SteamLibrary`, `Program Files\Steam`, `<sürücü>:\Games\PBZ`). Birden fazla Steam hesabının kaydı varsa hangisinin kullanılacağını sorar; `--steamid` ile de seçilir.

**İlk açılış:** araç oyunu kendisi bulur. Bulamazsa pencere bunu söyler; oyun klasörünü (ya da `PBZSaveGame.sav`'ı) Ayarlar sekmesinden seçersin. Terminalde bir klasör seçme penceresi açar ("Phantom Blade Zero kurulum klasörünü seç"); save de bulunamazsa `PBZSaveGame.sav` için dosya seçme penceresi açar. Seçim exe'nin yanındaki `pbz-tracker.config.json` dosyasında saklanır. Pencerenin ayarları (dil, ad kaynağı, yenileme aralığı) da aynı dosyada durur. İsteğe bağlı `--dump` çıktısı dışında aracın yazdığı tek dosya budur. `--pick` seçme penceresini isteyerek açar, `--forget` dosyayı siler, `--no-dialog` hiç seçme penceresi açmaz. Artık var olmayan bir yol yok sayılır. `--game` / `--save` ile çalıştırınca pencere açılmaz.

**Başka bir klasöre ya da Steam dışından mı kurulu?** Oyun klasörünü ya da save'i exe'nin üstüne bırak, ya da `--game <PBZ klasörü>` ver (gerekirse `--save` ile birlikte). Steam manifesti yoksa oyun build'i "bilinmiyor" diye gösterilir; "doğrulanmadı" uyarısı çıkmaz.

## Spoiler politikası

1. **Varsayılan görünüm:** yalnız eyleme dönük uyarılar, yani önünde bir kesim noktası olan ve hâlâ açık bir kaçırılabilir. Kesim noktası adıyla değil konumuyla anlatılır. Görev adı yalnız görev günlüğünde zaten başlamışsa yazılır; başlamamışsa yalnız konum ipucu verilir. Uyarı yoksa: "Şu an kaçırma riski yok."
2. **Gizli (Günlük sekmesi; terminalde `--show` ya da G):** günlükteki görevlerin durumu, aşama sayaçları, kaçanlar, mor görev sayımı. Pencerede görev adları (sayaç ve notlarıyla) satıra tıklayana kadar bulanıktır; durum rozetleri ve sayılı bölüm başlıkları görünür kalır. Her yenilemede hepsi yeniden bulanıklaşır.
3. **Hiç gösterilmez:** save'e göre henüz ulaşılmamış her şey. Sınır her zaman aracı çalıştıranın kendi save'ine göre çizilir.

## Desteklenen oyun sürümü

Steam build **26367565** üzerinde doğrulandı. Başlık satırı kurulu build'i gösterir; doğrulanmamış bir build'de tek satırlık bir uyarı çıkar. Oyun güncellemesi save anahtarını değiştirdiyse araç, build numarasını da yazan açık bir hatayla durur.

## Kuralları exe'yi değiştirmeden güncelleme

Kurallar (`data/rules.json`) ve ad tabloları exe'ye gömülüdür, ama **exe'nin yanına** konan dosyalar önceliklidir:

1. Bu depodaki güncel `data/rules.json`'ı indir (Raw → `rules.json` olarak kaydet).
2. `pbz-tracker-v0.4.0.exe` ile aynı klasöre koy.
3. Aracı çalıştır. Başlıkta `Kurallar: yanındaki rules.json (sürüm …)` yazar.

Ad tabloları da aynı şekilde çalışır: exe'nin yanındaki `names.<dil>.json` o dili değiştirir ya da ekler. Kural dosyası `--rules <yol>` ile açıkça da verilebilir. Bozuk bir dosya ya da başka bir kural biçimi (`schemaVersion`) için yazılmış dosya, gömülü kopyaya sessizce düşmek yerine aracı hatayla durdurur. Gömülü kurallara dönmek için dosyayı sil. Aracın kendisi hiçbir şey indirmez.

## Adlar ve diller

Arayüz dili (`--lang`) ve ad kaynağı (`--names`) ayrı seçilir. Varsayılan: İngilizce arayüz ve resmi İngilizce adlar. Sistem dili Türkçe ve Türkçe yama kuruluysa araç Türkçe açılır ve adları yamadan okur. Elle verilen `--lang` ya da pencerede seçilen dil her zaman önceliklidir.

- **Metin yaması:** `ProjectPBZ\Content\Paks` içindeki, `Localization/Game/<kültür>/Game.locres` taşıyan şifresiz `.pak` dosyaları aday sayılır (ör. Türkçe yama `ProjectPBZ-Windows_C.pak`). Bulunursa adlar çalışma anında oradan okunur (salt okunur) ve çıktı bunu bir kez söyler. Birden fazlaysa `--names <pak adı>` ile seçilir. Desteklenenler: eski dizinli pak'lar (v1–v9) ya da her sürümden küçük (≤ 32 MB), sıkıştırılmamış pak'lar. Resmi oyun pak'ları (v12) atlanır.
- **Ad tabloları:** yama yoksa `data/names.<dil>.json` kullanılır (arayüz dilinde). `names.en.json` resmi İngilizce adları içerir. Eksik ad İngilizceye düşer ve çıktı bunu bir kez söyler.
- `data/names.json`: pinyin görev kodu → yamadaki locres anahtarı (dile bağlı değil).

### Ad tablosuna katkı

1. `data/names.en.json`'u `data/names.<dil>.json` olarak kopyala (ör. `names.de.json`) ve değerleri çevir. Anahtarlara dokunma: `quests` = save'deki pinyin görev kodu, `regions` = harita/seviye kodu, `missables` = `data/rules.json` içindeki kural kimliği.
2. `lib/names.js` içindeki `TABLES` listesine bir satır ekle: `de: require('../data/names.de.json'),`.
3. Bilmediğin adları sil; araç onları İngilizce gösterir.
4. Adları oyunun kendi arayüzünden yaz; rehber sitelerden metin kopyalama.

## Kaynaktan derleme

Node 18+ yeterli, bağımlılık yok: `node pbz.js` pencereyi açar (sayfa `ui/` klasöründen okunur), `node pbz.js --cli [seçenekler]` terminalde çalışır.

Tek exe: `node build/build.js` komutu `dist/pbz-tracker-v<sürüm>.exe` dosyasını üretir. Önce kaynakları ve `ui/` içindeki sayfa dosyalarını tek betikte paketler, sonra Node SEA ile exe yapar. `node build/build.js --bundle-only` yalnız betiği (`dist/pbz-tracker.js`) yazar.

Pencere nasıl çalışır: `lib/server.js`, `ui/` dosyalarını ve bir JSON API'sini (sözleşme: `docs/ui-api.md`) `127.0.0.1` üzerinde, rastgele portta ve her açılışta değişen bir anahtarla sunar; `lib/browser.js` Edge'i ya da Chrome'u `--app` ile açar. Çift tıkla açılan exe kendini konsolsuz yeniden başlatır, böylece boş bir konsol penceresi açık kalmaz. Exe'ye gömme için `npx postject` kullanır; bu yalnız derleme sırasında gerekir.

Oodle DLL'ine karşı test (başka bir oyundan `oo2core_8_win64.dll` gerekir): `node test/oodle-compare.js --game <PBZ klasörü> --dll <dll>`.

## Kural tablosu (`data/rules.json`, oyunun tamamı için SPOILER içerir)

- `schemaVersion`: dosya biçimi (araç uyuşmazsa reddeder). `rulesVersion`: kural içeriğinin sürümü; her düzeltmede artır, başlıkta görünür.
- `sources`: rehberler. Her kuralda `source: {ids, checked}` alanı var; `checked: "unverified"` = kural-kaynak eşleşmesi sayfada tek tek kontrol edilmedi.
- `cutoffs`: kesim noktaları. `where` {tr,en} konumla anlatım (varsayılan görünüm), `label` adıyla (yalnız gizli bölümde, nokta geçildikten sonra), `passedWhen` geçildi mi.
- `missables`: `quest` (pinyin; bilinmiyorsa `null`), `cutoff`, `visibleWhen`, isteğe bağlı `doneWhen` / `failedWhen`, `hintNotStarted` {tr,en}, `warn` {tr,en}, `detect: false` (save'den algılanamayan eşya vb.). `type: "info"` yalnız uyarıdır: `warn` adsız metin (varsayılan görünüm), `warnNamed` adlı metin (gizli bölüm); `activeWhen` doğruyken varsayılan görünümde durur.
- `trueEnding`: gerçek son şartı olan mor görevlerin açık listesi. Klasöre göre sayılmaz; pinyin kodu bilinmeyenler gösterilmez.

Koşullar üç değerlidir (doğru / yanlış / bilinmiyor): `mapUnlocked`, `levelVisited`, `currentLevel`, `bellPrefix`, `bossKilled`, `bossSeen`, `questSeen`, `questDone`, `questBranch` + `branch` (+ `state`), `any`, `all`, `not`, `unknown`.

`research/` ilk keşif betikleridir, araç değil.

## Bilinen sınırlar

- İleriki bazı kesim noktaları save'den henüz algılanamıyor; uyarıları görev durumuna ve konumla anlatıma dayanıyor.
- Rehberler bir hikâye kesim noktasında anlaşamıyor: bazıları ileriki bir hikâye bölgesine girmenin göl çevresindeki bazı görevleri kapattığını söylüyor; Steam forumundaki oyuncular ise asıl geri dönüşü olmayan noktanın oyunun sonuna yakın, açık bir uyarıyla geldiğini söylüyor. Araç save'den kontrol edilene kadar daha sıkı kuralı "tahmin" olarak tutuyor.
- Bazı rehberler iki isteğe bağlı boss dövüşünü de gerçek son şartı sayıyor. Bunlar henüz izlenmiyor (doğrulanmadı).
- Birkaç görev adı eşleşmesi anlamdan çıkarıldı ve `*` ile işaretli; bir uyarının (kamp uyarısı) ifadesi doğrulanmadı.

## Lisans

GPL-3.0-or-later; tam metin `LICENSE` dosyasında. `lib/oodle/` altındaki save açma kodu, Powzix'in GPL-3.0 lisanslı [ooz](https://github.com/powzix/ooz) projesinden (`kraken.cpp`) JavaScript'e uyarlanmış türev bir çalışmadır; bu yüzden projenin tamamı GPL-3.0 altındadır. Derlenmiş exe paylaşılırken kaynak kodu da (bu depo) alıcıya sunulmalıdır.

## Kaynaklar ve teşekkür

Kaçırılabilir kuralları herkese açık rehberlerden derlendi:

- Game8 — missables: https://game8.co/games/Phantom-Blade-Zero/archives/634952
- PowerPyx — trophy guide & roadmap: https://powerpyx.com/phantom-blade-zero-trophy-guide-roadmap
- DTGRE (https://www.dtgre.com) — kaçırılabilir görevler ve gerçek son rehberleri. Sayfa adresleri yalnız `data/rules.json` içinde, çünkü adreslerin kendisi spoiler içeriyor.
- Steam Topluluğu — Phantom Blade Zero rehberleri: https://steamcommunity.com/app/4115450/guides/ ve geri dönüşü olmayan nokta üzerine forum başlığı: https://steamcommunity.com/app/4115450/discussions/0/572679490124259489/
- Maxroll (gerçek son), allthings.how (missables), Showgamer (missables): adresleri eklenecek.

Teknik:

- Powzix'in [ooz](https://github.com/powzix/ooz) projesi (Oodle açma).
- Save formatı yazıları: phantombladezerosaves.com/save-file-format ve bir dev.to yazısı (adresi eklenecek).

S-GAME ile bağlantısı yoktur. Phantom Blade Zero sahiplerinin ticari markasıdır.
