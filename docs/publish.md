# Yayınlama

## Durum (v0.5.0)

İlk yayın tamamlandı:

- Depo herkese açık: https://github.com/zziroo/pbz-tracker (GPL-3.0-or-later; GitHub lisansı `LICENSE` dosyasından tanır).
- Release v0.5.0 yayında, exe ekli (`pbz-tracker-v0.5.0.exe`): https://github.com/zziroo/pbz-tracker/releases/tag/v0.5.0
- Web sürümü GitHub Pages'te yayında: https://zziroo.github.io/pbz-tracker/ (Settings → Pages → Source: GitHub Actions). Gerçek oyunla denendi: klasör seçimi ve çanda dinlendikten sonra canlı yenileme çalışıyor.
- `lib/version.js` içindeki `REPO_URL` depo adresine ayarlı; pencerenin ve web sürümünün Hakkında sekmesi kaynak koda bağlantı verir.
- Topluluk metinleri (`docs/posts/*`, `docs/steam-guide.bbcode.txt`) gerçek adreslerle dolduruldu; yalnız iki Steam rehberinin birbirine verdiği bağlantılar (`[STEAM_GUIDE_TR_URL]`, `[STEAM_GUIDE_EN_URL]`) rehberler yayınlanınca doldurulacak (6. adım).

Aşağıdaki adımlar sonraki sürümler için başvuru olarak duruyor. Hepsi dışa dönük; sırayla ve elle çalıştır.

## 0. Ön kontrol

```
git status                                  # temiz olmalı
git ls-files | findstr /i /r "\.sav$ \.bin$ \.key$ \.cmp$ latest\.json AutoSave ManualSave"   # çıktı BOŞ olmalı
```

`research/` klasörü depoda. İçinde anahtar yok, yalnız keşif betikleri var.

GitHub Pages'te aynı kullanıcının bütün projeleri tek kökeni (`zziroo.github.io`) paylaşır; web sürümünün tarayıcı deposu (klasör erişimleri, anahtar) o kökendeki diğer projelerce okunabilir. Aynı hesapta üçüncü taraf betik çalıştıran başka Pages siteleri açarsan ayrı bir alan adı kullanmak daha güvenli.

## 1. Sürümü artır ve sürüm notlarını yaz

- `lib/version.js`: `VERSION` değerini artır. Yeni bir oyun build'inde test ettiysen `TESTED_BUILDS`'e ekle.
- `docs/release-notes/v<sürüm>.md` yaz (İngilizce ve Türkçe, spoilersız).
- README'lerin başındaki exe bağlantısını ve exe adlarını (`pbz-tracker-v<sürüm>.exe`) yeni sürüme göre güncelle; topluluk metinlerindeki sürüm numarası ve release bağlantısı için de aynısı.
- Commit et ve `main`'e push et.

## 2. Exe'yi derle

```
node build/build.js
```

Çıktı: `dist\pbz-tracker-v<sürüm>.exe` (`dist/` depoya girmez). Bir kez çalıştırıp kontrol et:

```
dist\pbz-tracker-v<sürüm>.exe --version
dist\pbz-tracker-v<sürüm>.exe
```

## 3. Etiket ve release

```
git tag v<sürüm>
git push origin v<sürüm>
gh release create v<sürüm> dist\pbz-tracker-v<sürüm>.exe --title "v<sürüm>" --notes-file docs\release-notes\v<sürüm>.md
```

GPL gereği kaynak kod depoda ve release'in otomatik kaynak arşivinde zaten var.

## 4. Web sürümü (GitHub Pages, otomatik)

Web sürümü statik bir sitedir: `node build/build.js --web` → `web/dist/` (depoya girmez; `.gitignore`'daki `dist/` kuralı bunu da kapsar). Yayını `.github/workflows/pages.yml` yapar: `main`'e her push'ta (yalnız `web/`, `ui/`, `lib/`, `data/`, `build/build.js` ya da iş akışının kendisi değişince) ve elle tetiklenince (**Actions → Pages → Run workflow**) siteyi derler ve GitHub Pages'e yükler. Resmi `actions/upload-pages-artifact@v3` ve `actions/deploy-pages@v4` kullanılır; derlemeden önce `test/core-portability.js` çalışır. Elle yapılacak bir şey yok; yalnız `build` ve `deploy` işlerinin yeşil olduğunu kontrol et.

Yayından önce yerelde denemek istersen:

```
node build/build.js --web
```

`web/dist/` klasörünü `http://127.0.0.1:<port>/` üzerinden herhangi bir statik sunucuyla aç (Chrome ya da Edge). `file://` ile açarsan klasör erişimi ve service worker çalışmaz.

Yayından sonra kontrol: sayfayı aç, DevTools → Network'te yalnız sitenin kendi dosyalarının (index.html, app.js, style.css, web.js, sw.js, manifest.webmanifest, icon.svg) yüklendiğini gör; oyun klasörünü seç, uyarıların exe ile aynı olduğunu kontrol et.

## 5. Kural güncellemesi (yeni sürüm gerekmez)

`data/rules.json`'ı düzelt, `rulesVersion`'ı artır, `main`'e push et. İş akışı web sürümünü yeniden derleyip yayınlar; service worker yeni sürümü bir sonraki açılışta kullanır (dosya özetine göre önbelleği yeniler). Exe kullananlar depodaki güncel `data/rules.json`'ı exe'nin yanına koyar (README'deki "Updating the rules without a new exe" bölümü). Web sürümünde yanına konan kural dosyası yoktur.

## 6. Steam Rehberi, forum ve Nexus

- Metinler hazır: `docs/steam-guide.bbcode.txt` (İngilizce Steam rehberi) ve `docs/steam-guide.tr.bbcode.txt` (Türkçe Steam rehberi; Steam rehber başına tek dil kabul ettiği için iki ayrı rehber), `docs/posts/*` (Steam forumu, Reddit, Nexus; başlıklar `docs/posts/titles.txt`).
- Steam rehberleri: Topluluk Merkezi → Rehberler → Rehber Oluştur (EN için dil English, TR için Türkçe). Ekran görüntülerini editörde yükleyip `[IMAGE ...]` / `[GÖRSEL ...]` satırlarını editörün verdiği `[img]` etiketleriyle değiştir. EN: `docs/screenshots/web-warnings.png`, `web-journal.png`, `web-setup.png`. TR: `web-tr-warnings.png`, `web-tr-journal.png`, `web-setup.png`, `window-tr-warnings.png`.
- İki rehber de yayınlanınca çapraz bağlantıları doldur: EN rehberdeki `[STEAM_GUIDE_TR_URL]` ve TR rehberdeki `[STEAM_GUIDE_EN_URL]`.
- Nexus: oyunun sayfası → Upload. Exe'yi Nexus'a ayrıca yüklemek yerine web sürümüne ve GitHub release'e bağlantı vermek de bir seçenek.
- `[OPTIONAL: AI line]` satırlarını göndermeden önce tut ya da sil.
