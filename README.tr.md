# pbz-tracker

**▶ Web sürümünü aç: https://zziroo.github.io/pbz-tracker/**

**⬇ Exe'yi indir (Windows): https://github.com/zziroo/pbz-tracker/releases/tag/v0.5.0**

**Phantom Blade Zero** (PC, Steam) için yerel, **salt okunur**, spoilersız kaçırılabilir takipçisi. Save'ini okur ve yalnız bir şeyi kalıcı olarak kaçırmak üzereysen uyarır. Geri kalanı, sen isteyene kadar gizli kalır.

*English: [README.md](README.md)*

## Ne yapar / ne yapmaz

- Save'ini okur, hâlâ açık kaçırılabilir görevleri bulur ve hangi noktayı henüz geçmemen gerektiğini söyler. Bunu adla değil konumla yapar: "Bu bölgenin son dövüşüne girmeden önce".
- Save'e, yedeklerine, oyun klasörüne ve yamalara **asla yazmaz**. Yalnız exe'nin yanındaki `pbz-tracker.config.json` dosyasını (seçme penceresinde seçtiğin yollar ve pencerenin ayarları), yanındaki `pbz-tracker.timeline.json` dosyasını (yerel görev zaman çizelgesi, bkz. Tanılama; `--no-timeline` kapatır) ve isteğe bağlı `--dump` çıktısını yazar. Save paylaşımlı okumayla okunur, oyun açık kalabilir.
- **İnternete çıkmaz.** Telemetri ya da güncelleme kontrolü yok. Pencere, aracın içindeki küçük bir sunucuyla konuşur. Bu sunucu yalnız `127.0.0.1` üzerinde (bu bilgisayar) rastgele bir portta dinler ve her açılışta rastgele bir anahtar kullanır. Ağdaki başka bir cihaz ona ulaşamaz, araç da internete bağlanmaz. Hakkında sekmesindeki bağlantılar yalnız tıklarsan normal tarayıcında açılır.
- **Anahtar ve kişisel veri içermez.** Save anahtarı her çalıştırmada *senin* `PBZ.exe`'nden türetilir ve yalnız bellekte tutulur. Exe'de SteamID, save verisi ya da anahtar yoktur; derleme, exe'de derleyenin ev klasörü yolunu, kullanıcı adını ya da bir SteamID64 bulursa hata verip exe'yi siler (`node build/build.js --check <exe>` aynı taramayı yapar).
- Oyun sürecine bağlanmaz, belleğini okumaz.

## Kurulum

Releases sayfasından `pbz-tracker-v0.5.0.exe`'yi indir. Tek dosya, kurulum gerekmez.

Exe kod imzalı olmadığı için Windows SmartScreen ilk çalıştırmada uyarabilir. "Ek bilgi → Yine de çalıştır" de, ya da exe'yi kaynaktan kendin derle (aşağıda).

## Kullanım

**Çift tıkla; bir pencere açılır.** Save dosyanı exe'nin üstüne de bırakabilirsin. Pencere, oyun her kaydettiğinde kendiliğinden yenilenir; oyunun yanında açık bırakabilirsin.

![Uyarılar sekmesi](docs/screenshots/web-tr-warnings.png)

- **Uyarılar** (varsayılan sekme): yalnız kaçırmak üzere olduğun şeyler, ya da "Şu an kaçırma riski yok."
- **Günlük**: günlüğündeki görevlerin durumu, aşama sayaçları, kaçanlar ve mor görev sayımı. Adlar bulanıktır, bir satıra tıklayınca açılır; her yenilemede yeniden bulanıklaşır.
- **Ayarlar**: dil (TR/EN), ad kaynağı, yenileme aralığı, oyun klasörü / save dosyası (seç ya da unut).
- **Hakkında**: sürüm, doğrulanan oyun build'i, lisans, rehber bağlantıları.

![Günlük sekmesi, bulanık](docs/screenshots/web-tr-journal.png)

Pencere, uygulama modunda açılan Microsoft Edge'dir (ya da Chrome); sekme ve adres çubuğu yoktur. Edge ya da Chrome yoksa sayfa varsayılan tarayıcında açılır. Pencereyi kapatınca araç yaklaşık 10 saniye içinde kapanır. Exe'nin üstüne `PBZSaveGame.sav` dosyasını, `SaveGames\Steam` altındaki hesap klasörünü, oyun klasörünü ya da `PBZ.exe`'yi bırakabilirsin.

### Terminal (`--cli`)

v0.3'ün terminal modu duruyor. `--cli` tek başına save'i konsolda izler (G gizli bölümleri açar/kapatır, Q çıkar). `--show`, `--watch`, `--dump`, `--save` gibi terminal seçenekleri de terminalde çalışır:

```
pbz-tracker-v0.5.0.exe --cli         # konsolda izle; G = gizli bölümler, Q = çık
pbz-tracker-v0.5.0.exe --no-color    # bir kez oku ve yaz
pbz-tracker-v0.5.0.exe --watch       # oyun kaydettikçe yenile
pbz-tracker-v0.5.0.exe --show        # gizli bölümleri de yaz
pbz-tracker-v0.5.0.exe --exact       # uyarılarda yer ve boss adlarını yaz (yalnız ulaştığın bölgelerde)
pbz-tracker-v0.5.0.exe --no-timeline # görev zaman çizelgesini kaydetme
pbz-tracker-v0.5.0.exe --lang tr     # arayüz dili: tr ya da en (varsayılan: İngilizce; sistem dili Türkçe ve Türkçe yama kuruluysa Türkçe)
pbz-tracker-v0.5.0.exe --names en    # ad kaynağı: bulunan bir metin yaması ya da ad tablosu
pbz-tracker-v0.5.0.exe --dump        # en yeni save slotunu JSON olarak .\out klasörüne yaz (hata ayıklama)
pbz-tracker-v0.5.0.exe --ui          # pencereyi terminalden aç (--no-edge: varsayılan tarayıcı)
pbz-tracker-v0.5.0.exe --version
pbz-tracker-v0.5.0.exe --help
```

`--dump`, save'inin çözülmüş tam dökümünü yazar (`out\latest.json`). Oynama geçmişin gibi kişisel veri içerebilir; paylaşma. Oyun ya da save klasörüne yazmayı reddeder.

Oyun Steam üzerinden bulunur (kayıt defterindeki `SteamPath` → `libraryfolders.vdf` → AppID 4115450), sonra yaygın klasörlerde aranır (`<sürücü>:\SteamLibrary`, `Program Files\Steam`, `<sürücü>:\Games\PBZ`). Birden fazla Steam hesabının kaydı varsa hangisinin kullanılacağını sorar; `--steamid` ile de seçilir.

**İlk açılış:** araç oyunu kendisi bulur. Bulamazsa pencere bunu söyler; oyun klasörünü (ya da `PBZSaveGame.sav`'ı) Ayarlar sekmesinden seçersin. Terminalde bir klasör seçme penceresi açar ("Phantom Blade Zero kurulum klasörünü seç"); save de bulunamazsa `PBZSaveGame.sav` için dosya seçme penceresi açar. Seçim exe'nin yanındaki `pbz-tracker.config.json` dosyasında saklanır. Pencerenin ayarları (dil, ad kaynağı, yenileme aralığı, tam adlar, zaman çizelgesi açık/kapalı) da aynı dosyada durur. Araç bunun dışında yalnız görev zaman çizelgesini (`pbz-tracker.timeline.json`, yanında) ve isteğe bağlı `--dump` çıktısını yazar. `--pick` seçme penceresini isteyerek açar, `--forget` dosyayı siler, `--no-dialog` hiç seçme penceresi açmaz. Artık var olmayan bir yol yok sayılır. `--game` / `--save` ile çalıştırınca pencere açılmaz.

**Başka bir klasöre ya da Steam dışından mı kurulu?** Oyun klasörünü ya da save'i exe'nin üstüne bırak, ya da `--game <PBZ klasörü>` ver (gerekirse `--save` ile birlikte). Steam manifesti yoksa oyun build'i "bilinmiyor" diye gösterilir; "doğrulanmadı" uyarısı çıkmaz.

## Web sürümü (indirme yok)

Aynı takipçi bir web sayfası olarak da çalışır: **https://zziroo.github.io/pbz-tracker/** (GitHub Pages). Motor, sekmeler ve spoiler katmanları aynı; save'in exe'dekiyle aynı uyarıları verir.

- **Tamamen tarayıcında çalışır.** Hiçbir dosya yüklenmez ve sayfadan hiçbir istek çıkmaz; DevTools → Network sekmesinden kontrol edebilirsin. Sunucu tarafı olmayan statik bir sayfadır: site yalnız kendi dosyalarını sunar. İlk ziyaretten sonra çevrimdışı da çalışır.
- **Masaüstünde Chrome ya da Edge** (File System Access API): **Oyun klasörünü seç**'e tıkla ve oyun klasörünü (`…\steamapps\common\PBZ`) ya da Steam kütüphane klasörünü (`…\SteamLibrary`; kütüphane, başlıktaki oyun build'ini de verir) seç. Tarayıcı okuma izni ister. Klasörü sayfanın üstüne sürükleyip bırakabilirsin de. Sonraki ziyarette tek tık yeter: **PBZ ile devam et** (hatırlamasına izin vermezsen tarayıcı her ziyarette okuma iznini bir kez yeniden sorar).
- Save'i 3 saniyede bir kontrol eder (Ayarlar: 2–3600 sn) ve oyun kaydedince yenilenir. Arka plandaki bir sekmede tarayıcı bu kontrolleri dakikada bire kadar yavaşlatabilir; sekmeye dönünce hemen yenilenir. Oyunun yanında ayrı pencerede tutmak için uygulama olarak yükle (adres çubuğundaki yükle simgesi ya da Edge → Uygulamalar → Bu siteyi uygulama olarak yükle).
- Birden fazla Steam hesabı: hesabı Ayarlar'dan seç. Başka yerde duran bir save (ör. `%LOCALAPPDATA%\ProjectPBZ\Saved\SaveGames` altında): save dosyasını Ayarlar'dan seç.
- Anahtar tarayıcıda senin `PBZ.exe`'nden türetilir (parça parça okunur, asla bütünüyle değil). Bu tarayıcının siteye ait deposunda (IndexedDB) exe'nin boyutu ve tarihiyle eşlenerek hatırlanır; oyun güncellenince yeniden türetilir. Seçilen klasörler, ayarlar ve görev zaman çizelgesi de orada durur. Ayarlar'daki **Unut** seçilen bir klasörü ya da dosyayı (PBZ.exe için anahtarı da) siler; tarayıcıda site verilerini temizlemek her şeyi siler. Not: GitHub Pages'te aynı kullanıcının bütün projeleri tek bir kökeni (`<kullanıcı>.github.io`) paylaşır; bu tarayıcı deposu yayıncının diğer Pages projelerince de görülebilir. Ayrı bir alan adı bunu önler. Tarayıcının kendi deposu dışında diske hiçbir şey yazılmaz; oyuna, save'e ya da yedeklerine asla yazılmaz.
- **Firefox, Safari ya da Chrome klasörü reddederse** (bazı sistem klasörlerini engeller, ör. `C:\Program Files (x86)` altındaki bir Steam kütüphanesi): Ayarlar → Dosya erişimi'ni **Tek tek dosyalar** yap, sonra `PBZSaveGame.sav`'ı ve bir kez `PBZ.exe`'yi seç ya da bırak (anahtar sonra hatırlanır). İstersen metin yamasındaki adlar için `Paks` klasörünü de seç (tarayıcı buna "yükleme" diyebilir; sayfadan hiçbir şey çıkmaz). Bu modda sayfa kendiliğinden yenilenemez: oyun kaydettikten sonra save'i yeniden seç ya da bırak.
- Yapamadıkları: uygulamanın yanına konan kural ya da ad tablosu yok (kurallar gömülü; kural güncellemeleri sayfa yeniden derlenerek gelir), `--dump` yok, terminal modu yok. Telefon ve tablet desteklenmez.

## Spoiler politikası

1. **Varsayılan görünüm:** yalnız eyleme dönük uyarılar, yani önünde bir kesim noktası olan ve hâlâ açık bir kaçırılabilir. Kesim noktası adıyla değil konumuyla anlatılır. Görev adı yalnız görev günlüğünde zaten başlamışsa yazılır; başlamamışsa yalnız konum ipucu verilir. Uyarı yoksa: "Şu an kaçırma riski yok."
2. **Gizli (Günlük sekmesi; terminalde `--show` ya da G):** günlükteki görevlerin durumu, aşama sayaçları, kaçanlar, mor görev sayımı. Pencerede görev adları (sayaç ve notlarıyla) satıra tıklayana kadar bulanıktır; durum rozetleri ve sayılı bölüm başlıkları görünür kalır. Her yenilemede hepsi yeniden bulanıklaşır.
3. **Hiç gösterilmez:** save'e göre henüz ulaşılmamış her şey. Sınır her zaman aracı çalıştıranın kendi save'ine göre çizilir.

**Tam adlar (isteğe bağlı, varsayılan kapalı):** Ayarlar → "Uyarılarda yer ve boss adlarını göster" (terminalde `--exact`) kesim noktasını yer ve boss adlarıyla yazar, ama yalnız save'ine göre ulaştığın bölgelerde; diğer kesim noktaları konumla anlatılmaya devam eder.

### Tanılama ve görev zaman çizelgesi

Ayarlar'ın en altındaki **Tanılama** (kapalı gelir), save'inde olup ad tablosunun tanımadığı görevleri (sayısı panel başlığında görünür), bu save'in menzilindeki, algılanamayan kuralları, kural ve ad tablosu sürümlerini, bulunan metin yamasını, oyun build'ini ve araç sürümünü listeler. **Raporu kopyala** aynısını GitHub issue'su için düz metin olarak kopyalar; rapor yol, Steam hesap kimliği ya da kullanıcı adı içermez, save zamanından yalnız tarih yer alır.

Araç ayrıca yerel bir **görev zaman çizelgesi** tutar: her okumada ortaya çıkan ya da durumu değişen görevler eklenir (save zamanı, görev kimliği, klasör, eski ve yeni durum, değişen dallar, aşama sayacı, bölge kodu), en çok 2000 kayıt. Save'de artık olmayan bir görev için yeni durumu boş tek bir kayıt eklenir. Oyun bittikten sonra kuralları doğrulamak içindir; dışa aktarılan dosya oynama zamanlarını (save saatlerini) içerir. Exe ve `node pbz.js` bunu `pbz-tracker.config.json` dosyasının yanındaki `pbz-tracker.timeline.json` dosyasında, web sürümü tarayıcının siteye ait deposunda tutar. Tanılama'daki **Zaman çizelgesini indir** / **Zaman çizelgesini kopyala** JSON olarak verir. Orada ya da `--no-timeline` ile kapatılır (bu yalnız kaydı durdurur); **Zaman çizelgesini sil** onu siler (web sürümünde her şeyi unutmak da siler). Kendiliğinden hiçbir yere gitmez.

## Desteklenen oyun sürümü

Steam build **26367565** üzerinde doğrulandı. Başlık satırı kurulu build'i gösterir; doğrulanmamış bir build'de tek satırlık bir uyarı çıkar. Oyun güncellemesi save anahtarını değiştirdiyse araç, build numarasını da yazan açık bir hatayla durur.

## Kuralları exe'yi değiştirmeden güncelleme

Kurallar (`data/rules.json`) ve ad tabloları exe'ye gömülüdür, ama **exe'nin yanına** konan dosyalar önceliklidir:

1. Bu depodaki güncel `data/rules.json`'ı indir (Raw → `rules.json` olarak kaydet).
2. `pbz-tracker-v0.5.0.exe` ile aynı klasöre koy.
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

Web sürümü: `node build/build.js --web` statik siteyi `web/dist/` klasörüne yazar (`index.html`, değişmeden `ui/app.js` ve `ui/style.css`, `web.js` = motor ve `web/*.js` tarayıcı için paketlenmiş, `sw.js`, `manifest.webmanifest`, `icon.svg`). Sayfa yerel sunucu yerine `web/transport.js` ile konuşur (aynı sözleşme, `docs/ui-api.md`). Tarayıcı paketine bir Node modülü girerse derleme başarısız olur. `.github/workflows/pages.yml` siteyi derleyip GitHub Pages'te yayınlar (bkz. `docs/publish.md`). Yerelde denemek için `web/dist/` klasörünü `http://127.0.0.1` üzerinden sun (herhangi bir statik sunucu); `file://` adresiyle açılan sayfa klasör erişimini ve service worker'ı kullanamaz.

Pencere nasıl çalışır: `lib/server.js`, `ui/` dosyalarını ve bir JSON API'sini (sözleşme: `docs/ui-api.md`) `127.0.0.1` üzerinde, rastgele portta ve her açılışta değişen bir anahtarla sunar; `lib/browser.js` Edge'i ya da Chrome'u `--app` ile açar. Çift tıkla açılan exe kendini konsolsuz yeniden başlatır, böylece boş bir konsol penceresi açık kalmaz. Exe'ye gömme için `npx postject` kullanır; bu yalnız derleme sırasında gerekir.

Oodle DLL'ine karşı test (başka bir oyundan `oo2core_8_win64.dll` gerekir): `node test/oodle-compare.js --game <PBZ klasörü> --dll <dll>`.

## Kural tablosu (`data/rules.json`, oyunun tamamı için SPOILER içerir)

- `schemaVersion`: dosya biçimi (araç uyuşmazsa reddeder). `rulesVersion`: kural içeriğinin sürümü; her düzeltmede artır, başlıkta görünür.
- `sources`: rehberler. Her kuralda `source: {ids, checked}` alanı var; `checked: "unverified"` = kural-kaynak eşleşmesi sayfada tek tek kontrol edilmedi.
- `cutoffs`: kesim noktaları. `where` {tr,en} konumla anlatım (varsayılan görünüm), `label` adıyla (yalnız gizli bölümde, nokta geçildikten sonra), `passedWhen` geçildi mi. İsteğe bağlı `whereExact` {tr,en} aynı cümlenin yer ve boss adlı hâli; yalnız tam adlar açıkken **ve** isteğe bağlı `exactWhen` koşulu doğruyken (oyuncu o bölgeye ulaştıysa) `where` yerine kullanılır; `exactWhen` yoksa, yanlışsa ya da bilinmiyorsa `where` kalır.
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

GPL-3.0-or-later; tam metin `LICENSE` dosyasında. `lib/core/oodle/` altındaki save açma kodu, Powzix'in GPL-3.0 lisanslı [ooz](https://github.com/powzix/ooz) projesinden (`kraken.cpp`) JavaScript'e uyarlanmış türev bir çalışmadır; bu yüzden projenin tamamı GPL-3.0 altındadır. Derlenmiş exe paylaşılırken kaynak kodu da (bu depo) alıcıya sunulmalıdır.

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
