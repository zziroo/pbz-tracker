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

- Türkçe: çalışma anında Türkçe yamanın `ProjectPBZ\Content\Paks\ProjectPBZ-Windows_C.pak` içindeki `Game.locres` dosyasından okunur (salt okunur). Yama yoksa İngilizce'ye düşer ve bunu bir kez söyler.
- İngilizce: `data/names.json` içindeki resmi adlar (Game8, Maxroll, PowerPyx vb. rehberler).
- `data/names.json`: pinyin görev kodu → locres anahtarı + İngilizce ad. Türkçe metin depoda tutulmaz.

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
