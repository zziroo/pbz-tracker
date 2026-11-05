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

## Depo adresini araca yaz (yayından önce)

`lib/version.js` içindeki `REPO_URL`'i deponun adresiyle doldur (ör. `https://github.com/<kullanıcı>/pbz-tracker`) ve commit et. Böylece pencerenin ve web sürümünün Hakkında sekmesi kaynak koda bağlantı verir (adres izin listesine de girer). Web sürümünün adresi README'lerde `https://zziroo.github.io/pbz-tracker/` olarak yazılı; depo adı ya da kullanıcı farklıysa onu da düzelt.

GitHub Pages'te aynı kullanıcının bütün projeleri tek kökeni (`<kullanıcı>.github.io`) paylaşır; web sürümünün tarayıcı deposu (klasör erişimleri, anahtar) o kökendeki diğer projelerce okunabilir. Aynı hesapta üçüncü taraf betik çalıştıran başka Pages siteleri varsa ayrı bir alan adı kullanmak daha güvenli.

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

## 5. Web sürümü (GitHub Pages)

Web sürümü statik bir sitedir: `node build/build.js --web` → `web/dist/` (depoya girmez; `.gitignore`'daki `dist/` kuralı bunu da kapsar). Yayını `.github/workflows/pages.yml` yapar: `main`'e her push'ta (yalnız `web/`, `ui/`, `lib/`, `data/`, `build/build.js` ya da iş akışının kendisi değişince) ve elle tetiklenince siteyi derler ve GitHub Pages'e yükler. Resmi `actions/upload-pages-artifact@v3` ve `actions/deploy-pages@v4` kullanılır; derlemeden önce `test/core-portability.js` çalışır.

Bunları sen yaparsın (hiçbiri otomatik yapılmadı):

1. Önce yerelde dene:
   ```
   node build/build.js --web
   ```
   `web/dist/` klasörünü `http://127.0.0.1:<port>/` üzerinden herhangi bir statik sunucuyla aç (Chrome ya da Edge). `file://` ile açarsan klasör erişimi ve service worker çalışmaz.
2. Depo GitHub'da olmalı (2. adım) ve iş akışı dosyası `main`'de bulunmalı.
3. GitHub → depo → **Settings → Pages → Build and deployment → Source: GitHub Actions**. (Depo herkese açık değilse Pages ücretli plan ister.)
4. İlk yayın: ya `main`'e bir push yap, ya da **Actions → Pages → Run workflow** ile elle başlat. `build` ve `deploy` işleri yeşil olunca site `https://<kullanıcı>.github.io/pbz-tracker/` adresindedir (bu depoda: `https://zziroo.github.io/pbz-tracker/`). Adres README'lerdeki "Web version / Web sürümü" bölümünde yazılı; depo adı ya da kullanıcı farklıysa oradaki adresi düzelt.
5. Kontrol: sayfayı aç, DevTools → Network'te yalnız sitenin kendi dosyalarının (index.html, app.js, style.css, web.js, sw.js, manifest.webmanifest, icon.svg) yüklendiğini gör; oyun klasörünü seç, uyarıların exe ile aynı olduğunu kontrol et.

Kural güncellemesi: `data/rules.json`'ı düzelt, `rulesVersion`'ı artır, push et; iş akışı siteyi yeniden derler. Service worker yeni sürümü bir sonraki açılışta kullanır (dosya özetine göre önbelleği yeniler). Web sürümünde yanına konan kural dosyası yoktur.

## 6. Sonraki sürüm

- `lib/version.js`: `VERSION` değerini artır. Yeni bir oyun build'inde test ettiysen `TESTED_BUILDS`'e ekle.
- `docs/release-notes/v<sürüm>.md` yaz, sonra 1 ve 3. adımları tekrarla.
