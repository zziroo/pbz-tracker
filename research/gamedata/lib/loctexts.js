'use strict';
// Ordered LocText keys of a scanned row: the game stores texts as a struct { FString Namespace = "Default", FString Key, FText }.
// Ordered LocText keys per row: pattern header(00 07 / 80 07+mask) + FString "Default" + FString key
const fs=require('fs');
function locTexts(body,toks){const out=[];for(let i=0;i<toks.length-1;i++){const a=toks[i],b=toks[i+1];if(a.t==='str'&&a.v==='Default'){ // key is the next str token immediately following (offset a.o+12)
   if(b.t==='str'&&b.o===a.o+12){out.push({o:a.o,key:b.v});i++;}else out.push({o:a.o,key:''});}}return out;}
module.exports={locTexts};
if(require.main===module){const r=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const want=(process.argv[3]||'').split(',');for(const row of r.rows){const last=row.toks.filter(t=>t.t==='name').pop();if(want[0]&&!want.includes(last&&last.v))continue;console.log((last?last.v:'-').padEnd(20),row.name.padEnd(14),JSON.stringify(locTexts(null,row.toks).map(x=>x.key)));}}
