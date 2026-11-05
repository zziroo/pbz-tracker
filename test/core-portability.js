#!/usr/bin/env node
'use strict';
// Proves the engine core is browser-safe.
//   1. Static check: every file under lib/core/**, plus everything those files (and the shared pure
//      modules lib/state.js, lib/report.js, lib/viewmodel.js) pull in through relative requires, must not
//      reference Node built-ins or Node globals: no non-relative or dynamic require, no Buffer, no bare
//      process, no __dirname / __filename, no global., no dynamic import(). Feature detection through
//      globalThis (e.g. globalThis.process?.env) is allowed.
//   2. Runtime check: the same modules are loaded in a fresh vm context that has only browser-style
//      globals (TextDecoder, TextEncoder, crypto, Blob, console, timers) and a loader that resolves
//      relative paths only, so any hidden Node dependency fails with a ReferenceError.
// Usage: node test/core-portability.js            (exit 0 = OK)
// Also exports loadSandbox() for test/core-e2e.js.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const CORE = path.join(ROOT, 'lib', 'core');
const SHARED = ['lib/state.js', 'lib/report.js', 'lib/viewmodel.js'].map((f) => path.join(ROOT, f));

const RULES = [
  { re: /\brequire\s*\(\s*(?!['"]\.\.?\/)/, why: 'non-relative or dynamic require' },
  { re: /\brequire\s*\.\s*(resolve|main|cache)\b/, why: 'require.resolve/main/cache' },
  { re: /(?<![\w$.])Buffer\b/, why: 'Buffer' },
  { re: /(?<![\w$.])process\b/, why: 'bare process (use globalThis.process?.… feature detection)' },
  { re: /\b__dirname\b|\b__filename\b/, why: '__dirname/__filename' },
  { re: /\bglobalThis\s*\.\s*(Buffer|require)\b/, why: 'globalThis.Buffer / globalThis.require' },
  { re: /\bglobalThis\s*\.\s*process\s*\.(?!\?)/, why: 'globalThis.process.… without optional chaining' },
  { re: /(?<![\w$.])global\s*\./, why: 'Node global object' },
  { re: /\bimport\s*\(/, why: 'dynamic import()' },
  { re: /['"]node:/, why: 'node: specifier' },
];

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  return d.isDirectory() ? walk(p) : /\.(js|json)$/.test(d.name) ? [p] : [];
});

function resolveLocal(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  throw new Error(`cannot resolve ${spec} from ${path.relative(ROOT, from)}`);
}

// Core files + shared pure modules + their relative-require closure.
function moduleSet() {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (file.endsWith('.json')) return;
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\brequire\s*\(\s*(['"])(\.\.?\/[^'"]+)\1\s*\)/g)) visit(resolveLocal(file, m[2]));
  };
  for (const f of [...walk(CORE), ...SHARED]) visit(f);
  return [...seen].sort();
}

function staticCheck(files) {
  const problems = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    if (f.endsWith('.json')) { try { JSON.parse(src); } catch (e) { problems.push(`${path.relative(ROOT, f)}: bad JSON (${e.message})`); } continue; }
    src.split(/\r?\n/).forEach((line, i) => {
      for (const r of RULES) if (r.re.test(line)) problems.push(`${path.relative(ROOT, f)}:${i + 1}: ${r.why}: ${line.trim()}`);
    });
  }
  return problems;
}

// A CommonJS loader inside a vm context with browser-style globals only.
function loadSandbox() {
  const ctx = vm.createContext({
    console, TextDecoder, TextEncoder, crypto: globalThis.crypto, Blob,
    setTimeout, clearTimeout, queueMicrotask, structuredClone, atob, btoa,
  });
  const cache = new Map();
  const load = (file) => {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const src = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.json')) { module.exports = vm.runInContext(`(${JSON.stringify(JSON.parse(src))})`, ctx); return module.exports; }
    const fn = vm.runInContext(`(function (module, exports, require) {${src.replace(/^#![^\n]*/, '')}\n})`, ctx, { filename: file });
    const req = (spec) => {
      if (typeof spec !== 'string' || !/^\.\.?\//.test(spec)) throw new Error(`sandbox: non-relative require('${spec}') from ${path.relative(ROOT, file)}`);
      return load(resolveLocal(file, spec));
    };
    fn(module, module.exports, req);
    return module.exports;
  };
  const req = (rel) => load(resolveLocal(path.join(ROOT, 'x'), rel));
  return { ctx, require: req, files: () => [...cache.keys()] };
}

// The rules must catch these (guards against a regex that silently matches nothing).
const MUST_FLAG = ["const fs = require('fs');", 'require("node:crypto")', 'const b = Buffer.alloc(4);', 'if (process.env.X) {}',
  'process?.env', 'path.join(__dirname, x)', 'require(name)', "import('fs')", 'global.foo = 1'];
const MUST_PASS = ["const x = require('./bytes');", "require('../i18n')", 'globalThis.process?.env?.PBZ_LANG', 'processLzRuns(a)', 'globalThis.crypto.subtle'];
function selfTest() {
  const flags = (line) => RULES.some((r) => r.re.test(line));
  return [...MUST_FLAG.filter((l) => !flags(l)).map((l) => `not flagged: ${l}`), ...MUST_PASS.filter(flags).map((l) => `wrongly flagged: ${l}`)];
}

function main() {
  const self = selfTest();
  if (self.length) { console.log(`FAIL rule self-test:\n  ${self.join('\n  ')}`); process.exitCode = 1; return; }
  const files = moduleSet();
  console.log(`checked modules (${files.length}):`);
  for (const f of files) console.log(`  ${path.relative(ROOT, f).replace(/\\/g, '/')}`);
  const problems = staticCheck(files);
  if (problems.length) {
    console.log(`\nFAIL static check: ${problems.length} problem(s)`);
    for (const p of problems) console.log(`  ${p}`);
  } else console.log('\nstatic check: OK (no Node built-ins or Node globals)');

  let loadFail = 0;
  const sb = loadSandbox();
  for (const f of files.filter((x) => x.endsWith('.js'))) {
    try { sb.require(`./${path.relative(ROOT, f).replace(/\\/g, '/')}`); } catch (e) { loadFail++; console.log(`FAIL sandbox load ${path.relative(ROOT, f)}: ${e.message}`); }
  }
  if (!loadFail) {
    const core = sb.require('./lib/core');
    const want = ['deriveKeyFromReader', 'decodeSave', 'TransientError', 'findTextPatchesFrom', 'inspectPak', 'parseLocres', 'looksTurkish', 'createNamesFrom'];
    const missing = want.filter((k) => !(k in core));
    if (missing.length) { loadFail++; console.log(`FAIL core API missing: ${missing.join(', ')}`); }
    // Smoke test with no Node globals around: a tiny locres v0 and the byte helpers.
    try {
      const b = core.bytes;
      if (b.latin1(new Uint8Array([0x41, 0x80, 0xff])) !== 'A\u0080ÿ') throw new Error('latin1');
      if (b.utf16le(b.utf16leBytes('ğış')) !== 'ğış') throw new Error('utf16le');
      if (b.indexOfBytes(new Uint8Array([1, 2, 1, 2, 3]), new Uint8Array([1, 2, 3])) !== 2) throw new Error('indexOfBytes');
    } catch (e) { loadFail++; console.log(`FAIL sandbox smoke test: ${e.message}`); }
  }
  console.log(loadFail ? `\nFAIL sandbox: ${loadFail} problem(s)` : `sandbox load: OK (${sb.files().length} modules in a context without require/Buffer/process)`);
  const bad = problems.length + loadFail;
  console.log(`\n${bad ? `${bad} FAILURE(S)` : 'ALL OK'}`);
  process.exitCode = bad ? 1 : 0;
}

if (require.main === module) main();
module.exports = { loadSandbox, moduleSet };
