'use strict';
// Native Windows pickers without dependencies: a short PowerShell (STA) script shows a
// FolderBrowserDialog / OpenFileDialog and prints the chosen path. Returns null on cancel or
// when no dialog can be shown (non-Windows, no desktop). Texts are passed via environment
// variables, so nothing user-controlled is spliced into the script.
const { execFileSync } = require('child_process');

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

function run(script, env) {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, ...env },
    });
    const p = out.replace(/^﻿/, '').trim();
    return p || null;
  } catch {
    return null; // no desktop / PowerShell unavailable / dialog failed: behave like cancel
  }
}

function pickFolder(text, start) {
  return run(FOLDER, { PBZ_PICK_TEXT: text, PBZ_PICK_START: start || '' });
}

function pickFile(text, filter, start) {
  return run(FILE, { PBZ_PICK_TEXT: text, PBZ_PICK_FILTER: filter, PBZ_PICK_START: start || '' });
}

module.exports = { pickFolder, pickFile };
