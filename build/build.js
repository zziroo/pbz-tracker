'use strict';
// Builds dist/pbz-tracker-v<version>.exe: bundles pbz.js + lib/ + data/ into one script (tiny CommonJS bundler,
// no npm deps), then wraps it in a Node single executable application (SEA).
// Build-time only: needs `npx postject` (nodejs/postject) to inject the blob into a copy of node.exe.
// The bundle contains no key, save data or user paths; the key is derived from the runner's own PBZ.exe.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

  const blob = path.join(DIST, 'sea-prep.blob');
  const cfg = path.join(DIST, 'sea-config.json');
  fs.writeFileSync(cfg, JSON.stringify({ main: bundlePath, output: blob, disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false }));
  execFileSync(process.execPath, ['--experimental-sea-config', cfg], { stdio: 'inherit' });

  const exe = path.join(DIST, `pbz-tracker-v${VERSION}.exe`);
  fs.copyFileSync(process.execPath, exe);
  // Run npx through node itself (no shell, arguments passed as an array).
  const npxCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const postject = ['--yes', 'postject@1.0.0-alpha.6', exe, 'NODE_SEA_BLOB', blob,
    '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'];
  if (fs.existsSync(npxCli)) execFileSync(process.execPath, [npxCli, ...postject], { stdio: 'inherit' });
  else execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', postject, { stdio: 'inherit', shell: process.platform === 'win32' });
  fs.rmSync(blob, { force: true });
  fs.rmSync(cfg, { force: true });
  console.log(`exe: ${path.relative(ROOT, exe)} (${(fs.statSync(exe).size / 1048576).toFixed(0)} MB)`);
}

main();
