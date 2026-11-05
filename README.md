# pbz-tracker

A local, **read-only**, spoiler-safe missables tracker for **Phantom Blade Zero** (PC, Steam). It reads your save and warns you only when you are about to lose something for good. Everything else stays hidden until you ask for it.

*Türkçe: [README.tr.md](README.tr.md)*

## What it does / does not do

- Reads your save, finds missable quests that are still open, and tells you which point you must not pass yet: "Before this area's final fight", not a boss name.
- **Never writes** to your save, its backups, the game folder or any patch (the only file it can write is the optional `--dump` output). The save is read with shared access, so the game can stay open.
- **No network access.** No telemetry, no update check.
- **Contains no key and no personal data.** The save key is derived on each run from *your own* `PBZ.exe` and kept in memory only. The exe contains no SteamID, save data or key; the build fails and deletes the exe if it finds the builder's home path, user name or a SteamID64 in it (`node build/build.js --check <exe>` runs the same scan).
- Does not attach to the game process and does not read its memory.

## Install

Download `pbz-tracker-v0.3.0.exe` from the Releases page. It is a single file with nothing to install. Run it from a terminal (Windows Terminal, PowerShell or cmd).

Windows SmartScreen may warn on first run because the exe is not code-signed. Choose "More info → Run anyway", or build it yourself from source (see below).

## Usage

**Double-click the exe to open it, or drop your save file onto it.** It then watches your save and keeps the window open: G toggles the hidden sections, Q quits. You can drop `PBZSaveGame.sav`, your account folder under `SaveGames\Steam`, the game folder or `PBZ.exe`.

From a terminal:

```
pbz-tracker-v0.3.0.exe             # read once
pbz-tracker-v0.3.0.exe --watch     # refresh whenever the game saves; G = toggle hidden sections, Q = quit
pbz-tracker-v0.3.0.exe --show      # also print the hidden sections
pbz-tracker-v0.3.0.exe --lang en   # UI language: en or tr (default: system language)
pbz-tracker-v0.3.0.exe --names en  # name source: a detected text patch or a name table
pbz-tracker-v0.3.0.exe --dump        # write the newest save slot as JSON to .\out (debugging)
pbz-tracker-v0.3.0.exe --version
pbz-tracker-v0.3.0.exe --help
```

`--dump` writes a full, decrypted dump of your save (`out\latest.json`). It may contain personal data such as your play history; do not share it. It refuses to write into the game or save folder.

The game is found through Steam (registry `SteamPath` → `libraryfolders.vdf` → AppID 4115450), then in common folders (`<drive>:\SteamLibrary`, `Program Files\Steam`, `<drive>:\Games\PBZ`). If saves from several Steam accounts exist, the tool asks which one to use, or you can pass `--steamid`.

**Installed elsewhere, or not through Steam?** Drop the game folder or the save onto the exe, or pass `--game <PBZ folder>` (plus `--save` if needed). Without a Steam manifest the game build is shown as unknown, without an "untested" warning.

## Spoiler policy

1. **Default view:** only actionable warnings, meaning a cutoff ahead of you with something still open. Cutoffs are described by position, never by name. A quest is named only if it already appears in your journal; otherwise you get a location hint. With nothing at risk you see: "No risk of missing anything right now."
2. **Hidden (`--show`, or G in watch mode):** journal status, step counters, missed items, purple-quest tally. In watch mode it closes again on every refresh.
3. **Never shown:** anything your save says you have not reached. The line is always drawn from the save of the person running the tool.

## Supported game build

Verified on Steam build **26367565**. The header shows the installed build. On an untested build it shows a one-line warning. If the game update changed the save key, the tool stops with a clear error that names the build.

## Updating the rules without a new exe

The rules (`data/rules.json`) and name tables are built into the exe, but files placed **next to the exe** take precedence:

1. Download the latest `data/rules.json` from this repository (Raw → save as `rules.json`).
2. Put it in the same folder as `pbz-tracker-v0.3.0.exe`.
3. Run the tool. The header says `Rules: rules.json next to the app (version …)`.

Name tables work the same way: a `names.<lang>.json` next to the exe replaces or adds that language. You can also pass a rules file explicitly with `--rules <path>`. A broken file, or one written for a different rules format (`schemaVersion`), stops the tool with an error instead of silently using the built-in copy. Delete the file to go back to the built-in rules. The tool itself never downloads anything.

## Names and languages

- UI language (`--lang`) and name source (`--names`) are independent.
- A text patch in `ProjectPBZ\Content\Paks` (an unencrypted `.pak` carrying `Localization/Game/<culture>/Game.locres`, for example a fan translation) is detected and used for names at runtime, read-only. Supported: paks with a legacy index (v1–v9), or small (≤ 32 MB) uncompressed paks of any version. The official game paks (v12) are skipped.
- Without a patch, names come from `data/names.<lang>.json`. English is complete; missing names fall back to English with a one-line notice.
- To contribute a name table, see the Turkish README section "Ad tablosuna katkı". In short: copy `data/names.en.json` to `names.<lang>.json`, translate the values, and add one line to `TABLES` in `lib/names.js`.

## Build from source

Node 18+ with no dependencies: `node pbz.js [options]`.

Single exe: `node build/build.js` writes `dist/pbz-tracker-v<version>.exe`. It bundles the sources into one script, then makes a Node single executable application. The build step uses `npx postject`; this happens at build time only.

Test against the Oodle DLL (needs a copy of `oo2core_8_win64.dll` from another game): `node test/oodle-compare.js --game <PBZ folder> --dll <dll>`.

`data/rules.json` contains spoilers for the whole game.

### Rule syntax (`data/rules.json`)

- `schemaVersion`: file format (the tool refuses a mismatch). `rulesVersion`: version of the rule content; bump it on every fix, it is shown in the header.
- `sources`: guide registry. Each rule has `source: {ids, checked}`; `checked: "unverified"` means the rule-to-guide mapping was not checked page by page.
- `cutoffs`: points of no return. `where` {tr,en} describes the point by position (default view); `label` names it (hidden section only, after the point is passed); `passedWhen` is the condition for "passed".
- `missables`: `quest` (pinyin id from the save, or `null`), `cutoff`, `visibleWhen`, optional `doneWhen` / `failedWhen`, `hintNotStarted` {tr,en}, `warn` {tr,en}, `detect: false` (cannot be read from the save). `type: "info"` rules are plain warnings: `warn` is the anonymous text (default view), `warnNamed` the named one (hidden section), `activeWhen` keeps them in the default view.
- `trueEnding`: explicit list of true-ending purple quests; entries without a known pinyin id are never shown.

Conditions are three-valued (true / false / unknown): `mapUnlocked`, `levelVisited`, `currentLevel`, `bellPrefix`, `bossKilled`, `bossSeen`, `questSeen`, `questDone`, `questBranch` + `branch` (+ `state`), `any`, `all`, `not`, `unknown`.

## License

GPL-3.0-or-later (see `LICENSE`). The save decompressor in `lib/oodle/` is a JavaScript port of Powzix's [ooz](https://github.com/powzix/ooz) (GPL-3.0-or-later). When you share the exe, make the source (this repository) available too.

## Sources and thanks

Missable rules were compiled from public guides. Each rule's `source` in `data/rules.json` says which ones it came from and how the mapping was checked.

- Game8 — missables: https://game8.co/games/Phantom-Blade-Zero/archives/634952
- PowerPyx — trophy guide & roadmap: https://powerpyx.com/phantom-blade-zero-trophy-guide-roadmap
- DTGRE (https://www.dtgre.com) — missable quests and true ending guides. Exact page URLs are only in `data/rules.json`, because the addresses themselves contain spoilers.
- Maxroll (true ending), allthings.how (missables), Showgamer (missables): URLs to be added.

Technical:

- [ooz](https://github.com/powzix/ooz) by Powzix (Oodle decompression).
- Save format write-ups: phantombladezerosaves.com/save-file-format and a dev.to article (URL to be added).

Not affiliated with S-GAME. Phantom Blade Zero is a trademark of its owners.
