'use strict';
// Native Windows pickers without dependencies: a short PowerShell (STA) script shows a
// FolderBrowserDialog / OpenFileDialog and prints the chosen path. Returns null on cancel or
// when no dialog can be shown (non-Windows, no desktop). Texts are passed via environment
// variables, so nothing user-controlled is spliced into the script.
const { execFileSync, execFile } = require('child_process');

const PRELUDE = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }
`;

const FOLDER = PRELUDE + `
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = $env:PBZ_PICK_TEXT
$d.ShowNewFolderButton = $false
if ($env:PBZ_PICK_START -and (Test-Path -LiteralPath $env:PBZ_PICK_START)) { $d.SelectedPath = $env:PBZ_PICK_START }
if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }
`;

const FILE = PRELUDE + `
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = $env:PBZ_PICK_TEXT
$d.Filter = $env:PBZ_PICK_FILTER
$d.CheckFileExists = $true
$d.Multiselect = $false
if ($env:PBZ_PICK_START -and (Test-Path -LiteralPath $env:PBZ_PICK_START)) { $d.InitialDirectory = $env:PBZ_PICK_START }
if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.FileName) }
`;

// Error box for the window mode when there is no console to print to (title/text via env vars too).
const MESSAGE = PRELUDE + `
[void][System.Windows.Forms.MessageBox]::Show($owner, $env:PBZ_MSG_TEXT, $env:PBZ_MSG_TITLE, 'OK', 'Error')
`;

const PS_ARGS = (script) => ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script];
const clean = (out) => String(out || '').replace(/^\uFEFF/, '').trim() || null;

function run(script, env) {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('powershell.exe', PS_ARGS(script), {
      encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, ...env },
    });
    return clean(out);
  } catch {
    return null; // no desktop / PowerShell unavailable / dialog failed: behave like cancel
  }
}

// Same, without blocking the event loop (the window mode keeps serving heartbeats while a dialog is open).
function runAsync(script, env) {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile('powershell.exe', PS_ARGS(script), {
      encoding: 'utf8', windowsHide: true, env: { ...process.env, ...env },
    }, (err, out) => resolve(err ? null : clean(out)));
  });
}

function pickFolder(text, start) {
  return run(FOLDER, { PBZ_PICK_TEXT: text, PBZ_PICK_START: start || '' });
}

function pickFile(text, filter, start) {
  return run(FILE, { PBZ_PICK_TEXT: text, PBZ_PICK_FILTER: filter, PBZ_PICK_START: start || '' });
}

const pickFolderAsync = (text, start) => runAsync(FOLDER, { PBZ_PICK_TEXT: text, PBZ_PICK_START: start || '' });
const pickFileAsync = (text, filter, start) => runAsync(FILE, { PBZ_PICK_TEXT: text, PBZ_PICK_FILTER: filter, PBZ_PICK_START: start || '' });

// Blocking error box (window mode without a console). Returns false if it could not be shown.
function showError(title, text) {
  if (process.platform !== 'win32') return false;
  try {
    execFileSync('powershell.exe', PS_ARGS(MESSAGE), { windowsHide: true, stdio: 'ignore', env: { ...process.env, PBZ_MSG_TITLE: title, PBZ_MSG_TEXT: text } });
    return true;
  } catch { return false; }
}

module.exports = { pickFolder, pickFile, pickFolderAsync, pickFileAsync, showError };
