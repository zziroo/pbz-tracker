'use strict';
// Tool version (semver) and the game builds the tool has been verified against.
// Add a build here only after checking the key derivation, the save decode and the report on it.
const VERSION = '0.5.0';
const TESTED_BUILDS = ['26367565'];
// Public repository URL. null until the repository exists: the window then hides the link and the
// open-url allow-list does not contain it. Fill it in when the repository is published.
const REPO_URL = null;
const LICENSE = 'GPL-3.0-or-later';

module.exports = { VERSION, TESTED_BUILDS, REPO_URL, LICENSE };
