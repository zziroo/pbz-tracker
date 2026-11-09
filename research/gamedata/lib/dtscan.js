'use strict';
// Schema-free DataTable scanner: finds the row boundaries of a zen DataTable export (FName row name followed by the
// unversioned header of the row struct) and lists the FString / FText / FName tokens of each row. The row struct
// schema (usmap) is not needed: for the tables we use, the first LocText key is the display-name key and the last
// non-tag FName is the save code. Usage: node dtscan.js <uasset> <out.json> [--raw]
// Schema-free DataTable scanner: finds row boundaries and extracts FString / FText / FName tokens per row.
// node dtscan.js <uasset> <out.json>
const fs=require('fs');const {parse}=require('./zenpkg');
function readFragments(ex,p){const frags=[];let total=0,zeroBits=0;for(;;){const v=ex.readUInt16LE(p);p+=2;const f={skip:v&0x7f,zeros:!!(v&0x80),last:!!(v&0x100),num:v>>9};frags.push(f);total+=f.num;if(f.zeros)zeroBits+=f.num;if(f.last)break;if(frags.length>64)throw new Error('runaway header');}
 let maskBytes=0;if(zeroBits>0)maskBytes=zeroBits<=8?1:zeroBits<=16?2:4*Math.ceil(zeroBits/32);return {frags,total,zeroBits,maskBytes,end:p+maskBytes,hdrBytes:frags.length*2};}
function scanRaw(file){const buf=fs.readFileSync(file);const r=parse(buf);const ex=buf.subarray(r.headerSize);const N=r.names.length;const body=ex;const toks=[];
 for(let o=0;o<=body.length-5;o++){const len=body.readInt32LE(o);if(len>1&&len<=400&&o+4+len<=body.length&&body[o+4+len-1]===0){const s8=body.subarray(o+4,o+4+len-1);let ok=true;for(const b of s8){if(b<0x20||b===0x7f){ok=false;break;}}if(ok&&s8.length>0){toks.push({t:'str',o,v:s8.toString('utf8')});o+=4+len-1;continue;}}}
 const inStr=new Uint8Array(body.length);for(const t of toks){const L=4+Buffer.byteLength(t.v)+1;for(let k=t.o;k<t.o+L&&k<body.length;k++)inStr[k]=1;}
 for(let o=0;o<=body.length-8;o++){if(inStr[o])continue;const idx2=body.readUInt32LE(o),num2=body.readUInt32LE(o+4);if(idx2<N&&num2<64){const nm=r.names[idx2];if(nm&&nm!=='None'){toks.push({t:'name',o,v:nm+(num2?'_'+(num2-1):'')});}}}
 toks.sort((a,b)=>a.o-b.o);return {file,numRows:0,found:1,exportLen:ex.length,exports:r.exports.map(e=>({name:e.name,off:e.cookedOff,size:e.size})),rows:[{name:'RAW',start:0,len:ex.length,hdr:[],zeroBits:0,toks}]};}
function scan(file){const buf=fs.readFileSync(file);const r=parse(buf);const ex=buf.subarray(r.headerSize);const N=r.names.length;
 const numRows=ex.readUInt32LE(10);let p=14;
 const row0=readFragments(ex,p+8);const hdrSig=ex.subarray(p+8,p+8+row0.hdrBytes);
 // row starts: FName (idx<N, num<4096) followed by identical fragment bytes
 function findStarts(relaxed){const st=[];for(let q=p;q<=ex.length-8-row0.hdrBytes;q++){const idx=ex.readUInt32LE(q),num=ex.readUInt32LE(q+4);if(idx>=N||num>4096)continue;let same=true;for(let k=0;k<row0.hdrBytes;k+=2){const a=ex.readUInt16LE(q+8+k),b=hdrSig.readUInt16LE(k);if(relaxed?((a&~0x80)!==(b&~0x80)):(a!==b)){same=false;break;}}if(!same)continue;st.push(q);}return st;}
 let starts=findStarts(false);if(starts.length<numRows){starts=findStarts(true);}
 const firstName=r.names[ex.readUInt32LE(p)]||"";if(firstName.startsWith("/")&&starts.length>numRows){starts=starts.filter(q=>{const nm=r.names[ex.readUInt32LE(q)]||"";return nm.startsWith("/")&&nm.includes(".");});}
 if(starts.length!==numRows){const seen=new Set();const filtered=[];for(const q of starts){const idx=ex.readUInt32LE(q),num=ex.readUInt32LE(q+4);const nm=r.names[idx]+(num?"_"+(num-1):"");if(seen.has(nm))continue;seen.add(nm);filtered.push(q);}
  const first=r.names[ex.readUInt32LE(filtered[0])]||"";if(filtered.length>numRows&&!first.startsWith("/")){const f2=filtered.filter(q=>!r.names[ex.readUInt32LE(q)].startsWith("/"));filtered.length=0;filtered.push(...f2);}
  console.error("  row count mismatch",starts.length,"vs",numRows,"after dedupe",filtered.length,"names:",filtered.map(q=>{const idx=ex.readUInt32LE(q),num=ex.readUInt32LE(q+4);return r.names[idx]+(num?"_"+(num-1):"");}).join(","));while(filtered.length>numRows){let worst=-1,wl=Infinity;for(let i=1;i<filtered.length;i++){const l=filtered[i]-filtered[i-1];if(l<wl){wl=l;worst=i;}}const idx=ex.readUInt32LE(filtered[worst]);console.error("  dropping candidate",r.names[idx],"preceding row len",wl);filtered.splice(worst,1);}
  starts=filtered;}
 const rows=[];
 for(let i=0;i<starts.length;i++){const s=starts[i],e=i+1<starts.length?starts[i+1]:ex.length;const idx=ex.readUInt32LE(s),num=ex.readUInt32LE(s+4);const name=r.names[idx]+(num?'_'+(num-1):'');
  const h=readFragments(ex,s+8);const body=ex.subarray(h.end,e);const toks=[];
  // FString / FText tokens
  for(let o=0;o<=body.length-5;o++){const len=body.readInt32LE(o);
   if(len>1&&len<=400&&o+4+len<=body.length&&body[o+4+len-1]===0){const s8=body.subarray(o+4,o+4+len-1);let ok=true;for(const b of s8){if(b<0x20||b===0x7f){ok=false;break;}}if(ok&&s8.length>0){toks.push({t:'str',o,v:s8.toString('utf8')});o+=4+len-1;continue;}}
   if(len<-1&&len>=-400&&o+4-2*len<=body.length&&body.readUInt16LE(o+4-2*len-2)===0){toks.push({t:'wstr',o,v:body.subarray(o+4,o+4-2*len-2).toString('utf16le')});o+=4-2*len-1;continue;}}
  // FName tokens (8 bytes) excluding ones inside strings
  const inStr=new Uint8Array(body.length);for(const t of toks){const L=t.t==='str'?4+Buffer.byteLength(t.v)+1:4+2*t.v.length+2;for(let k=t.o;k<t.o+L&&k<body.length;k++)inStr[k]=1;}
  for(let o=0;o<=body.length-8;o++){if(inStr[o])continue;const idx2=body.readUInt32LE(o),num2=body.readUInt32LE(o+4);if(idx2<N&&(num2<64||(num2<10000000&&r.names[idx2]&&!/d$/.test(r.names[idx2])&&!r.names[idx2].startsWith('/')))){const nm=r.names[idx2];if(nm&&nm!=='None'&&!nm.startsWith('/')){toks.push({t:'name',o,v:nm+(num2?'_'+(num2-1):'')});}}}
  toks.sort((a,b)=>a.o-b.o);
  rows.push({name,start:s,len:e-s,hdr:h.frags,zeroBits:h.zeroBits,toks});}
 return {file,numRows,found:starts.length,exportLen:ex.length,rows};}
if(require.main===module){const [f,out,mode]=process.argv.slice(2);const res=mode==='--raw'?scanRaw(f):scan(f);fs.writeFileSync(out,JSON.stringify(res,null,0));console.log(f.split('/').pop(),'rows',res.numRows,'found',res.found,'export',res.exportLen);
 for(const row of res.rows.slice(0,2)){console.log('  ROW',row.name,'len',row.len,'hdr',JSON.stringify(row.hdr),'zeroBits',row.zeroBits);console.log('   ',row.toks.map(t=>t.t[0]+'@'+t.o+':'+t.v).join(' | ').slice(0,1500));}}
module.exports={scan,scanRaw};
