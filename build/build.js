'use strict';
// Builds dist/pbz-tracker-v<version>.exe: bundles pbz.js + lib/ + data/ into one script (tiny CommonJS bundler,
// no npm deps), then wraps it in a Node single executable application (SEA).
// Build-time only: needs `npx postject` (nodejs/postject) to inject the blob into a copy of node.exe.
// The bundle contains no key, save data or user paths; the key is derived from the runner's own PBZ.exe.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ENTRY = path.join(ROOT, 'pbz.js');
const { VERSION } = require('../lib/version');

function resolveLocal(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  throw new Error(`cannot resolve ${spec} from ${from}`);
}

function bundle() {
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
    return id;
  };
  visit(ENTRY);
  const parts = ['"use strict";', 'const __defs = {};', 'const __cache = {};',
    'function __req(id) { if (__cache[id]) return __cache[id].exports; const module = { exports: {} }; __cache[id] = module; __defs[id](module, module.exports); return module.exports; }'];
  for (const [file, m] of mods) {
    parts.push(`// ${path.relative(ROOT, file).replace(/\\/g, '/')}`);
    parts.push(`__defs[${m.id}] = function (module, exports) {\n${m.code}\n};`);
  }
  parts.push('__req(0);');
  return { code: parts.join('\n'), files: [...mods.keys()].map((f) => path.relative(ROOT, f)) };
}

function main() {
  fs.mkdirSync(DIST, { recursive: true });
  const { code, files } = bundle();
  new (require('vm').Script)(code, { filename: 'pbz-tracker.js' }); // syntax check before shipping
  const bundlePath = path.join(DIST, 'pbz-tracker.js');
  fs.writeFileSync(bundlePath, code);
  console.log(`bundle: ${files.length} modules → ${path.relative(ROOT, bundlePath)} (${(code.length / 1024).toFixed(0)} KB)`);
  if (process.argv.includes('--bundle-only')) return;

  // Paths in the SEA config are RELATIVE and resolved from cwd = dist/: Node stores `main` verbatim in
  // the blob, so an absolute path would ship the builder's home folder (user name) inside the exe.
  const blob = path.join(DIST, 'sea-prep.blob');
  const cfg = path.join(DIST, 'sea-config.json');
  fs.writeFileSync(cfg, JSON.stringify({ main: path.basename(bundlePath), output: path.basename(blob), disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false }));
  execFileSync(process.execPath, ['--experimental-sea-config', path.basename(cfg)], { stdio: 'inherit', cwd: DIST });

  const exe = path.join(DIST, `pbz-tracker-v${VERSION}.exe`);
  const tmpExe = `${exe}.tmp`; // build next to the target, swap at the end (the target may be running)
  fs.rmSync(tmpExe, { force: true });
  fs.copyFileSync(process.execPath, tmpExe);
  // Run npx through node itself (no shell, arguments passed as an array).
  const npxCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const postject = ['--yes', 'postject@1.0.0-alpha.6', tmpExe, 'NODE_SEA_BLOB', blob,
    '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'];
  if (fs.existsSync(npxCli)) execFileSync(process.execPath, [npxCli, ...postject], { stdio: 'inherit' });
  else if (process.platform === 'win32') {
    // npx.cmd needs a shell on Windows: pass one quoted command line instead of loose arguments.
    const q = (a) => `"${String(a).replace(/"/g, '""')}"`;
    execSync(['npx.cmd', ...postject].map(q).join(' '), { stdio: 'inherit' });
  } else execFileSync('npx', postject, { stdio: 'inherit' });
  try {
    fs.renameSync(tmpExe, exe);
  } catch (e) {
    if (e.code === 'EBUSY' || e.code === 'EPERM') {
      throw new Error(`${path.basename(exe)} is in use (probably running). Close it and build again; the new build is at ${tmpExe}`);
    }
    throw e;
  }
  fs.rmSync(blob, { force: true });
  fs.rmSync(cfg, { force: true });
  const hits = scanPersonal(exe);
  if (hits.length) {
    fs.rmSync(exe, { force: true });
    throw new Error(`personal data found in the exe, build deleted:\n${formatHits(hits)}`);
  }
  console.log(`exe: ${path.relative(ROOT, exe)} (${(fs.statSync(exe).size / 1048576).toFixed(0)} MB), personal-data scan clean`);
}

// ---- personal-data scan ----------------------------------------------------
// Strings that must never ship: the builder's home folder, the project root, "Users\<name>",
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

// `node build/build.js --check <exe>`: scan an existing exe without building (exit 1 if anything is found).
const checkIdx = process.argv.indexOf('--check');
if (checkIdx > 0) {
  const file = process.argv[checkIdx + 1];
  if (!file) { console.error('usage: node build/build.js --check <exe>'); process.exit(2); }
  const hits = scanPersonal(file);
  if (hits.length) { console.error(`personal data found in ${path.basename(file)}:\n${formatHits(hits)}`); process.exit(1); }
  console.log(`${path.basename(file)}: personal-data scan clean`);
} else {
  try { main(); } catch (e) { console.error(`build failed: ${e.message}`); process.exit(1); }
}
