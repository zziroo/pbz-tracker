# Nexus Mods page draft

**Name:** pbz-tracker — Spoiler-free Missables Tracker

**Category:** Utilities

**Summary (short):** Reads your save (read-only) and warns you only when you are about to permanently miss a quest. No spoilers, no network, no install.

---

## Description

pbz-tracker is a standalone Windows tool, not a game mod. Nothing is installed into the game.

- **Spoiler-safe:** the default view shows only actionable warnings, with cutoffs described by position. Journal details are hidden until you press G or run with `--show`. Areas you have not reached are never shown.
- **Read-only:** it never writes to your save, backups, game folder or patches, and it never attaches to the game.
- **Offline:** no network access at all.
- **Works while playing:** `--watch` refreshes whenever the game saves.
- **English and Turkish UI.** Names come from a detected text patch (e.g. the Turkish fan translation), with English names as the fallback.

## Requirements

Phantom Blade Zero on Steam (PC). Tested with game build 26367565.

## Installation

Download `pbz-tracker-v0.3.0.exe` and run it from a terminal: `pbz-tracker-v0.3.0.exe --watch`.

The exe is not code-signed, so SmartScreen may warn. Source and build instructions: [GITHUB REPO LINK]. Latest release: [GITHUB RELEASE LINK].

## Permissions and credits

GPL-3.0-or-later. Oodle decompression is a JavaScript port of Powzix's ooz. Missable data is compiled from public guides (Game8, PowerPyx, DTGRE, Maxroll, allthings.how, Showgamer); see the repository for links.

Not affiliated with S-GAME.
