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
### `POST /api/settings` body `{ "uiLang"?: "tr"|"en", "names"?: string, "interval"?: number }` → `Settings`
Persists to `pbz-tracker.config.json`, re-reads, pushes a new `state` event.

### `POST /api/pick` body `{ "what": "game" | "save" }` → `{ "ok": boolean, "path": string|null, "error": string|null }`
Opens the native picker **on the server side** (the existing PowerShell dialog), validates, stores in the
config, reloads and pushes a new `state`. `ok:false, path:null, error:null` = cancelled.

### `POST /api/forget` body `{ "what": "game" | "save" | "all" }` → `Settings`

### `POST /api/open-url` body `{ "url": string }` → `204` or `400`
Opens the URL in the **system default browser** (not the app window). Only URLs from an allow-list
(the repository URL and the guide/tech URLs listed in `About.links`) are accepted.

### `GET /api/about` → `About`

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

## Page behaviour (summary)

- Tabs: **Warnings** (default), **Journal**, **Settings**, **About**. Keys `1`-`4` switch tabs, `Esc` re-blurs the journal.
- Journal rows: names blurred by default (`filter: blur`), status badges never blurred. Click a row → that row
  unblurs. "Show all" asks for confirmation. Leaving the tab or any new `state` re-blurs everything.
- Language toggle (TR/EN) top right.
- Dark theme, system fonts (Segoe UI; Cascadia Mono/Consolas for numbers), no external resources, no emoji
  (inline SVG if an icon is needed). Works at 1100×760 and narrower (down to ~720 px wide).
