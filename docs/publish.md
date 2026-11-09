# Yayınlama

## Durum (v0.6.0)

Araç yalnız web sürümü olarak dağıtılıyor:

- Depo herkese açık: https://github.com/zziroo/pbz-tracker (GPL-3.0-or-later; GitHub lisansı `LICENSE` dosyasından tanır).
- Web sürümü GitHub Pages'te yayında: https://zziroo.github.io/pbz-tracker/ (Settings → Pages → Source: GitHub Actions). Gerçek oyunla denendi: klasör seçimi ve çanda dinlendikten sonra canlı yenileme çalışıyor.
- `lib/version.js` içindeki `REPO_URL` depo adresine ayarlı; web sürümünün Hakkında sekmesi kaynak koda bağlantı verir.
- Topluluk metinleri (`docs/posts/*`, `docs/steam-guide.bbcode.txt`, `docs/steam-guide.tr.bbcode.txt`) gerçek adreslerle dolu; Steam rehberleri yayında.

Aşağıdaki adımlar sonraki sürümler için başvuru olarak duruyor. Hepsi dışa dönük; sırayla ve elle çalıştır.

## 0. Ön kontrol

```
git status                                  # temiz olmalı
git ls-files | findstr /i /r "\.sav$ \.bin$ \.key$ \.cmp$ latest\.json AutoSave ManualSave"   # çıktı BOŞ olmalı
node test/core-portability.js               # 0 ile çıkmalı
node build/build.js                         # web/dist/ hatasız derlenmeli
```

`research/` klasörü depoda. İçinde anahtar yok, yalnız keşif betikleri var.

GitHub Pages'te aynı kullanıcının bütün projeleri tek kökeni (`zziroo.github.io`) paylaşır; web sürümünün tarayıcı deposu (klasör erişimleri, anahtar) o kökendeki diğer projelerce okunabilir. Aynı hesapta üçüncü taraf betik çalıştıran başka Pages siteleri açarsan ayrı bir alan adı kullanmak daha güvenli.

## 1. Sürümü artır ve sürüm notlarını yaz

- `lib/version.js`: `VERSION` değerini artır. Yeni bir oyun build'inde test ettiysen `TESTED_BUILDS`'e ekle.
- `docs/release-notes/v<sürüm>.md` yaz (İngilizce ve Türkçe, spoilersız).
- Topluluk metinlerinde sürüm numarası geçiyorsa güncelle.
- Commit et ve `main`'e push et. Pages iş akışı siteyi bu push'la yayınlar (4. adım).

## 2. Etiket ve release (isteğe bağlı)

Release yalnız sürüm notları ve kaynak arşivi içindir; eklenecek bir dosya yok. İstemezsen bu adımı atla, site yine yayınlanır.

```
git tag v<sürüm>
git push origin v<sürüm>
gh release create v<sürüm> --title "v<sürüm>" --notes-file docs\release-notes\v<sürüm>.md
```

GPL gereği kaynak kod depoda ve release'in otomatik kaynak arşivinde zaten var.

## 3. Web sürümünü yerelde dene (isteğe bağlı)

```
node build/build.js
```

Çıktı `web/dist/` (depoya girmez; `.gitignore`'daki `dist/` kuralı bunu da kapsar). Klasörü `http://localhost:<port>/` üzerinden herhangi bir statik sunucuyla aç (Chrome ya da Edge). `file://` ile açarsan klasör erişimi ve service worker çalışmaz.

## 4. GitHub Pages (otomatik)

Yayını `.github/workflows/pages.yml` yapar: `main`'e her push'ta (yalnız `web/`, `ui/`, `lib/`, `data/`, `build/build.js` ya da iş akışının kendisi değişince) ve elle tetiklenince (**Actions → Pages → Run workflow**) siteyi derler ve GitHub Pages'e yükler. Resmi `actions/upload-pages-artifact@v3` ve `actions/deploy-pages@v4` kullanılır; derlemeden önce `test/core-portability.js` çalışır. Elle yapılacak bir şey yok; yalnız `build` ve `deploy` işlerinin yeşil olduğunu kontrol et.

Yayından sonra kontrol: sayfayı aç, DevTools → Network'te yalnız sitenin kendi dosyalarının (index.html, app.js, style.css, web.js, sw.js, manifest.webmanifest, icon.svg) yüklendiğini gör; oyun klasörünü seç, uyarıların `node pbz.js --cli` çıktısıyla aynı olduğunu kontrol et.

## 5. Kural güncellemesi (yeni sürüm gerekmez)

`data/rules.json`'ı düzelt, `rulesVersion`'ı artır, `main`'e push et. İş akışı web sürümünü yeniden derleyip yayınlar; service worker yeni sürümü bir sonraki açılışta kullanır (dosya özetine göre önbelleği yeniler). Kural düzeltmeleri kullanıcıya yalnız bu yolla ulaşır.

## 6. Steam Rehberi, forum ve Nexus

- Metinler hazır: `docs/steam-guide.bbcode.txt` (İngilizce Steam rehberi) ve `docs/steam-guide.tr.bbcode.txt` (Türkçe Steam rehberi; Steam rehber başına tek dil kabul ettiği için iki ayrı rehber), `docs/posts/*` (Steam forumu, Reddit, Nexus; başlıklar `docs/posts/titles.txt`).
- Steam rehberleri: Topluluk Merkezi → Rehberler → rehberi düzenle. Ekran görüntülerini editörde yükleyip `[previewimg=…]` satırlarını editörün verdiği kimliklerle değiştir. EN: `docs/screenshots/web-warnings.png`, `web-journal.png`, `web-maps.png`, `web-setup.png`. TR: `web-tr-warnings.png`, `web-tr-journal.png`, `web-tr-maps.png`, `web-setup.png`.
- İki rehber birbirine bağlantı veriyor (EN → TR ve TR → EN); rehber adresi değişirse ikisini de güncelle.
- Nexus: oyunun sayfası → Upload. Dağıtılan bir program dosyası yok; mod sayfası web sürümüne ve depoya bağlantı verir.
- `[OPTIONAL: AI line]` satırlarını göndermeden önce tut ya da sil.
