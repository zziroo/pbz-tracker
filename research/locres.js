const fs=require('fs');
function parseLocres(d){let p=0;const magic=d.subarray(0,16).toString('hex');p=16;const ver=d[p++];
 const rdI32=()=>{const v=d.readInt32LE(p);p+=4;return v},rdU32=()=>{const v=d.readUInt32LE(p);p+=4;return v};
 const rdStr=()=>{const n=rdI32();if(n===0)return'';if(n<0){const s=d.subarray(p,p+(-n)*2).toString('utf16le');p+=(-n)*2;return s.replace(/\0$/,'')}const s=d.subarray(p,p+n).toString('latin1');p+=n;return s.replace(/\0$/,'')};
 const strOff=Number(d.readBigInt64LE(p));p+=8;if(ver>=2)rdU32();
 const save=p;p=strOff;const cnt=rdI32();const strs=[];for(let i=0;i<cnt;i++){strs.push(rdStr());if(ver>=2)rdI32();}
 p=save;const nsCount=rdU32();const out={};
 for(let n=0;n<nsCount;n++){if(ver>=2)rdU32();const ns=rdStr();const kc=rdU32();const m=out[ns]={};
  for(let k=0;k<kc;k++){if(ver>=2)rdU32();const key=rdStr();rdU32();const idx=rdI32();m[key]=strs[idx];}}
 return {ver,out,count:cnt};}
module.exports={parseLocres};
if(require.main===module){const buf=fs.readFileSync(process.argv[2]);const off=+process.argv[3];const r=parseLocres(buf.subarray(off));
 fs.writeFileSync(process.argv[4],JSON.stringify(r.out,null,1));const ns=Object.keys(r.out);console.log('ver',r.ver,'strings',r.count,'namespaces',ns.length, ns.slice(0,20).map(n=>n+':'+Object.keys(r.out[n]).length));}
