'use strict';
// Builds the static web version into web/dist/ (`node build/build.js`; `--web` is accepted and means
// the same): bundles web/main.js + lib/ + data/ into one browser script with a tiny CommonJS bundler (no
// npm deps), copies the page in ui/, and writes the manifest and the service worker (see buildWeb below).
// The output contains no key, save data or user paths (checked by the personal-data scan at the end);
// the key is derived in the browser from the player's own PBZ.exe.
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { VERSION } = require('../lib/version');

function resolveLocal(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  throw new Error(`cannot resolve ${spec} from ${from}`);
}

// Code without comments, for the browser-bundle checks (good enough for our own sources: no regex
// literals or strings that contain comment markers next to a require call).
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// Browser bundle. Every require must be relative (bundled); a Node built-in (or any package) left in it
// fails the build, and the result is wrapped in a function so nothing leaks into globals.
function bundle(entryFile) {
  const mods = new Map(); // abs path → { id, code }
  const visit = (file) => {
    if (mods.has(file)) return mods.get(file).id;
    const id = mods.size;
    const entry = { id, code: '' };
    mods.set(file, entry);
    let src = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.json')) {
      entry.code = `module.exports = ${JSON.stringify(JSON.parse(src))};`;
      return id;
    }
    src = src.replace(/^#![^\n]*\r?\n/, '');
    entry.code = src.replace(/require\((['"])(\.{1,2}\/[^'"]+)\1\)/g, (_, q, spec) => `__req(${visit(resolveLocal(file, spec))})`);
    const left = /(^|[^\w$.])require\s*\(\s*(['"`]?)([^'"`)]*)/m.exec(stripComments(entry.code));
    if (left) throw new Error(`web bundle: Node/non-relative require(${left[2]}${left[3]}${left[2]}) in ${path.relative(ROOT, file)}`);
    return id;
  };
  visit(entryFile);
  const parts = ['"use strict";', 'const __defs = {};', 'const __cache = {};',
    'function __req(id) { if (__cache[id]) return __cache[id].exports; const module = { exports: {} }; __cache[id] = module; __defs[id](module, module.exports); return module.exports; }'];
  for (const [file, m] of mods) {
    parts.push(`// ${path.relative(ROOT, file).replace(/\\/g, '/')}`);
    parts.push(`__defs[${m.id}] = function (module, exports) {\n${m.code}\n};`);
  }
  parts.push('__req(0);');
  const code = `(function () {\n${parts.join('\n')}\n})();\n`;
  return { code, files: [...mods.keys()].map((f) => path.relative(ROOT, f)) };
}

// ---- web version (static site, GitHub Pages) -----------------------------------
// Writes web/dist/: index.html (ui/index.html with relative paths, a CSP meta tag, the manifest
// and web.js before app.js), app.js + style.css (ui/, unchanged), web.js (bundle of web/main.js),
// icon.svg, manifest.webmanifest and sw.js (service worker caching exactly these files).
const WEB = path.join(ROOT, 'web');
const WEB_DIST = path.join(WEB, 'dist');
const WEB_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";

function webIndex(html) {
  const swap = (from, to) => {
    if (!html.includes(from)) throw new Error(`ui/index.html: "${from}" not found (update buildWeb)`);
    html = html.replace(from, to);
  };
  swap('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${WEB_CSP}">`);
  swap('<meta name="google" content="notranslate">', [
    '<meta name="google" content="notranslate">',
    '<meta name="description" content="Spoiler-safe, read-only missables tracker for Phantom Blade Zero. Runs entirely in your browser; nothing is uploaded.">',
    '<meta name="theme-color" content="#1d1915">',
    '<link rel="manifest" href="manifest.webmanifest">',
  ].join('\n'));
  swap('<link rel="stylesheet" href="/style.css">', '<link rel="stylesheet" href="style.css">');
  swap('<script src="/app.js" defer></script>', '<script src="web.js" defer></script>\n<script src="app.js" defer></script>');
  if (/(?:src|href)="\/(?!\/)/.test(html)) throw new Error('ui/index.html: an absolute /path is left in the web page (GitHub Pages serves it from a sub-folder)');
  return html;
}

function buildWeb() {
  const { code, files } = bundle(path.join(WEB, 'main.js'));
  new (require('vm').Script)(code, { filename: 'web.js' }); // syntax check
  const out = {
    'index.html': webIndex(fs.readFileSync(path.join(ROOT, 'ui', 'index.html'), 'utf8')),
    'app.js': fs.readFileSync(path.join(ROOT, 'ui', 'app.js'), 'utf8'),
    'style.css': fs.readFileSync(path.join(ROOT, 'ui', 'style.css'), 'utf8'),
    'web.js': `// pbz-tracker ${VERSION} web version, generated by build/build.js from web/ and lib/ (GPL-3.0-or-later)\n${code}`,
    'icon.svg': fs.readFileSync(path.join(ROOT, 'ui', 'icon.svg'), 'utf8'),
    'manifest.webmanifest': `${JSON.stringify({
      name: 'pbz-tracker: Phantom Blade Zero missables tracker',
      short_name: 'pbz-tracker',
      description: 'Spoiler-safe, read-only missables tracker for Phantom Blade Zero. Runs entirely in your browser; nothing is uploaded.',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#15120f',
      theme_color: '#1d1915',
      icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    }, null, 2)}\n`,
  };
  const hash = require('crypto').createHash('sha256');
  for (const [name, body] of Object.entries(out)) hash.update(name).update('\0').update(body).update('\0');
  const sw = fs.readFileSync(path.join(WEB, 'sw.js'), 'utf8');
  for (const marker of ['__PBZ_VERSION__', '__PBZ_BUILD__', '__PBZ_FILES__']) if (!sw.includes(marker)) throw new Error(`web/sw.js: ${marker} missing`);
  out['sw.js'] = sw.replace("'__PBZ_VERSION__'", JSON.stringify(VERSION))
    .replace("'__PBZ_BUILD__'", JSON.stringify(hash.digest('hex').slice(0, 12)))
    .replace('__PBZ_FILES__', JSON.stringify(Object.keys(out)));
  new (require('vm').Script)(out['sw.js'], { filename: 'sw.js' });

  fs.rmSync(WEB_DIST, { recursive: true, force: true });
  fs.mkdirSync(WEB_DIST, { recursive: true });
  for (const [name, body] of Object.entries(out)) fs.writeFileSync(path.join(WEB_DIST, name), body);
  for (const name of Object.keys(out)) {
    const hits = scanPersonal(path.join(WEB_DIST, name));
    if (hits.length) {
      fs.rmSync(WEB_DIST, { recursive: true, force: true });
      throw new Error(`personal data found in web/dist/${name}, output deleted:\n${formatHits(hits)}`);
    }
  }
  const size = Object.values(out).reduce((n, b) => n + Buffer.byteLength(b), 0);
  console.log(`web: ${files.length} modules → ${path.relative(ROOT, WEB_DIST)}/ (${Object.keys(out).join(', ')}; ${(size / 1024).toFixed(0)} KB), personal-data scan clean`);
}

// ---- personal-data scan ----------------------------------------------------
// Strings that must never ship in web/dist: the builder's home folder, the project root, "Users\<name>",
// and the SteamID64 prefix. Each is searched case-insensitively-ish (as-is, lower case, both
// slash styles) in both 8-bit and UTF-16LE encodings.
function personalNeedles() {
  const user = (() => { try { return os.userInfo().username; } catch { return process.env.USERNAME || ''; } })();
  const base = [os.homedir(), ROOT, process.cwd(), user ? `Users\\${user}` : null].filter(Boolean);
  const out = new Set();
  for (const s of base) {
    for (const v of [s, s.toLowerCase(), s.replace(/\\/g, '/'), s.toLowerCase().replace(/\\/g, '/')]) out.add(v);
  }
  out.add('7656119');
  return [...out].filter((s) => s.length >= 4);
}

function scanPersonal(file) {
  const buf = fs.readFileSync(file);
  const hits = [];
  for (const s of personalNeedles()) {
    for (const enc of ['latin1', 'utf16le']) {
      const at = buf.indexOf(Buffer.from(s, enc));
      if (at >= 0) hits.push({ s, enc, at });
    }
  }
  return hits;
}

const formatHits = (hits) => hits.map((h) => `  "${h.s}" (${h.enc}) at offset ${h.at} (0x${h.at.toString(16)})`).join('\n');

// `node build/build.js` (or `--web`): build web/dist.
try { buildWeb(); } catch (e) { console.error(`web build failed: ${e.message}`); process.exit(1); }
