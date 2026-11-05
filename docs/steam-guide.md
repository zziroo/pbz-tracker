# Steam Community Guide draft

Title: **Never miss a quest: spoiler-free missables tracker (reads your save, read-only)**

Category: Walkthroughs / Achievements. Language: English.

---

**What it is**

pbz-tracker is a small, free, open-source tool that reads your Phantom Blade Zero save and tells you when you are about to permanently lose a quest. It does not spoil anything ahead of you: warnings describe *where* to stop ("before this area's final fight"), not *who* or *what* is there.

**Is it safe?**

- It only reads files and never writes to your save, backups or game files.
- It makes no network connections.
- It does not touch the running game. You can keep it open in a second window while you play.
- It is open source (GPL-3.0): [GITHUB REPO LINK]

**How to use**

1. Download `pbz-tracker-v0.3.0.exe` from [GITHUB RELEASE LINK].
2. Open a terminal in the download folder and run `pbz-tracker-v0.3.0.exe --watch`.
3. Play. Whenever the game saves (resting at a bell or autosave), the tracker refreshes.
4. Press **G** to peek at your journal status and anything already missed. It hides again on the next refresh.

**What you see by default**

Only warnings that need action now, or: "No risk of missing anything right now."

**Notes**

- Tested with game build 26367565. On a newer build it tells you so.
- Windows may show a SmartScreen warning because the exe is not signed. The source code is linked above if you prefer to build it yourself.
- Missable data comes from public guides (credits in the repository).
