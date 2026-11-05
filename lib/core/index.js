'use strict';
// Portable engine core: runs unchanged in Node and in a browser. Only relative requires, Uint8Array /
// DataView / TextDecoder and WebCrypto (globalThis.crypto.subtle); no Node built-ins or globals.
// test/core-portability.js enforces this for every file under lib/core and the pure modules it uses.
//
// Positioned reader (readers.js): { size, name?, read(offset, length) → Promise<Uint8Array>, close?() }
//
//   readers.fromBytes(u8, name?) / readers.fromBlob(blob, name?)            → reader
//   async deriveKeyFromReader(exeReader, { label }?)                         → Uint8Array(32)   (key.js)
//   async decodeSave(saveBytes, key)                                         → { slots, latest } (container.js)
//   TransientError                                                           (container.js)
//   async findTextPatchesFrom(listPaks, openReader)                          → patch info[]      (locres.js)
//   async inspectPak(reader, { name, pakPath }?)                             → patch info        (locres.js)
//   parseLocres(u8), looksTurkish(map)                                       (locres.js)
//   createNamesFrom({ patches, uiLang, names, tables })                      → names             (names.js)
//   oodle.decompress(u8, rawSize)                                            → Uint8Array        (oodle/)
//
// The pure report modules next to the core (lib/state.js extract, lib/report.js build/render,
// lib/viewmodel.js, lib/i18n.js) are browser-safe too and are required from there directly.
const readers = require('./readers');
const bytes = require('./bytes');
const oodle = require('./oodle');
const { deriveKeyFromReader } = require('./key');
const { decodeSave, parseContainer, importKey, TransientError } = require('./container');
const { findTextPatchesFrom, inspectPak, parseLocres, looksTurkish } = require('./locres');
const { createNamesFrom, titleCaseTr, EMBEDDED_TABLES } = require('./names');

module.exports = {
  readers, bytes, oodle,
  deriveKeyFromReader,
  decodeSave, parseContainer, importKey, TransientError,
  findTextPatchesFrom, inspectPak, parseLocres, looksTurkish,
  createNamesFrom, titleCaseTr, EMBEDDED_TABLES,
};
