'use strict';
// Batch Oodle decompression for pak / IoStore blocks through the reference PowerShell P/Invoke script
// test/oodle-dll.ps1. The project's pure-JS decoder (lib/core/oodle) only speaks Mermaid/Selkie (what the
// save slots use); the game's paks are Kraken, so a real Oodle DLL is needed. The DLL is used in place from
// another Unreal game's folder (env OODLE_DLL, or the first oo2core_*_win64.dll found under the Steam
// libraries); it is never copied.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const PS1 = path.join(__dirname, '..', '..', '..', 'test', 'oodle-dll.ps1');

function findOodleDll() {
  if (process.env.OODLE_DLL && fs.existsSync(process.env.OODLE_DLL)) return process.env.OODLE_DLL;
  const roots = ['D:/SteamLibrary/steamapps/common', 'C:/Program Files (x86)/Steam/steamapps/common', 'E:/SteamLibrary/steamapps/common'];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const game of fs.readdirSync(root)) {
      for (const sub of ['', 'Game', 'Engine/Binaries/ThirdParty/Oodle/Win64']) {
        const dir = path.join(root, game, sub);
        if (!fs.existsSync(dir)) continue;
        const dll = fs.readdirSync(dir).find((f) => /^oo2core_\d+_win64\.dll$/i.test(f));
        if (dll) return path.join(dir, dll);
      }
    }
  }
  throw new Error('no Oodle DLL found; set OODLE_DLL to an oo2core_*_win64.dll from another Unreal game');
}

let jsOodle = null;
try { jsOodle = require('../../../lib/core/oodle'); } catch { /* optional */ }

// jobs: [{ src: Buffer, raw: number }] → [Buffer | null] (null = failed)
function decompressAll(jobs, tmpdir, dll = findOodleDll()) {
  const out = new Array(jobs.length).fill(null);
  const idx = [];
  fs.mkdirSync(tmpdir, { recursive: true });
  jobs.forEach((j, i) => {
    if (j.raw === j.src.length) { out[i] = j.src; return; } // stored block
    if (jsOodle) {
      try { const d = jsOodle.decompress(new Uint8Array(j.src), j.raw); out[i] = Buffer.from(d.buffer, d.byteOffset, d.byteLength); return; } catch { /* Kraken etc. → DLL */ }
    }
    const f = `b${i}.cmp`;
    fs.writeFileSync(path.join(tmpdir, f), j.src);
    idx.push({ file: f, raw: j.raw, out: `b${i}.bin`, i });
  });
  if (idx.length) {
    fs.writeFileSync(path.join(tmpdir, 'index.json'), JSON.stringify(idx));
    const r = cp.spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-Dir', tmpdir, '-Dll', dll], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.stderr && r.stderr.trim()) console.error(r.stderr.trim().split('\n').slice(0, 10).join('\n'));
    for (const e of idx) { const p = path.join(tmpdir, e.out); if (fs.existsSync(p)) out[e.i] = fs.readFileSync(p); }
    for (const f of fs.readdirSync(tmpdir)) fs.unlinkSync(path.join(tmpdir, f));
  }
  return out;
}

module.exports = { decompressAll, findOodleDll };
