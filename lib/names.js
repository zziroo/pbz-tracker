'use strict';
// Node wrapper for display names: finds the text patches in the game folder, then resolves names with
// the portable lib/core/names.js (source order and notices are documented there). Never throws.
//   async createNames({ gameDir, uiLang = 'en', names, tables, patches } = {}) → names
//     patches: optional, already found text patches (skips the Paks/ scan)
//   titleCaseTr, EMBEDDED_TABLES: re-exported from the core
const { findTextPatches } = require('./locres');
const { createNamesFrom, titleCaseTr, EMBEDDED_TABLES } = require('./core/names');

async function createNames({ gameDir, uiLang = 'en', names, tables, patches } = {}) {
  return createNamesFrom({ patches: patches || await findTextPatches(gameDir), uiLang, names, tables });
}

module.exports = { createNames, titleCaseTr, EMBEDDED_TABLES };
