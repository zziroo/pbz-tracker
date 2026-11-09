# Game-data pipeline (research/gamedata)

Derives the code → name tables in `data/game/` straight from the game's own DataTables instead of guessing them
from guides. Two scripts, both read the game installation read-only and write only under the repo:

```bash
node research/gamedata/extract.js            # game paks → data/game/raw/ (gitignored)
node research/gamedata/build.js              # raw dumps  → data/game/*.json
node research/gamedata/build.js --save archive/<decoded save>.json   # + match a save's codes, recompute map completion
```

No game asset enters the repo: `data/game/raw/` (extracted `.uasset`, `.locres`, token dumps) and
`research/gamedata/out/` (per-save reports) are ignored; only the derived JSON id/name tables are committed.

## Inputs

| What | Where | Notes |
|------|-------|-------|
| Main container | `ProjectPBZ/Content/Paks/ProjectPBZ-Windows.utoc/.ucas` (+ `_s1`…`_s65`) | IoStore TOC v8, flags 0x0b = compressed + encrypted + indexed, Oodle Kraken |
| Main pak | `ProjectPBZ-Windows.pak` | pak v12, encrypted index, holds the non-asset files (`Game.locres`, `.ini`, puerts `.js`) |
| Turkish text patch | `ProjectPBZ-Windows_C.pak` | pak v3, unencrypted, one `Game.locres` (replaces en-US) |
| Pak AES key | `--key`, `PBZ_PAK_KEY`, or `research/gamedata/pak.key` (ignored by `*.key`) | 32 bytes. Not in the exe in plain form (Denuvo-protected); the key used here is one that was posted publicly by the UE modding community and was verified by decrypting the TOC directory index and the pak index (both start with the mount point `../../../`). |
| Oodle DLL | `OODLE_DLL` or auto-found `oo2core_*_win64.dll` in a Steam library | Used in place through `test/oodle-dll.ps1`; the project's JS Oodle only decodes Mermaid (save slots). |

Build used: Steam build 26367565 (2026-11-04), UE 5.7.

## Formats worked out along the way

- **IoStore TOC v8** (`lib/iostore.js`): header fields at fixed offsets, chunk ids (type byte last),
  `FIoOffsetAndLength` is 5-byte **big-endian** offset + length, compression block entries are little-endian
  (5-byte offset, 3-byte compressed size, 3-byte uncompressed size, method). Blocks are AES-256-ECB over the
  compressed block padded to 16, then Oodle. Partitions of 2 GiB → `.ucas`, `_s1.ucas`, ….
- **pak v12** (`lib/pak.js`): encoded entries — when the block-size bits are 0x3f the explicit u32 block size
  comes right after the flags, *before* the offset. Each entry's data is preceded by a serialized `FPakEntry`
  (53 bytes, + 4 + 16·blocks when compressed).
- **Zen package summary, UE 5.7** (`lib/zenpkg.js`): nine int32 offsets after `CookedHeaderSize`
  (the 5.6+ cell import/export map offsets are appended), then the name map. Export data starts at `HeaderSize`.
- **Unversioned properties** (`lib/unversioned.js`): fragment = u16, bits 0-6 skip, 7 has-zeros, 8 is-last,
  9-15 value count; zero mask 1/2 bytes or u32 words. `FName` = index + number, number > 0 renders as
  `name_(number-1)`: codes such as `R_12007`, `TU_11009`, `Weapon_Material_10` are stored as
  `("R", 12008)`, `("TU", 11010)`, `("Weapon_Material", 11)`; codes with a leading zero (`R_01016`, `I_060002`)
  stay literal names.
- **Texts**: every display text is a struct `{ FString Namespace = "Default", FString Key, FText }`; the key is the
  `Game.locres` key (`Weapon_003`, `Item_Accessory_048`, `Bell_NLES_001`, `Reading_Xigu_Letter_016`, …).
  `FText` = u32 flags, i8 history type, then Base (namespace, key, source) or None (u32 has-invariant-string).
- **DataTable export**: table header (1 value: RowStruct import) · u32 bHasGuid · i32 row count · rows of
  `FName RowName` + unversioned struct. Row structs are native (`/Script/ProjectPBZ.WeaponData`, `PBZItemDataStruct`,
  `AccessoryData`, `BellDataStruct`, `MapData`, …), so without a usmap the rows are read schema-free
  (`lib/dtscan.js`): row boundaries = row-name FName followed by the same header bytes, then FString/FText/FName
  tokens. Checks: found rows == row count for every table; every code of a real save matched.
- **DT_MapItemData** (`schema-mapitem.json`): `MapItemDataAsset` = `TMap<FName map, FSubMapItemData>` +
  `TMap<FName map, { TArray<FName> ids }>`. The sub struct has 13 arrays (bells; two chest/mob-domain lists;
  memory flowers; keys; "primary" chest items; weapons; phantom edges; accessories; medicines; and the
  RongShu / LongZhu / DaoCaoRen challenge points). Element structs: bells `{BellID, MapID, FIntVector}`;
  7-field `{SaveGuid (actor name), ItemID, NodeGuids[], MobDomainName, FlowEvent, MapID, FIntVector}`;
  8-field `{ID, SaveGuid, MobDomainName, NodeGuids[], Extra, FlowEvent, MapID, FIntVector}`. Parsed to the last
  4 bytes (bHasGuid) of the export.

## Outputs (`data/game/`)

| File | Rows | Key fields |
|------|------|------------|
| `weapons.json` | 33 rows / 33 codes | `code` (save `MainWeaponInfos` key), `nameKey` (`Weapon_NNN`), `name.{en,zh,tr}`, `descKey` |
| `phantom-edges.json` | 28 rows / 27 codes | same, keys `PhantomEdges_NNN` (save `ShaChiWeaponInfo`) |
| `accessories.json` | 73 codes (66 named, 7 unused) | `AC_*` → `Item_Accessory_NNN`, refined name, descriptions |
| `medicines.json` | 17 | `Hulu`, `NingFengDan`, `Medicine_*` → `Item_Medicine_NNN` |
| `items.json` | 640 | every `InventoryInfos` code: name/desc/function keys, prefix category, map, book, memory-flower group, gameplay tags |
| `bells.json` | 187 | bell id → name key, map, fog region, linked bell |
| `maps.json` | 15 maps + 12 chapters | map id → `Levelname_*` key, chapter row, world partition |
| `quests.json` | 80 quest classes | class path → title key (QuestStory/Maze/Rumor/Collect, or the Chapter/Bell key the quest log reuses) + branch texts |
| `achievements.json` | 66 | id → name/description keys, unlock tag |
| `map-items.json` | 15 maps | the completion registry (see below) + `allItemIds` per map |
| `code-index.json` | one flat lookup | every known code → table, name key, en/zh/tr |

Save check (2026-11-09 save, cycle 0): items 610/610, weapons 25/25, phantom edges 24/24, accessories 63/63,
medicines 17/17, bells 172/172 matched; quests 64/71 (the 7 unmatched are tutorial quests and
`XiGuShenChu`, `MainCh2-SiDaSheWu`, which have no DT_QuestText row).

## Map completion (what the game's "%" counts)

Mirrors `Content/JavaScript/Library/MapItemCompletionCalc.js` (puerts TypeScript shipped in the pak) and the
map panel `UI/Widget/Foundation/MapItemCompletion.js`. Per map (merge groups `pangzhen+houjie`,
`meiguhu+meigu_yiji`; `test`, `huanshushi`, `xuesesenlin` excluded from the total), each entry of
`DT_MapItemData` counts 1:

| Category | Counted when |
|----------|--------------|
| bells (deduplicated) | id in `BellManager.ActivateBellIDs` |
| weapons (not `zimingjian`), phantom edges, accessories, medicines | present in the save's `*Infos` with `AcquiredCycle == CycleCount` |
| challenges (RongShu / LongZhu / DaoCaoRen) | any `NodeGuids` entry is a key of `EventPipeline.ExecuteNodeGuid` |
| domain items (the two chest/mob-domain lists: amber, blackstone) | `SaveGuid` has `LevelActorManager` data, or `MobDomainName` ∈ `PBZGameSystem.CompleteAddItemMobDomainNames`, or any node executed |
| memory flowers | item in `InventoryInfos` this cycle; whole-flower `FA_*` entries with more than one petal are skipped (petals count individually) |

`percent = floor(current / total * 100)`. `build.js --save` prints the recomputation and the missing entries with
their world coordinates. `keys` and `primaryItems` are shown on the map but are not part of the percentage.

## Limitations

- Enum / numeric row fields (ItemType, prices, levels, positions in DataTables) are not decoded; item categories
  come from the code prefix. A usmap (e.g. the one on Nexus, mod 55) would allow a full typed parse through
  `lib/unversioned.js`.
- Turkish texts come from the community patch, so `tr` is empty where the patch has no entry and the patch's
  casing (often ALL CAPS) is kept as-is; the app title-cases at display time.
- `DT_QuestText` has no rows for the tutorial quests, `XiGuShenChu` and `MainCh2-SiDaSheWu`; their titles stay as they were in `data/names.json`.
- The pre-existing `test/core-e2e.js` failure "corrupted save throws" is unrelated to this pipeline (it fails on a clean tree too).
