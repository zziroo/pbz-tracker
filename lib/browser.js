'use strict';
// Opens the window: Edge (or Chrome) in app mode (--app=<url>: no tabs, no address bar), else the
// default browser. Browsers are found via the "App Paths" registry keys with reg.exe (array
// arguments, no shell). Only ever opens the local 127.0.0.1 address or an allow-listed URL.
const fs = require('fs');
const { execFileSync, execFile, spawn } = require('child_process');

const APP_PATHS = 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths';

function regDefault(hive, exeName) {
  try {
    const out = execFileSync('reg.exe', ['query', `${hive}\\${APP_PATHS}\\${exeName}`, '/ve'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true,
    });
    // "    (Default)    REG_SZ    C:\...\msedge.exe" — the "(Default)" label is localized, so match on the type.
    const m = /REG_(EXPAND_)?SZ\s+(.+)/.exec(out);
    if (!m) return null;
    let p = m[2].trim().replace(/^"(.*)"$/, '$1');
    if (m[1]) p = p.replace(/%([^%]+)%/g, (all, v) => process.env[v] ?? all);
    return p;
  } catch { return null; }
}

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

// → { kind: 'edge' | 'chrome', exe } or null
function findAppBrowser() {
  if (process.platform !== 'win32') return null;
  for (const [kind, exeName] of [['edge', 'msedge.exe'], ['chrome', 'chrome.exe']]) {
    for (const hive of ['HKLM', 'HKCU']) {
      const p = regDefault(hive, exeName);
      if (p && isFile(p)) return { kind, exe: p };
    }
  }
  return null;
}

// Default browser, no shell string: explorer.exe <url> (it returns exit code 1 even on success).
function openDefault(url) {
  if (process.platform !== 'win32') return false;
  try {
    execFile('explorer.exe', [url], { windowsHide: true }, () => { /* exit code is meaningless */ });
    return true;
  } catch {
    try {
      execFile('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true }, () => {});
      return true;
    } catch { return false; }
  }
}

// → { kind: 'edge' | 'chrome' | 'default' | 'none', exe? }
function openWindow(url, { noEdge = false } = {}) {
  const b = noEdge ? null : findAppBrowser();
  if (b) {
    try {
      const child = spawn(b.exe, [`--app=${url}`, '--window-size=1100,760'], { detached: true, stdio: 'ignore' });
      child.on('error', () => { openDefault(url); }); // spawn failed after all: use the default browser
      child.unref();
      return b;
    } catch { /* default browser below */ }
  }
  return { kind: openDefault(url) ? 'default' : 'none' };
}

module.exports = { openWindow, openDefault, findAppBrowser };
