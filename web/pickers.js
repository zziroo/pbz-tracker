'use strict';
// Browser pickers for the web version. Each must be called synchronously from a click handler (the
// browser requires a user gesture); nothing here awaits before opening the dialog.
//   hasFsAccess() → boolean                 File System Access API (Chrome, Edge): pollable handles
//   pickDirectory(id, startIn?) → handle | null (cancelled)
//   pickFileHandle(id, kind, startIn?) → handle | null      kind: 'save' | 'exe'
//   pickFilesWithInput({ accept, directory }) → File[] | null   classic <input type=file> (every browser)
const hasFsAccess = () => typeof globalThis.showDirectoryPicker === 'function' && typeof globalThis.showOpenFilePicker === 'function';

const cancelled = (e) => e && e.name === 'AbortError';

async function pickDirectory(id, startIn) {
  try {
    return await globalThis.showDirectoryPicker({ id, mode: 'read', ...(startIn ? { startIn } : {}) });
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}

const TYPES = {
  save: [{ description: 'PBZ save (*.sav)', accept: { 'application/octet-stream': ['.sav'] } }],
  exe: [{ description: 'PBZ.exe', accept: { 'application/octet-stream': ['.exe'] } }],
};

async function pickFileHandle(id, kind, startIn) {
  try {
    const [h] = await globalThis.showOpenFilePicker({ id, multiple: false, types: TYPES[kind], ...(startIn ? { startIn } : {}) });
    return h || null;
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}

// <input type=file>: resolves with the chosen files, or null when the dialog was cancelled.
function pickFilesWithInput({ accept, directory = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    if (accept) input.accept = accept;
    if (directory) { input.webkitdirectory = true; input.multiple = true; }
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(v && v.length ? v : null);
    };
    input.addEventListener('change', () => finish(Array.from(input.files || [])));
    input.addEventListener('cancel', () => finish(null));
    // Browsers without the input "cancel" event: the window gets focus back when the dialog closes.
    const onFocus = () => setTimeout(() => { if (!input.files || !input.files.length) finish(null); }, 4000);
    if (!('oncancel' in input)) window.addEventListener('focus', onFocus);
    document.body.append(input);
    input.click();
  });
}

module.exports = { hasFsAccess, pickDirectory, pickFileHandle, pickFilesWithInput };
