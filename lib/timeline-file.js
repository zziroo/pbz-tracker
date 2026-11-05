'use strict';
// Node storage for the quest timeline (lib/timeline.js): pbz-tracker.timeline.json next to
// pbz-tracker.config.json (lib/config.js appDir: the exe's folder, or the project root with node).
// Written through a temporary file and a rename, so a crash never leaves half a file. One shared
// timeline per process (the window re-creates its session on every reload; the timeline stays).
const fs = require('fs');
const path = require('path');
const { appDir } = require('./datafiles');
const { createTimeline } = require('./timeline');
const { t } = require('./i18n');

const timelinePath = () => path.join(appDir(), 'pbz-tracker.timeline.json');

function load() {
  let text;
  try { text = fs.readFileSync(timelinePath(), 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  return JSON.parse(text.replace(/^﻿/, ''));
}

function save(data) {
  const file = timelinePath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data) + '\n');
  fs.renameSync(tmp, file);
}

// "Delete timeline" in the window: only these two files of our own, never anything else.
function remove() {
  fs.rmSync(`${timelinePath()}.tmp`, { force: true });
  fs.rmSync(timelinePath(), { force: true });
}

let shared = null;
function fileTimeline() {
  if (!shared) {
    shared = createTimeline({
      load, save, remove,
      // Once per run, on stderr only (stdout stays the report). Code only: messages may contain paths.
      warn: (e) => console.error(t('timeline.fail', { code: (e && (e.code || e.name)) || 'error' })),
    });
  }
  return shared;
}

module.exports = { fileTimeline, timelinePath };
