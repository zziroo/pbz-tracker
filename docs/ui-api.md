# pbz-tracker — page ↔ transport contract

The page is a static page (`ui/index.html`, `ui/app.js`, `ui/style.css`). It is only built for the web
version: `node build/build.js` (or `--web`) writes `web/dist/`, where `web.js` (the bundle of `web/main.js`)
is loaded before `app.js` and installs `window.PBZ_TRANSPORT` (`web/transport.js`). The page talks to that
object only; there is no server, no `fetch` and no `EventSource`. Everything runs in the browser. The bundle
embeds the compact map-completion table (`lib/completion.js` `buildTable` over `data/game/`) in place of
`lib/map-table.js`; the game-data tables themselves are never bundled.

## Page constraints

- The web build puts a CSP meta tag into `index.html` (`WEB_CSP` in `build/build.js`):
  `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'`.
  Therefore **no inline scripts or inline styles** in the page (`style="..."` attributes are also blocked; use classes).
- All paths in `ui/index.html` are rewritten to relative ones by the build (GitHub Pages serves the site from a sub-folder).
- Every string from the transport goes through `textContent`.

## Strings

All content strings (warnings, quest names, status labels, notices, header lines) come **already
localized** from the transport in the current UI language. The page only holds its own chrome strings
(tab names, buttons, the blur notice, settings labels) in a small TR/EN dictionary in `app.js`, keyed by
`state.ui.lang`. Changing the language = `postSettings({ uiLang })`; the transport then delivers a new state.

## Transport interface

`window.PBZ_TRANSPORT` must exist before `app.js` runs (the page throws otherwise). Every method returns a
Promise unless noted.

| Method | Result | Notes |
|---|---|---|
| `getState()` | `State` | The current state (first paint). |
| `subscribe(onState)` | – | Calls `onState(State)` whenever the save or the settings change. |
| `getSettings()` | `Settings` | |
| `postSettings(patch)` | `Settings` | `patch`: `{ uiLang?: 'tr'\|'en', names?: string, interval?: number, exact?: boolean, timeline?: boolean, [extraField id]?: string }`. Rejects on an invalid value. `exact` re-evaluates the last read (warnings name places and bosses for areas already reached; `exactWhen` in `data/rules.json`) and delivers a new state; `timeline` takes effect with the next read. |
| `pick(what)` | `{ ok: boolean, path: string \| null, error: string \| null }` | `what` is a path row id (`Settings.paths[].what`); `path` is the chosen file or folder name. `ok: false` with `error: null` = cancelled. |
| `forget(what)` | `Settings` | A path row id, or `'all'` (also deletes the quest timeline). |
| `openUrl(url)` | – | Opens the URL in a new tab. Only the allow-list (`lib/links.js` `allowedUrls`: the repository URL and the `About.links` URLs) is accepted; anything else rejects. |
| `getAbout()` | `About` | |
| `getDiagnostics?()` | `Diagnostics` | Without it the Settings tab has no Diagnostics panel. |
| `getTimeline?()` | `TimelineExport` | The page saves it through a Blob URL (Export) or copies it. |
| `deleteTimeline?()` | `{ ok: boolean, count: number }` | Removes the stored timeline and resets the snapshot, so the next read records a fresh baseline. Turning the `timeline` setting off only stops recording; it never deletes. |
| `action?(id)` | – | Buttons of `State.actions` (`pickGame`, `pickSave`, `pickExe`, `useFiles`, `resume`). Called inside the click, because browser pickers and permission prompts need a user gesture. |

`Diagnostics` is built by `lib/diagnostics.js`. No personal data: no paths, no Steam account ids or folder
names, no user names, no key material; of the save time only the date. `report` is the same as plain text
(English) for a GitHub issue.

The web transport keeps the settings, the chosen file handles, the derived key and the quest timeline
(key `timeline`, `lib/timeline.js`) in IndexedDB (`web/store.js`); it makes no network requests.

## Types

```ts
type Status = 'open' | 'notStarted' | 'done' | 'missed' | 'unknown';
type Category = 'bell' | 'weapon' | 'phantomEdge' | 'accessory' | 'medicine' | 'challenge' | 'amber' | 'blackstone' | 'flower';

interface State {
  ok: boolean;                 // false → show `error` prominently, keep the rest of the page usable (Settings!)
  error: string | null;        // localized one-line message (e.g. game not found → hint to use Settings)
  errorKind?: 'setup' | 'busy' | null;  // setup → calmer accent box; busy → spinner without buttons; else the red error box
  actions?: Array<{ id: string; label: string; primary?: boolean }>;  // buttons in that box → transport.action(id)
  readAt: string | null;       // ISO time the save was last decoded (page shows "last refresh: 12 s ago")
  ui: { lang: 'tr' | 'en' };
  header: {
    saveTime: string;          // "05.11.2026 03:37" (game save time)
    playTime: string;          // "12:01"
    location: string | null;   // localized region name or null: the region map of the last bell used (else the last map
                               // unlocked); if that map code has no name yet, the region whose bell prefix
                               // (names.json regions[].bellPrefixes, Bell_<prefix>_…) matches the last bell used.
                               // Never the level name (one level can hold several regions)
    locationNote?: string | null; // localized source of `location`, e.g. "last bell used"; the page shows it in brackets
    build: { id: string | null; tested: boolean; text: string; quiet?: boolean };  // text = localized header line; quiet: unknown build without the "untested" colour
    notices: string[];         // localized one-liners: patch found, name fallback, rules source/version ...
  } | null;                    // null when ok === false and nothing was ever read
  // Layer 1 (always visible)
  noRisk: boolean;             // true → big calm "no risk right now" text (`noRiskText`)
  noRiskText: string;
  warnings: Array<{
    where: string;             // positional cutoff text, e.g. "Before this area's final fight"
    items: Array<{ text: string; note: string | null; hint?: string | null }>;  // named started quests, location hints, counts
                               // hint: only on a named started quest whose rule has `hintStarted` (what is left to
                               // do, localized); the page shows it as a muted sub-line under the name. Missing → none.
  }>;
  info: string[];              // anonymous info warnings (e.g. the camp warning)
  groups: Array<{              // the same warnings + info, grouped by game region (rules.json `regions`); only
                               // non-empty groups, in order: the region the player is in, other reached regions
                               // in story order, then at most ONE 'endgame' group (region.endgame: true) holding
                               // the cutoff-group warnings whose cutoff is the end-of-game cutoff
                               // (rules.trueEnding.cutoff: named quests, hints, counts, the purple-quest count;
                               // info tips stay in their region), then ONE anonymous 'later' group for everything
                               // else in unreached regions (never named: a spoiler). Missing (older transport)
                               // → render warnings/info.
    region: { id: string; name: string | null; current: boolean; reached: boolean; endgame: boolean };
                               // id = a rules.json key ('endgame' / 'later' for the reserved groups): never shown
                               // to the player, use `title` / `name`. name = the header's region text
                               // (names.region(mapCode), else the rule table's own names); null for 'endgame',
                               // 'later' or when nothing names it. endgame = true only for the 'endgame' group
                               // (current and reached are false there).
    title: string;             // localized heading: "Now: Pangzhen" / the region name / "Until the final bell" / "Later"
    warnings: Array<{ where: string; items: Array<{ text: string; note: string | null; hint?: string | null }> }>;  // as `warnings`
    info: string[];            // as `info`
  }>;
  mapLocks?: Array<{           // map locks still closed in regions the player has reached (save MapSubsystem lock
                               // arrays minus EndedLockObjGuids; a region is reached when its map is unlocked, one of
                               // its bells was used or it is the header's map), one entry per region name, in the
                               // save's map order; [] when none. Missing (older transport) → nothing. Always visible
                               // (not blurred): reached regions only, never a lock id or a position.
    region: string;            // the header's region text (names.region(mapCode)), else the map code
    items: Array<{
      type: string;            // localized actor type word: "stone wall" / "gate" / "door" / "lock"
      need: string | null;     // localized requirement: the Phantom Edge's name (its raw id when no name is known)
                               // or "key item K_05007"; null for needKind 'none'
      needKind: 'weapon' | 'item' | 'none';
      text: string;            // the whole item, localized: "stone wall (Tiger Cannon)", "gate (key item K_05007)", "locked door"
    }>;
  }>;
  maps?: Array<{               // the game's own map completion (lib/completion.js, the in-game map panel's count) for the
                               // region maps the player has REACHED (one of the group's maps unlocked, a bell of it used, or
                               // it is the header's region map; pangzhen+houjie and meiguhu+meigu_yiji count as one), in the
                               // game's registry order; unreached maps are never listed. [] when nothing was reached or read.
                               // Missing (older transport) → no Maps content.
    id: string;                // the group id ('pangzhen', 'XiGu', …): never shown
    name: string;              // the header's region text (names.region), else the level name of the embedded table
    percent: number;           // floor(current / total * 100), as the game shows it
    current: number; total: number;
    categories: Array<{ cat: Category; label: string; done: number; total: number }>;  // only categories present on the map
    missing: Array<{           // the entries not yet counted, in registry order; the page blurs every row (layer 2)
      cat: Category;
      text: string;            // localized: the item / bell / flower name (the player's text patch when it has the key, else
                               // the embedded en/tr name), or for challenges and shard chests a category phrase
      bell: string | null;     // the nearest bell's name, only in exact mode (Settings.exact) and never for a bell row
    }>;
    note: string;              // localized footnote ("the same count as the game's; keys and primary chest items are not counted")
  }>;
  // Layer 2 (blurred in the Journal tab)
  journal: {
    sections: Array<{
      title: string;           // localized, e.g. "Missables", "True ending: purple quests — found 8, finished 2", "Other side quests"
      rows: Array<{
        name: string; status: Status; statusText: string; progress: string | null; note: string | null;
        kind: 'quest' | 'item' | 'accessory' | 'flower' | 'chest' | 'weapon';
                               // what the row is about (lib/report.js kindOf): a quest, or for a rule without a quest the
                               // thing its doneWhen looks for (an AC_* accessory, a memory-flower petal, a saved chest actor, a
                               // weapon id, else a generic item). The page shows a small icon with a title; never blurred
                               // (it names a kind, not the thing). Missing (older transport) → 'quest'. Journal info rows are
                               // shown with the 'info' icon by the page itself (they are plain strings).
        nameBlur: boolean;     // false = status done or missed (any row, guesses * included), or the quest is in the player's journal (in the save,
                               // status open, not a guess): name readable. true = not started, unknown, open guess (*) or an item rule
                               // without a quest: the whole row (badge, name, details) is blurred. Missing → true.
        detailBlur: boolean;   // progress + note blurred: true while the row is open/not started/unknown, false once done or missed. Missing → true.
      }>;
    }>;
    info: string[];            // named info texts (hidden layer; always blurred as a whole)
    changes: string[];         // changes since the previous read (localized), may be empty
    legend: string;            // "* = guess, not verified."
  };
}

interface Settings {
  paths: Array<{               // path rows; Choose/Forget call pick(what) / forget(what)
    what: string;              // 'game' | 'save' | 'exe' | 'paks' | 'steam'
    label: string;
    value: string | null;      // a display name (never a full path in the web version)
    source: 'config' | 'auto' | null;
    sourceText?: string;       // chip text (else derived from `source`)
    warn?: boolean;            // chip in warning colour (default: !source)
    canForget?: boolean;       // default: source === 'config'
  }>;
  extraFields?: Array<{ id: string; label: string; value: string; options: Array<{ value: string; label: string }>; hint?: string }>;  // selects in the paths card (account, mode); a change posts { [id]: value }
  pathsNote?: string;          // note under the paths card
  uiLang: 'tr' | 'en';
  names: { current: string; options: Array<{ value: string; label: string }> }; // value '' = automatic
  interval: number;            // seconds, how often the save is checked (2..3600)
  intervalHint?: string;       // hint under the interval field
  rules: { source: 'embedded' | 'sidecar' | 'explicit'; file: string | null; version: string | number };
  configPath: string;          // where the settings are kept (web: a description of the browser storage)
  configLabel?: string;        // label for configPath (default "Config file")
  exact: boolean;              // "Show place and boss names in warnings" (default false)
  timeline: boolean;           // record the quest timeline (default true)
  timelineHint?: string;       // hint under the timeline switch
}

interface Diagnostics {
  tool: { version: string; mode: 'web' | 'cli'; uiLang: 'tr' | 'en'; exact: boolean };
  rules: { version: string; schemaVersion: string; source: 'embedded' | 'sidecar' | 'explicit' | '?' };
  names: { keyMapQuests: number; source: 'patch' | 'table' | null; sourceName: string | null; sidecars: string[] };
  patches: string[];           // text patch file names (no folders)
  build: { id: string | null; tested: boolean };
  save: { read: boolean; date: string | null; level: string | null; map: string | null; quests: number | null; inventory: boolean | null };  // date "YYYY-MM-DD"; level = raw level name, map = region map code of the header; inventory false = the save has no Inventory tables (items unknown, recentItems null)
  unmatched: Array<{ id: string; folder: string; completion: string | null }>;   // quests the name table does not know
  undetectable: Array<{ id: string; cutoff: string | null; reason: 'detectFalse' | 'noQuestId'; status: Status | null }>;  // undetectable rules in range for this save
  recentItems: Array<{ code: string; ago: number }> | null;  // items acquired in the 24 h before the save's own timestamp (not the
                               // system clock), newest first, at most 30; ago = seconds before it (negative = after). Codes only,
                               // never names or a time of day (an unexpected code becomes "?"). null = nothing read.
  timeline: { enabled: boolean; count: number; error: string | null } | null;     // error: a short code only
  report: string;              // plain text of all of the above
}

interface TimelineExport {
  tool: 'pbz-tracker'; version: string; format: 1; exportedAt: string; count: number;
  records: Array<QuestRecord | ItemRecord>;
  // t is the save's own date and time: an export contains play times.
}

interface QuestRecord {        // no `kind`
  t: string; readAt: string; questId: string; folder: string; from: string | null; to: string | null;
  branches: Record<string, string>; progress: string | null; level: string | null;
  // from: null = the quest appeared; to: null = the quest is no longer in the save (e.g. an older save was loaded).
}

interface ItemRecord {         // an item code that appeared in the save's Inventory tables (lib/state.js items)
  kind: 'item'; t: string; readAt: string; code: string;
  table: 'mainWeapon' | 'shaChiWeapon' | 'accessory' | 'inventory';
  at: string | null;           // the save's own acquisition time of the item (DateTime / DirtyTime / FirstAddTime)
  level: string | null;
  // The first read without a stored item snapshot (new timeline, or one stored before item records existed) is a
  // baseline: no item records. A read without Inventory tables logs no items and keeps the stored item snapshot. An item that disappears (older save loaded) is not logged; if it comes back it is
  // logged again. Same CAP (2000 records, quest and item records together).
}

interface About {
  version: string;             // "0.7.0"
  testedBuilds: string[];
  license: string;             // "GPL-3.0-or-later"
  repoUrl: string | null;      // null → no link
  loopbackNote: string;        // localized privacy note (web: "runs entirely in this browser …"); the name is historical
  linksHint?: string;          // hint under the links
  links: Array<{ label: string; url: string }>;   // guides (spoiler-safe labels) + ooz
}
```

## Page behaviour (summary)

- Tabs: **Warnings** (default), **Journal**, **Maps**, **Settings**, **About** (the three content tabs first, the two tool tabs last). Keys `1`-`5` switch tabs in that order, `Esc` re-blurs the journal or the maps.
- Maps: one card per reached region (`State.maps`): name, percentage, count, a `<progress>` bar (value/max attributes, no inline
  style), category chips and the missing entries as blurred rows with a category icon (the icon stays readable: it names a
  kind, not the thing). Click a row → it unblurs; `Esc`, leaving the tab or a new `state` blurs everything again.
- Settings: General has the "exact names" checkbox; a collapsible **Diagnostics** panel at the bottom (count of unmatched
  quests on its header) with **Copy report**, the timeline switch, its record count, **Export timeline**, **Copy timeline** and **Delete timeline** (asks first).
  Clipboard: `navigator.clipboard.writeText`, else a hidden textarea and `execCommand('copy')`.
- Journal rows: blurred per row part (`filter: blur`, class `.blur` + `aria-hidden` on each blurred part):
  `nameBlur: false` → status badge and name readable, step counter and note blurred while `detailBlur` (open rows; finished rows are fully readable); `nameBlur: true`
  → badge, name and details blurred together (the badge in a neutral colour until revealed). Info and change rows
  are always blurred as a whole. Section titles and their counts are never blurred.
  Click a row → every part of that row unblurs. "Show all" asks for confirmation. Leaving the tab, `Esc` or any
  new `state` re-blurs everything.
- Language toggle (TR/EN) top right.
- Dark "ink and paper" theme (wuxia): paper grain, brush-stroke dividers and card edges, red seal marks (the brand,
  the current region's heading, the active tab) and a serif stack for headings — all drawn with CSS and inline SVG data
  URIs coloured through CSS masks (`ui/style.css` `:root`); system fonts only (Georgia/Noto Serif for headings, Segoe UI
  for text, Cascadia Mono/Consolas for numbers), no external resources, no emoji (inline SVG if an icon is needed).
  Status badges are stamp-like (uppercase; "missed" is a filled red seal). Journal rows carry a kind icon
  (`rows[].kind`; info rows a lantern). Works at 1100×760 and down to phone width (375 px) without horizontal scrolling.
