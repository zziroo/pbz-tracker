# Yayınlama adımları (elle)

Bu adımların hiçbiri otomatik yapılmadı. Hepsi dışa dönük; sırayla ve elle çalıştır.

## 0. Ön kontrol

```
git status                                  # temiz olmalı
git ls-files | findstr /i /r "\.sav$ \.bin$ \.key$ \.cmp$ latest\.json AutoSave ManualSave"   # çıktı BOŞ olmalı
```

`research/` klasörü depoda. İçinde anahtar yok, yalnız keşif betikleri var. Yayımlamak istemezsen önce `git rm -r research` çalıştır.

### Geçmiş ve e-posta

İlk push tüm commit geçmişini yayınlar: her commit'teki yazar e-postası ve eski sürümlerdeki bazı yerel yollar (ör. eski bir `research/decompress.ps1` yorumundaki Steam kütüphanesi yolu) görünür. İzlenen dosyaların son hâli temiz. İstemezsen iki seçenek var:

- Geçmişi tek commit'e indir (yeni, temiz bir başlangıç):
  ```
  git checkout --orphan release && git add -A && git commit -m "pbz-tracker v0.3.0" && git branch -M release main
  ```
  Bundan önce `git config user.email <kullanıcı>@users.noreply.github.com` ile GitHub'ın noreply adresini ayarla.
- Ya da geçmişi olduğu gibi bırak.

Bu karar push'tan önce verilmeli; push'tan sonra geri almak zor.

## 1. Exe'yi derle

```
node build/build.js
```

Çıktı: `dist\pbz-tracker-v0.3.0.exe` (`dist/` depoya girmez). Bir kez çalıştırıp kontrol et:

```
dist\pbz-tracker-v0.3.0.exe --version
dist\pbz-tracker-v0.3.0.exe
```

## 2. GitHub deposu (herkese açık, GPL-3.0)

```
gh repo create pbz-tracker --public --source . --description "Spoiler-safe, read-only missables tracker for Phantom Blade Zero (PC)" --push
```

GitHub lisansı `LICENSE` dosyasından GPL-3.0 olarak tanır.

## 3. Release ve exe

```
git tag v0.3.0
git push origin v0.3.0
gh release create v0.3.0 dist\pbz-tracker-v0.3.0.exe --title "v0.3.0" --notes-file docs\release-notes\v0.3.0.md
```

GPL gereği kaynak kod depoda ve release'in otomatik kaynak arşivinde zaten var.

## 4. Steam Rehberi ve Nexus

- `docs/steam-guide.md` ve `docs/nexus.md` taslaklarındaki `[GITHUB REPO LINK]` ve `[GITHUB RELEASE LINK]` yer tutucularını gerçek adreslerle değiştir.
- Steam: Topluluk Merkezi → Rehberler → Rehber Oluştur.
- Nexus: oyunun sayfası → Upload. Exe'yi Nexus'a ayrıca yüklemek yerine GitHub release'e bağlantı vermek de bir seçenek.

## 5. Sonraki sürüm

- `lib/version.js`: `VERSION` değerini artır. Yeni bir oyun build'inde test ettiysen `TESTED_BUILDS`'e ekle.
- `docs/release-notes/v<sürüm>.md` yaz, sonra 1 ve 3. adımları tekrarla.
