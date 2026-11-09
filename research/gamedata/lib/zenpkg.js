'use strict';
// Zen (IoStore) package summary + name map reader for UE 5.7 cooked assets.
// Summary layout (verified): bHasVersioningInfo, HeaderSize, Name (FMappedName), PackageFlags, CookedHeaderSize, then
// NINE int32 offsets (ImportedPublicExportHashes, ImportMap, ExportMap, ExportBundleEntries, DependencyBundleHeaders,
// DependencyBundleEntries, ImportedPackageNames, CellImportMap, CellExportMap), then the name map (count, string bytes,
// hash algorithm id 0xC1640000, hashes, 2-byte headers, strings). Export data starts at HeaderSize.
// Usage: node zenpkg.js <uasset> [--names]
// Minimal zen (IoStore) package summary + name map reader. node zenpkg.js <uasset>
const fs=require('fs');
function parse(buf){let p=0;const u32=()=>{const v=buf.readUInt32LE(p);p+=4;return v;},i32=()=>{const v=buf.readInt32LE(p);p+=4;return v;};
 const hasVer=u32(),headerSize=u32(),nameIdx=u32(),nameNum=u32(),pkgFlags=u32(),cookedHeaderSize=u32();
 const impPubHashOff=i32(),importMapOff=i32(),exportMapOff=i32(),exportBundleOff=i32(),depHdrOff=i32(),depEntOff=i32(),impPkgNamesOff=i32(),cellImportOff=i32(),cellExportOff=i32();
 let versioning=null;if(hasVer){versioning={zenVersion:i32(),ue4:i32(),ue5:i32(),licensee:i32()};const n=i32();p+=n*20;/*custom versions*/}
 // name map
 const nameCount=i32(),numStringBytes=i32();const hashVer=buf.readBigUInt64LE(p);p+=8;p+=nameCount*8;const hdrs=[];for(let i=0;i<nameCount;i++){const b0=buf[p],b1=buf[p+1];p+=2;hdrs.push({utf16:!!(b0&0x80),len:((b0&0x7f)<<8)|b1});}
 const names=[];for(const h of hdrs){if(h.utf16){names.push(buf.subarray(p,p+h.len*2).toString('utf16le'));p+=h.len*2;}else{names.push(buf.subarray(p,p+h.len).toString('latin1'));p+=h.len;}}
 const afterNames=p;
 // import map
 const imports=[];for(let o=importMapOff;o<exportMapOff;o+=8){imports.push(buf.readBigUInt64LE(o).toString(16).padStart(16,'0'));}
 // export map (FExportMapEntry = 72 bytes)
 const exports_=[];for(let o=exportMapOff;o<exportBundleOff;o+=72){const e={cookedOff:Number(buf.readBigUInt64LE(o)),size:Number(buf.readBigUInt64LE(o+8)),name:names[buf.readUInt32LE(o+16)]+(buf.readUInt32LE(o+20)?'_'+(buf.readUInt32LE(o+20)-1):''),outer:buf.readBigUInt64LE(o+24).toString(16),cls:buf.readBigUInt64LE(o+32).toString(16),sup:buf.readBigUInt64LE(o+40).toString(16),tmpl:buf.readBigUInt64LE(o+48).toString(16),pubHash:buf.readBigUInt64LE(o+56).toString(16),flags:buf.readUInt32LE(o+64)};exports_.push(e);}
 return {hasVer,headerSize,pkgName:names[nameIdx],pkgFlags:pkgFlags.toString(16),cookedHeaderSize,impPubHashOff,importMapOff,exportMapOff,exportBundleOff,depHdrOff,depEntOff,impPkgNamesOff,versioning,names,afterNames,imports,exports:exports_};}
module.exports={parse};
if(require.main===module){const buf=fs.readFileSync(process.argv[2]);const r=parse(buf);const {names,...rest}=r;console.log(JSON.stringify(rest,null,1));console.log('names',names.length,names.join(' | '));}
