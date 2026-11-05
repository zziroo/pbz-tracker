'use strict';
// The window's static page (ui/index.html, ui/app.js, ui/style.css).
// Development (node pbz.js): read from ui/ on every request, so edits show up on reload.
// Single exe: build/build.js replaces this whole module with the three files inlined as strings
// (the exe has no access to the repository). A missing file gives a clear placeholder instead of a crash.
const fs = require('fs');
const path = require('path');

const UI_DIR = path.resolve(__dirname, '..', 'ui');
const NAMES = ['index.html', 'app.js', 'style.css'];

const placeholder = (name, file) => {
  const msg = `pbz-tracker: ${file} is missing (the window page has not been built yet).`;
  if (name === 'index.html') return `<!doctype html><html><head><meta charset="utf-8"><title>pbz-tracker</title></head><body><p>${msg}</p></body></html>\n`;
  return `/* ${msg} */\n`;
};

const warned = new Set();
function read(name) {
  const file = path.join(UI_DIR, name);
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    if (!warned.has(name)) { warned.add(name); console.error(`ui asset missing: ${file}`); }
    return placeholder(name, `ui/${name}`);
  }
}

// Which files exist (used by the bundler to warn / fail on missing assets).
const missing = () => NAMES.filter((n) => !fs.existsSync(path.join(UI_DIR, n)));

const assets = {};
for (const n of NAMES) Object.defineProperty(assets, n, { enumerable: true, get: () => read(n) });
Object.defineProperty(assets, '__missing', { enumerable: false, value: missing });

module.exports = assets;
