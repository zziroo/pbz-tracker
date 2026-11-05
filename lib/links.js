'use strict';
// Guides and technical credits for the About tab, shared by the local window (lib/server.js) and the
// web version (web/). Labels are i18n keys and spoiler-free; DTGRE is linked by its home page only,
// because its article addresses contain spoilers (see README "Sources").
// No Node built-ins: also used by the browser build.
const LINKS = [
  { key: 'link.game8', url: 'https://game8.co/games/Phantom-Blade-Zero/archives/634952' },
  { key: 'link.powerpyx', url: 'https://powerpyx.com/phantom-blade-zero-trophy-guide-roadmap' },
  { key: 'link.dtgre', url: 'https://www.dtgre.com' },
  { key: 'link.steamGuides', url: 'https://steamcommunity.com/app/4115450/guides/' },
  { key: 'link.steamForum', url: 'https://steamcommunity.com/app/4115450/discussions/0/572679490124259489/' },
  { key: 'link.ooz', url: 'https://github.com/powzix/ooz' },
];

// The only URLs the page may open: the repository (when it exists) and the links above.
const allowedUrls = (repoUrl) => new Set([repoUrl, ...LINKS.map((l) => l.url)].filter(Boolean));

module.exports = { LINKS, allowedUrls };
