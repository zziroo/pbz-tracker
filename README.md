# pbz-tracker

A local, **read-only**, spoiler-safe missables tracker for **Phantom Blade Zero** (PC, Steam). It reads your save and warns you only when you are about to lose something for good. Everything else stays hidden until you ask for it.

*Türkçe: [README.tr.md](README.tr.md)*

## What it does / does not do

- Reads your save, finds missable quests that are still open, and tells you which point you must not pass yet: "Before this area's final fight", not a boss name.
- **Never writes** to your save, its backups, the game folder or any patch. It writes only `pbz-tracker.config.json` next to the exe (paths you chose in a picker, and the window's settings) and the optional `--dump` output. The save is read with shared access, so the game can stay open.
- **No internet access.** No telemetry, no update check. The window talks to a small server inside the tool that listens on `127.0.0.1` only (this computer), on a random port, with a random key per start. Nothing else on the network can reach it, and the tool itself makes no internet connections. Links in the About tab open in your normal browser only when you click them.
- **Contains no key and no personal data.** The save key is derived on each run from *your own* `PBZ.exe` and kept in memory only. The exe contains no SteamID, save data or key; the build fails and deletes the exe if it finds the builder's home path, user name or a SteamID64 in it (`node build/build.js --check <exe>` runs the same scan).
- Does not attach to the game process and does not read its memory.

## Install

Download `pbz-tracker-v0.4.0.exe` from the Releases page. It is a single file with nothing to install.

Windows SmartScreen may warn on first run because the exe is not code-signed. Choose "More info → Run anyway", or build it yourself from source (see below).

## Usage

**Double-click the exe; a window opens.** You can also drop your save file onto it. The window refreshes on its own whenever the game saves, so you can keep it open next to the game.

![Warnings tab](docs/screenshots/ui-warnings.png)

- **Warnings** (default tab): only what you are about to lose, or "No risk of missing anything right now."
- **Journal**: status of the quests in your journal, step counters, missed items and the purple-quest tally. Names are blurred until you click a row; any refresh blurs them again.
- **Settings**: language (TR/EN), name source, refresh interval, and the game folder / save file (choose or forget).
- **About**: version, tested game build, license, guide links.

![Journal tab, blurred](docs/screenshots/ui-journal.png)

The window is Microsoft Edge (or Chrome) in app mode, without tabs or an address bar. Without Edge or Chrome the page opens in your default browser. Closing the window ends the tool within about 10 seconds. You can drop `PBZSaveGame.sav`, your account folder under `SaveGames\Steam`, the game folder or `PBZ.exe` onto the exe.

### Terminal (`--cli`)

The v0.3 terminal mode is still there. `--cli` alone watches the save in the console (G toggles the hidden sections, Q quits). Any terminal option such as `--show`, `--watch`, `--dump` or `--save` also runs in the terminal:

```
pbz-tracker-v0.4.0.exe --cli         # watch in the console; G = toggle hidden sections, Q = quit
pbz-tracker-v0.4.0.exe --no-color    # read once and print
pbz-tracker-v0.4.0.exe --watch       # refresh whenever the game saves
pbz-tracker-v0.4.0.exe --show        # also print the hidden sections
pbz-tracker-v0.4.0.exe --lang en     # UI language: en or tr (default: English; Turkish when the system language is Turkish and the Turkish fan patch is installed)
pbz-tracker-v0.4.0.exe --names en    # name source: a detected text patch or a name table
pbz-tracker-v0.4.0.exe --dump        # write the newest save slot as JSON to .\out (debugging)
pbz-tracker-v0.4.0.exe --ui          # open the window from a terminal (--no-edge: default browser)
pbz-tracker-v0.4.0.exe --version
pbz-tracker-v0.4.0.exe --help
```

`--dump` writes a full, decrypted dump of your save (`out\latest.json`). It may contain personal data such as your play history; do not share it. It refuses to write into the game or save folder.

The game is found through Steam (registry `SteamPath` → `libraryfolders.vdf` → AppID 4115450), then in common folders (`<drive>:\SteamLibrary`, `Program Files\Steam`, `<drive>:\Games\PBZ`). If saves from several Steam accounts exist, the tool asks which one to use, or you can pass `--steamid`.

**First run:** the tool finds the game on its own. If it cannot, the window says so and you choose the game folder (or `PBZSaveGame.sav`) in Settings. In the terminal it opens a folder picker ("select the Phantom Blade Zero install folder"), and, if the save is not found either, a file picker for `PBZSaveGame.sav`. The choice is remembered in `pbz-tracker.config.json` next to the exe. The window's settings (language, name source, refresh interval) are stored in the same file. It is the only file the tool writes apart from the optional `--dump` output. `--pick` opens the picker on purpose, `--forget` deletes the file, and `--no-dialog` never opens a picker. A remembered path that no longer exists is ignored. Runs with `--game` / `--save` never open a picker.

**Installed elsewhere, or not through Steam?** Drop the game folder or the save onto the exe, or pass `--game <PBZ folder>` (plus `--save` if needed). Without a Steam manifest the game build is shown as unknown, without an "untested" warning.

## Web version (nothing to download)

The same tracker also runs as a web page: **https://zziroo.github.io/pbz-tracker/** (GitHub Pages). Same engine, same tabs, same spoiler layers; your save gives the same warnings as in the exe.

- **Runs entirely in your browser.** No file is uploaded and no request leaves the page; you can check this in DevTools → Network. It is a static page with no server side: the site only serves its own files. After the first visit it also works offline.
- **Chrome or Edge on the desktop** (File System Access API): click **Choose game folder** and pick the game folder (`…\steamapps\common\PBZ`) or your Steam library folder (`…\SteamLibrary`; the library also gives the game build for the header). The browser asks for read access. You can also drag the folder onto the page. On the next visit one click, **Continue with PBZ**, is enough (the browser asks again for read access once per visit unless you let it remember).
- It checks the save every 3 seconds (Settings: 2–3600 s) and refreshes when the game saves. In a background tab the browser may slow these checks down to about once a minute; switching back to the tab refreshes at once. Install it as an app (the install icon in the address bar, or Edge → Apps → Install this site as an app) to keep it in its own window next to the game.
- Several Steam accounts: choose the account in Settings. A save stored elsewhere (for example under `%LOCALAPPDATA%\ProjectPBZ\Saved\SaveGames`): choose the save file in Settings.
- The key is derived from your own `PBZ.exe` in the browser (read in chunks, never as a whole). It is remembered in this browser's storage for the site (IndexedDB), looked up by the exe's size and date, so a game update triggers a new derivation. The chosen folders and the settings are stored there too. **Forget** in Settings removes a chosen folder or file (and, for PBZ.exe, the key); clearing the site data in the browser removes everything. Note: on GitHub Pages every project of the same user shares one origin (`<user>.github.io`), so that browser storage is visible to the publisher's other Pages projects; a dedicated custom domain avoids this. Nothing is written to disk outside the browser's own storage, and nothing is ever written to the game, the save or its backups.
- **Firefox, Safari, or if Chrome refuses the folder** (it blocks some system folders, such as a Steam library under `C:\Program Files (x86)`): switch Settings → File access to **Single files**, then choose or drop `PBZSaveGame.sav` and, once, `PBZ.exe` (the key is then remembered). Optionally choose the `Paks` folder for names from a text patch (the browser may call this an "upload"; nothing leaves the page). In this mode the page cannot refresh by itself: after the game saves, choose or drop the save again.
- What it cannot do: no rules or name tables next to the app (the rules are built in; rule updates ship by rebuilding the page), no `--dump`, no terminal mode. Phones and tablets are not supported.

## Spoiler policy

1. **Default view:** only actionable warnings, meaning a cutoff ahead of you with something still open. Cutoffs are described by position, never by name. A quest is named only if it already appears in your journal; otherwise you get a location hint. With nothing at risk you see: "No risk of missing anything right now."
2. **Hidden (Journal tab; `--show` or G in the terminal):** journal status, step counters, missed items, purple-quest tally. In the window, quest names (with their counters and notes) are blurred until you click a row; status badges and section titles with their counts stay visible. Everything is blurred again on every refresh.
3. **Never shown:** anything your save says you have not reached. The line is always drawn from the save of the person running the tool.

## Supported game build

Verified on Steam build **26367565**. The header shows the installed build. On an untested build it shows a one-line warning. If the game update changed the save key, the tool stops with a clear error that names the build.

## Updating the rules without a new exe

The rules (`data/rules.json`) and name tables are built into the exe, but files placed **next to the exe** take precedence:

1. Download the latest `data/rules.json` from this repository (Raw → save as `rules.json`).
2. Put it in the same folder as `pbz-tracker-v0.4.0.exe`.
3. Run the tool. The header says `Rules: rules.json next to the app (version …)`.

Name tables work the same way: a `names.<lang>.json` next to the exe replaces or adds that language. You can also pass a rules file explicitly with `--rules <path>`. A broken file, or one written for a different rules format (`schemaVersion`), stops the tool with an error instead of silently using the built-in copy. Delete the file to go back to the built-in rules. The tool itself never downloads anything.

## Names and languages

- UI language (`--lang`) and name source (`--names`) are independent. Default: English UI with the official English names. When the system language is Turkish and the Turkish fan patch is installed, the tool starts in Turkish and reads Turkish names from the patch. An explicit `--lang` or the language chosen in the window always wins.
- A text patch in `ProjectPBZ\Content\Paks` (an unencrypted `.pak` carrying `Localization/Game/<culture>/Game.locres`, for example a fan translation) is detected and used for names at runtime, read-only. Supported: paks with a legacy index (v1–v9), or small (≤ 32 MB) uncompressed paks of any version. The official game paks (v12) are skipped.
- Without a patch, names come from `data/names.<lang>.json`. English is complete; missing names fall back to English with a one-line notice.
- To contribute a name table, see the Turkish README section "Ad tablosuna katkı". In short: copy `data/names.en.json` to `names.<lang>.json`, translate the values, and add one line to `TABLES` in `lib/names.js`.

## Build from source

Node 18+ with no dependencies: `node pbz.js` opens the window (the page is read from `ui/`), `node pbz.js --cli [options]` runs in the terminal.

Single exe: `node build/build.js` writes `dist/pbz-tracker-v<version>.exe`. It bundles the sources and the page files in `ui/` into one script, then makes a Node single executable application. `node build/build.js --bundle-only` writes only the script (`dist/pbz-tracker.js`).

Web version: `node build/build.js --web` writes the static site to `web/dist/` (`index.html`, the unchanged `ui/app.js` and `ui/style.css`, `web.js` = the engine plus `web/*.js` bundled for the browser, `sw.js`, `manifest.webmanifest`, `icon.svg`). The page talks to `web/transport.js` instead of the local server (same contract, `docs/ui-api.md`). The build fails if a Node built-in ends up in the browser bundle. `.github/workflows/pages.yml` builds and publishes it on GitHub Pages (see `docs/publish.md`). To try it locally, serve `web/dist/` over `http://127.0.0.1` (any static server); a page opened as a `file://` URL cannot use folder access or the service worker.

How the window works: `lib/server.js` serves `ui/` and a JSON API (contract: `docs/ui-api.md`) on `127.0.0.1` with a random port and a per-start token; `lib/browser.js` opens Edge or Chrome with `--app`. The exe started by double-click re-launches itself without a console, so no empty console window stays open. The build step uses `npx postject`; this happens at build time only.

Test against the Oodle DLL (needs a copy of `oo2core_8_win64.dll` from another game): `node test/oodle-compare.js --game <PBZ folder> --dll <dll>`.

`data/rules.json` contains spoilers for the whole game.

### Rule syntax (`data/rules.json`)

- `schemaVersion`: file format (the tool refuses a mismatch). `rulesVersion`: version of the rule content; bump it on every fix, it is shown in the header.
- `sources`: guide registry. Each rule has `source: {ids, checked}`; `checked: "unverified"` means the rule-to-guide mapping was not checked page by page.
- `cutoffs`: points of no return. `where` {tr,en} describes the point by position (default view); `label` names it (hidden section only, after the point is passed); `passedWhen` is the condition for "passed".
- `missables`: `quest` (pinyin id from the save, or `null`), `cutoff`, `visibleWhen`, optional `doneWhen` / `failedWhen`, `hintNotStarted` {tr,en}, `warn` {tr,en}, `detect: false` (cannot be read from the save). `type: "info"` rules are plain warnings: `warn` is the anonymous text (default view), `warnNamed` the named one (hidden section), `activeWhen` keeps them in the default view.
- `trueEnding`: explicit list of true-ending purple quests; entries without a known pinyin id are never shown.

Conditions are three-valued (true / false / unknown): `mapUnlocked`, `levelVisited`, `currentLevel`, `bellPrefix`, `bossKilled`, `bossSeen`, `questSeen`, `questDone`, `questBranch` + `branch` (+ `state`), `any`, `all`, `not`, `unknown`.

## Known limits

- Some later cutoffs cannot be detected from the save yet; their warnings rely on quest state and positional wording.
- Guides disagree on one story cutoff: some say entering a later story area closes certain lake-side quests, while players on the Steam forum report that the real point of no return comes near the end, with an explicit in-game warning. The tool keeps the stricter rule, marked as a guess, until it can be checked from a save.
- Some guides also list two optional boss fights as true-ending requirements. They are not tracked yet (unverified).
- A few quest-name mappings are inferred and marked `*`; one warning's wording (the camp warning) is unverified.

## License

GPL-3.0-or-later (see `LICENSE`). The save decompressor in `lib/core/oodle/` is a JavaScript port of Powzix's [ooz](https://github.com/powzix/ooz) (GPL-3.0-or-later). When you share the exe, make the source (this repository) available too.

## Sources and thanks

Missable rules were compiled from public guides. Each rule's `source` in `data/rules.json` says which ones it came from and how the mapping was checked.

- Game8 — missables: https://game8.co/games/Phantom-Blade-Zero/archives/634952
- PowerPyx — trophy guide & roadmap: https://powerpyx.com/phantom-blade-zero-trophy-guide-roadmap
- DTGRE (https://www.dtgre.com) — missable quests and true ending guides. Exact page URLs are only in `data/rules.json`, because the addresses themselves contain spoilers.
- Steam Community — Phantom Blade Zero guides: https://steamcommunity.com/app/4115450/guides/ and the forum thread on the point of no return: https://steamcommunity.com/app/4115450/discussions/0/572679490124259489/
- Maxroll (true ending), allthings.how (missables), Showgamer (missables): URLs to be added.

Technical:

- [ooz](https://github.com/powzix/ooz) by Powzix (Oodle decompression).
- Save format write-ups: phantombladezerosaves.com/save-file-format and a dev.to article (URL to be added).

Not affiliated with S-GAME. Phantom Blade Zero is a trademark of its owners.
