# pbz-tracker v0.4 — local UI API contract

The windowed UI is a static page (`ui/index.html`, `ui/app.js`, `ui/style.css`) served by a tiny
HTTP server inside the tool (`lib/server.js`). Everything stays on this machine.

## Transport and security

- The server binds **127.0.0.1** only, on a random free port (`listen(0, '127.0.0.1')`).
- A random token (32 bytes hex, `crypto.randomBytes`) is created per start.
  - Page URL: `http://127.0.0.1:<port>/?t=<token>`.
  - API calls send the token in the header `X-PBZ-Token: <token>`; `EventSource` cannot set headers, so `/events` takes `?t=<token>`.
  - Any `/api/*`, `/events` or `/` request without the right token → **403** (plain text). Static assets (`/app.js`, `/style.css`) are served without a token (they contain no data).
- Every request: `Host` must be exactly `127.0.0.1:<port>` (else 403). If an `Origin` header is present it must be exactly `http://127.0.0.1:<port>` (else 403). POST bodies must be `Content-Type: application/json` (else 415), max 16 KB.
- Responses: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and for the page a CSP: `default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. Therefore **no inline scripts or inline styles** in the page (`style="..."` attributes are also blocked; use classes). The page reads the token from `location.search`.
- Lifecycle: the page POSTs `/api/heartbeat` every 3 s. If no heartbeat arrives for 10 s (after the first one; or 60 s after start if none ever arrives), the server shuts down and the process exits.

## Strings

All content strings (warnings, quest names, status labels, notices, header lines) come **already
localized** from the server in the current UI language. The page only holds its own chrome strings
(tab names, buttons, the blur notice, settings labels) in a small TR/EN dictionary in `app.js`, keyed by
`state.ui.lang`. Changing the language = `POST /api/settings {uiLang}`; the server pushes a new state.

## Endpoints

### `GET /?t=<token>` → `ui/index.html`

### `GET /app.js`, `GET /style.css` → static assets

### `GET /api/state` → `State`
### `GET /events?t=<token>` → Server-Sent Events
- `event: state` with `data: <State JSON>`: sent on connect and whenever the save or settings change.
- A comment line `: ping` every 15 s.

### `POST /api/heartbeat` → `204`

### `GET /api/settings` → `Settings`
### `POST /api/settings` body `{ "uiLang"?: "tr"|"en", "names"?: string, "interval"?: number, "exact"?: boolean, "timeline"?: boolean }` → `Settings`
Persists to `pbz-tracker.config.json`, re-reads, pushes a new `state` event. `exact` re-evaluates the last read
(warnings name places and bosses for areas already reached; `exactWhen` in `data/rules.json`) and pushes a new
state; `timeline` takes effect with the next read and pushes nothing.

### `POST /api/pick` body `{ "what": "game" | "save" }` → `{ "ok": boolean, "path": string|null, "error": string|null }`
Opens the native picker **on the server side** (the existing PowerShell dialog), validates, stores in the
config, reloads and pushes a new `state`. `ok:false, path:null, error:null` = cancelled.

### `POST /api/forget` body `{ "what": "game" | "save" | "all" }` → `Settings`

### `POST /api/open-url` body `{ "url": string }` → `204` or `400`
Opens the URL in the **system default browser** (not the app window). Only URLs from an allow-list
(the repository URL and the guide/tech URLs listed in `About.links`) are accepted.

### `GET /api/about` → `About`

### `GET /api/diagnostics` → `Diagnostics`
Built by `lib/diagnostics.js` (shared with the web version). No personal data: no paths, no Steam account ids or
folder names, no user names, no key material; of the save time only the date. `report` is the same as plain text
(English) for a GitHub issue.

### `GET /api/timeline` → `TimelineExport` (`Content-Disposition: attachment; filename="pbz-tracker-timeline.json"`)
The quest timeline (`pbz-tracker.timeline.json`). Needs the token header like every `/api/*` call (403 without);
the page fetches it and saves it through a Blob URL.

### `POST /api/timeline/delete` body `{}` → `{ ok: boolean, count: number }`
Deletes `pbz-tracker.timeline.json` (and a leftover `.tmp`) and resets the in-memory snapshot, so the next read
records a fresh baseline. Refused (`ok: false`) when the tool sits inside the game or save folder. Turning the
`timeline` setting off only stops recording; it never deletes.

## Types

```ts
type Status = 'open' | 'notStarted' | 'done' | 'missed' | 'unknown';

interface State {
  ok: boolean;                 // false → show `error` prominently, keep the rest of the page usable (Settings!)
  error: string | null;        // localized one-line message (e.g. game not found → hint to use Settings)
  readAt: string | null;       // ISO time the save was last decoded (page shows "last refresh: 12 s ago")
  ui: { lang: 'tr' | 'en' };
  header: {
    saveTime: string;          // "05.11.2026 03:37" (game save time)
    playTime: string;          // "12:01"
    location: string | null;   // localized region name or null
    build: { id: string | null; tested: boolean; text: string };  // text = localized header line
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
  gameDir: string | null;      // resolved game folder in use
  gameDirSource: 'config' | 'auto' | 'arg' | null;
  savePath: string | null;
  savePathSource: 'config' | 'auto' | 'arg' | null;
  uiLang: 'tr' | 'en';
  names: { current: string; options: Array<{ value: string; label: string }> }; // value '' = automatic
  interval: number;            // seconds, poll fallback (2..3600)
  rules: { source: 'embedded' | 'sidecar' | 'explicit'; file: string | null; version: string | number };
  configPath: string;
  exact: boolean;              // "Show place and boss names in warnings" (default false; --exact)
  timeline: boolean;           // record the quest timeline (default true; --no-timeline)
}

interface Diagnostics {
  tool: { version: string; mode: 'window' | 'web' | 'cli'; uiLang: 'tr' | 'en'; exact: boolean };
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
  version: string;             // "0.4.0"
  testedBuilds: string[];
  license: string;             // "GPL-3.0-or-later"
  repoUrl: string | null;      // null until the repository exists → hide the link
  loopbackNote: string;        // localized "only 127.0.0.1, no internet access"
  links: Array<{ label: string; url: string }>;   // guides (spoiler-safe labels) + ooz
}
```

## Transport seam and the web version (v0.5)

`ui/app.js` talks to its backend through one object:
`{ needsToken, getState(), subscribe(onState), getSettings(), postSettings(patch), pick(what), forget(what), openUrl(url), getAbout(), getDiagnostics?(), getTimeline?(), deleteTimeline?(), heartbeat?(), action?(id) }`.
Without `getDiagnostics` the Settings tab has no Diagnostics panel.
By default it is the HTTP transport above (`fetch` + `EventSource`, token, heartbeat). The static web version
(`node build/build.js --web` → `web/dist/`) loads `web.js` before `app.js`; it sets `window.PBZ_TRANSPORT`
(`web/transport.js`), which implements the same calls in the browser (File System Access handles or plain
`File`s, IndexedDB for settings, handles and the key cache; no network, no token, no heartbeat).

Optional fields only the web transport sends (the local server never does, so the window is unchanged):

- `State.errorKind`: `'setup' | 'busy' | null` → calmer accent box (setup) or a spinner without buttons (busy) instead of the red error box.
- `State.actions: Array<{ id, label, primary? }>` → buttons in that box; a click calls `transport.action(id)` (`pickGame`, `pickSave`, `pickExe`, `useFiles`, `resume`). They run inside the click, because browser pickers and permission prompts need a user gesture.
- `State.header.build.quiet: true` → an unknown build is shown without the "untested" colour.
- `Settings.paths: Array<{ what, label, value, source, sourceText?, warn?, canForget? }>` → replaces the two default path rows (`what`: `game | save | exe | paks | steam`; Choose/Forget call `pick(what)` / `forget(what)`).
- `Settings.extraFields: Array<{ id, label, value, options, hint? }>` → selects in the paths card (`account`, `mode`); a change posts `{ [id]: value }`.
- `Settings.pathsNote`, `Settings.configLabel`, `Settings.intervalHint`, `Settings.timelineHint`, `About.linksHint` → replace the corresponding fixed texts.
- The web version keeps the quest timeline in IndexedDB (key `timeline`); `getTimeline()` returns the same `TimelineExport`, `deleteTimeline()` removes it, and so does `forget('all')`.

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
