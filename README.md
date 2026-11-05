# pbz-tracker

Phantom Blade Zero için yerel, **salt okunur** kaçırılabilir takipçisi. Save dosyasını çözer, ulaştığın yere kadar olan kaçırılabilir görevleri spoilersız gösterir.

```
node pbz.js            # bir kez oku
node pbz.js --watch    # save değiştikçe yenile (oyun açıkken de çalışır)
node pbz.js --help
```

Gereken: Node 18+ (bağımlılık yok), Windows PowerShell, başka bir oyunun klasöründe `oo2core_*_win64.dll` (otomatik aranır; bulunamazsa `--oodle` ya da `PBZ_OODLE`).

## Güvenlik kuralları

- Save'e, yedeklerine ve oyun dosyalarına **asla yazmaz**. Save paylaşımlı okumayla belleğe alınır; okunurken değiştiyse, kısaysa ya da GCM doğrulaması tutmazsa kısa bekleyip yeniden dener.
- Exe yalnız okunur: anahtar her çalıştırmada exe'deki işaret dizesinden türetilir, SHA-256 öneki doğrulanır, yalnız bellekte tutulur.
- Oyun sürecine bağlanmaz, bellek okumaz.
- Oodle DLL'i yerinde kullanılır, projeye kopyalanmaz. Sıkıştırılmış slotlar `%TEMP%\pbz-tracker-*` altına yazılıp hemen silinir.
- `--dump` çözülmüş JSON'u `out/` altına yazar (git dışı); oyun klasörünü hedef kabul etmez.

## Kural tablosu (`data/rules.json`, SPOILER içerir)

- `quests`: pinyin `QuestClass` → İngilizce ad. `guess: true` = doğrulanmadı (çıktıda `*`).
- `cutoffs`: kesim noktaları. `passedWhen` geçildi mi, `revealWhen` adını göstermek güvenli mi; değilse `hint` gösterilir.
- `missables`: `quest` (pinyin; bilinmiyorsa `null`), `cutoff`, `visibleWhen`, isteğe bağlı `doneWhen` / `failedWhen`, `warn`. `type: "info"` yalnız uyarıdır.
- `trueEnding`: bir klasördeki tüm görevler (şimdilik `Branch` = mor Tale'ler, tahmin).

Koşullar üç değerlidir (doğru / yanlış / bilinmiyor): `mapUnlocked`, `levelVisited`, `bellPrefix`, `bossKilled`, `bossSeen` (`bosses` adını ya da ham `BP_Monster_*` anahtarını alır), `questSeen`, `questDone`, `questBranch` + `branch` (+ `state`, varsayılan `Completed`), `any`, `all`, `not`, `unknown`.

Durumlar: **açık**, **başlanmadı**, **tamamlandı**, **kaçtı**, **belirsiz**. Kesim noktası geçilmiş ve görev bitmemişse "kaçtı" sayılır.

## Spoiler politikası

Varsayılan çıktı yalnız kayıtta görünen görevleri, açılmış haritaları ve geçilmiş/karşılaşılmış kesim noktalarını adıyla gösterir. Henüz ulaşılmamış kesim noktaları belirsiz bir ipucuyla anlatılır. `--detay` her şeyi açar.

## Format notları

Ayrıntılar vault'ta: `10-Projects/pbz-tracker/sessions/2026-11-05-devir-save-cozumu.md`. `research/` ilk keşif betikleridir (sabit kodlu, araç değil).
