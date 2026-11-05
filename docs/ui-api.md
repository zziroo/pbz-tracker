# pbz-tracker — page ↔ transport contract

The page is a static page (`ui/index.html`, `ui/app.js`, `ui/style.css`). It is only built for the web
version: `node build/build.js` (or `--web`) writes `web/dist/`, where `web.js` (the bundle of `web/main.js`)
is loaded before `app.js` and installs `window.PBZ_TRANSPORT` (`web/transport.js`). The page talks to that
object only; there is no server, no `fetch` and no `EventSource`. Everything runs in the browser.

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
    location: string | null;   // localized region name or null
    build: { id: string | null; tested: boolean; text: string; quiet?: boolean };  // text = localized header line; quiet: unknown build without the "untested" colour
    notices: string[];         // localized one-liners: patch found, name fallback, rules source/version ...
  } | null;                    // null when ok === false and nothing was ever read
  // Layer 1 (always visible)
  noRisk: boolean;             // true → big calm "no risk right now" text (`noRiskText`)
  noRiskText: string;
  warnings: Array<{
    where: string;             // positional cutoff text, e.g. "Before this area's final fight"
    items: Array<{ text: string; note: string | null }>;  // named started quests, location hints, counts
  }>;
  info: string[];              // anonymous info warnings (e.g. the camp warning)
  // Layer 2 (blurred in the Journal tab)
  journal: {
    sections: Array<{
      title: string;           // localized, e.g. "Missables", "True ending: purple quests — found 8, finished 2", "Other side quests"
      rows: Array<{ name: string; status: Status; statusText: string; progress: string | null; note: string | null }>;
    }>;
    info: string[];            // named info texts (hidden layer)
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
  save: { read: boolean; date: string | null; level: string | null; quests: number | null };  // date "YYYY-MM-DD"
  unmatched: Array<{ id: string; folder: string; completion: string | null }>;   // quests the name table does not know
  undetectable: Array<{ id: string; cutoff: string | null; reason: 'detectFalse' | 'noQuestId'; status: Status | null }>;  // undetectable rules in range for this save
  timeline: { enabled: boolean; count: number; error: string | null } | null;     // error: a short code only
  report: string;              // plain text of all of the above
}

interface TimelineExport {
  tool: 'pbz-tracker'; version: string; format: 1; exportedAt: string; count: number;
  records: Array<{ t: string; readAt: string; questId: string; folder: string; from: string | null; to: string | null;
                   branches: Record<string, string>; progress: string | null; level: string | null }>;
  // from: null = the quest appeared; to: null = the quest is no longer in the save (e.g. an older save was loaded).
  // t is the save's own date and time: an export contains play times.
}

interface About {
  version: string;             // "0.6.0"
  testedBuilds: string[];
  license: string;             // "GPL-3.0-or-later"
  repoUrl: string | null;      // null → no link
  loopbackNote: string;        // localized privacy note (web: "runs entirely in this browser …"); the name is historical
  linksHint?: string;          // hint under the links
  links: Array<{ label: string; url: string }>;   // guides (spoiler-safe labels) + ooz
}
```

## Page behaviour (summary)

- Tabs: **Warnings** (default), **Journal**, **Settings**, **About**. Keys `1`-`4` switch tabs, `Esc` re-blurs the journal.
- Settings: General has the "exact names" checkbox; a collapsible **Diagnostics** panel at the bottom (count of unmatched
  quests on its header) with **Copy report**, the timeline switch, its record count, **Export timeline**, **Copy timeline** and **Delete timeline** (asks first).
  Clipboard: `navigator.clipboard.writeText`, else a hidden textarea and `execCommand('copy')`.
- Journal rows: names blurred by default (`filter: blur`), status badges never blurred. Click a row → that row
  unblurs. "Show all" asks for confirmation. Leaving the tab or any new `state` re-blurs everything.
- Language toggle (TR/EN) top right.
- Dark theme, system fonts (Segoe UI; Cascadia Mono/Consolas for numbers), no external resources, no emoji
  (inline SVG if an icon is needed). Works at 1100×760 and narrower (down to ~720 px wide).
