const fs=require('fs'),crypto=require('crypto'),path=require('path');
const [sav,outdir]=process.argv.slice(2);const key=fs.readFileSync(path.join(__dirname,'..','key.bin'));
function open(blk){const d=crypto.createDecipheriv('aes-256-gcm',key,blk.subarray(8,20));d.setAuthTag(blk.subarray(20,36));return Buffer.concat([d.update(blk.subarray(36)),d.final()]);}
const s=fs.readFileSync(sav);const dirLen=s.readUInt32LE(8);const dir=open(s.subarray(12,12+dirLen));const base=12+dirLen;
let p=12,ents=[];while(p<dir.length){const nl=dir.readUInt16LE(p);p+=2;const name=dir.subarray(p,p+nl).toString();p+=nl;
 const e={name,alg:dir[p],flag:dir[p+1],raw:dir.readUInt32LE(p+2),off:dir.readUInt32LE(p+6),bs:dir.readUInt32LE(p+10)};p+=14;ents.push(e);
 const plain=open(s.subarray(base+e.off,base+e.off+e.bs));fs.mkdirSync(outdir,{recursive:true});fs.writeFileSync(path.join(outdir,name+'.cmp'),plain);e.plainLen=plain.length;e.head=plain.subarray(0,8).toString('hex');}
console.table(ents);fs.writeFileSync(path.join(outdir,'index.json'),JSON.stringify(ents));
