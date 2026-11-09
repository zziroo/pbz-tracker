'use strict';
// The compact map-completion table (lib/completion.js buildTable) from the game-data tables in data/game.
// Node and the tests build it here at load time; the web bundle does not carry data/game: build/build.js replaces
// this module with the table it computed at build time (`module.exports = {...}`), so the page embeds only the
// compact table (categories, codes, names, detection keys, nearest bells; no coordinates).
const { buildTable } = require('./completion');

module.exports = buildTable(require('../data/game/map-items.json'), require('../data/game/code-index.json'), require('../data/game/maps.json'));
