'use strict';
// Step 1 of the game-data pipeline: pull the DataTables, the map-item registry and the Game.locres files out of
// the game's encrypted IoStore container / pak and dump them (plus token scans) under data/game/raw (gitignored).
// Reads the game installation read-only. Needs the pak AES key (see README.md) and an Oodle DLL (lib/oodle-batch.js).
//
//   node research/gamedata/extract.js [--game <dir>] [--key <hex>|<file>] [--out <dir>]
//
// Key lookup order: --key, env PBZ_PAK_KEY, research/gamedata/pak.key (gitignored via *.key).
const fs = require('fs');
const path = require('path');
const { openToc } = require('./lib/iostore');
const { openPak } = require('./lib/pak');
const { scan, scanRaw } = require('./lib/dtscan');
const { Reader, readStruct, parse } = require('./lib/unversioned');
const { parseLocres } = require('../locres');

const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const GAME = opt('--game', process.env.PBZ_GAME_DIR || 'D:/SteamLibrary/steamapps/common/PBZ');
const OUT = path.resolve(opt('--out', path.join(ROOT, 'data', 'game', 'raw')));
function loadKey() {
  let k = opt('--key', process.env.PBZ_PAK_KEY || '');
  if (!k) { const f = path.join(__dirname, 'pak.key'); if (fs.existsSync(f)) k = fs.readFileSync(f, 'utf8'); }
  if (k && fs.existsSync(k)) k = fs.readFileSync(k, 'utf8');
  k = (k || '').trim().replace(/^0x/i, '');
  if (!/^[0-9a-f]{64}$/i.test(k)) throw new Error('pak AES key missing or not 64 hex digits (--key, PBZ_PAK_KEY or research/gamedata/pak.key)');
  return Buffer.from(k, 'hex');
}
const KEY = loadKey();
const PAKS = path.join(GAME, 'ProjectPBZ', 'Content', 'Paks');
const TMP = path.join(OUT, '_tmp');
fs.mkdirSync(OUT, { recursive: true });

// Tables whose rows we scan. Add a table here and a builder in build.js.
const TABLES = [
  'PBZContent/DataTable/UI/DT_WeaponData', 'PBZContent/DataTable/UI/DT_ShaqiWeaponData', 'PBZContent/DataTable/UI/DT_Accessory',
  'PBZContent/DataTable/UI/DT_MedicineTable', 'PBZContent/DataTable/Item/DT_InventoryData', 'PBZContent/DataTable/UI/DT_BellData',
  'PBZContent/DataTable/UI/DT_MapData', 'PBZContent/DataTable/UI/DT_ChapterData', 'PBZContent/DataTable/Narrative/DT_QuestText',
  'PBZContent/DataTable/DT_Achievement', 'PBZContent/DataTable/Item/DT_BookData', 'PBZContent/DataTable/Item/DT_CodexData',
  'PBZContent/DataTable/UI/DT_ShopItemTable',
];
const MAPITEM = 'PBZContent/Maps/DT_MapItemData';

// 1. IoStore container: DataTables + map-item registry
{
  const toc = openToc(path.join(PAKS, 'ProjectPBZ-Windows.utoc'), KEY);
  console.log('utoc: flags', toc.flags, 'chunks', toc.chunkCount, 'files', toc.files.length, 'methods', toc.methods.join(','));
  const want = new RegExp('ProjectPBZ/Content/(' + [...TABLES, MAPITEM].map((t) => t.replace(/[-/]/g, (c) => '\\' + c)).join('|') + ')\\.uasset$');
  const res = toc.extract(want, path.join(OUT, 'io'), TMP);
  const bad = res.filter((r) => !r.ok);
  console.log('io: extracted', res.length - bad.length, 'assets', bad.length ? 'FAILED: ' + bad.map((b) => b.rel).join(', ') : '');
  // directory listing for reference (asset paths only, no content)
  fs.writeFileSync(path.join(OUT, 'io-files.txt'), toc.files.map((f) => f.path).join('\n'));
  toc.close();
}

// 2. main pak: English and Simplified Chinese Game.locres
{
  const pak = openPak(path.join(PAKS, 'ProjectPBZ-Windows.pak'), KEY);
  console.log('pak: version', pak.version, 'files', pak.files.length);
  const res = pak.extract(/ProjectPBZ\/Content\/Localization\/Game\/(en-US|zh-Hans)\/Game\.locres$/, path.join(OUT, 'pak'), TMP);
  console.log('pak: extracted', res.filter((r) => r.ok).length, 'locres', res.filter((r) => !r.ok).length ? 'FAILED' : '');
  fs.writeFileSync(path.join(OUT, 'pak-files.txt'), pak.files.map((f) => f.path).join('\n'));
  pak.close();
  fs.mkdirSync(path.join(OUT, 'loc'), { recursive: true });
  for (const cul of ['en-US', 'zh-Hans']) {
    const f = path.join(OUT, 'pak', 'ProjectPBZ', 'Content', 'Localization', 'Game', cul, 'Game.locres');
    const r = parseLocres(fs.readFileSync(f));
    const flat = {}; for (const ns in r.out) Object.assign(flat, r.out[ns]);
    fs.writeFileSync(path.join(OUT, 'loc', cul + '.json'), JSON.stringify(flat));
    console.log('loc', cul, Object.keys(flat).length, 'keys');
  }
}

// 3. Turkish text patch (unencrypted pak v3 with one Game.locres), if installed
{
  const patch = path.join(PAKS, 'ProjectPBZ-Windows_C.pak');
  if (fs.existsSync(patch)) {
    const pk = openPak(patch, null);
    const ent = pk.files.find((f) => /Game\.locres$/.test(f.path));
    if (ent) {
      const e = pk.entry(ent.eo);
      const fd = fs.openSync(patch, 'r'); const b = Buffer.alloc(e.unc); fs.readSync(fd, b, 0, e.unc, e.off + 53); fs.closeSync(fd);
      const r = parseLocres(b); const flat = {}; for (const ns in r.out) Object.assign(flat, r.out[ns]);
      fs.writeFileSync(path.join(OUT, 'loc', 'patch-tr.json'), JSON.stringify(flat));
      console.log('loc patch-tr', Object.keys(flat).length, 'keys from', path.basename(patch));
    }
    pk.close();
  } else console.log('no Turkish patch pak found; TR names will be empty');
}

// 4. token scans of the tables
fs.mkdirSync(path.join(OUT, 'dt'), { recursive: true });
for (const t of TABLES) {
  const f = path.join(OUT, 'io', 'ProjectPBZ', 'Content', t + '.uasset');
  const r = scan(f);
  fs.writeFileSync(path.join(OUT, 'dt', path.basename(t) + '.json'), JSON.stringify(r));
  console.log('scan', path.basename(t), 'rows', r.numRows, 'found', r.found, r.found !== r.numRows ? '  <-- MISMATCH' : '');
}

// 5. map-item registry (schema-driven; schema-mapitem.json)
{
  const buf = fs.readFileSync(path.join(OUT, 'io', 'ProjectPBZ', 'Content', MAPITEM + '.uasset'));
  const pkg = parse(buf); const ex = buf.subarray(pkg.headerSize);
  const rd = new Reader(ex, pkg.names);
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema-mapitem.json'), 'utf8'));
  const obj = readStruct(rd, 'MapItemDataAsset', schema);
  console.log('mapitem: consumed', rd.p, 'of', ex.length, 'bytes (4 trailing = bHasGuid)');
  fs.writeFileSync(path.join(OUT, 'mapitem.json'), JSON.stringify(obj));
}
if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
console.log('done →', OUT);
