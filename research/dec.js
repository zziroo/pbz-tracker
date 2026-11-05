const fs=require('fs'),crypto=require('crypto');
const [exe,sav]=process.argv.slice(2);
const fd=fs.openSync(exe,'r');const base=203657830;const win=Buffer.alloc(200);fs.readSync(fd,win,0,200,base);
function open(key,blk){const nonce=blk.subarray(8,20),tag=blk.subarray(20,36),ct=blk.subarray(36);
 const d=crypto.createDecipheriv('aes-256-gcm',key,nonce);d.setAuthTag(tag);return Buffer.concat([d.update(ct),d.final()]);}
const s=fs.readFileSync(sav);const dirLen=s.readUInt32LE(8);const dirBlk=s.subarray(12,12+dirLen);
console.log('ver',s[4],'flags',s[5],'slots',s.readUInt16LE(6),'dirLen',dirLen);
for(let off=58;off<=80;off++){const m=win.subarray(off,off+64);
 const h=crypto.createHash('sha256').update(m).digest('hex');
 const key=Buffer.alloc(32);for(let i=0;i<32;i++)key[i]=m[i]^m[32+i];
 let ok=false,dir;try{dir=open(key,dirBlk);ok=true}catch(e){}
 if(ok||h.startsWith('cec857')){console.log('off',off,'sha',h,'decrypt',ok);
  if(ok){fs.writeFileSync(process.env.S+'/key.bin',key);fs.writeFileSync(process.env.S+'/dir.bin',dir);
   let p=0,ents=[];while(p<dir.length){const nl=dir.readUInt16LE(p);p+=2;const name=dir.subarray(p,p+nl).toString('utf8');p+=nl;
    const alg=dir[p],flag=dir[p+1],raw=dir.readUInt32LE(p+2),o=dir.readUInt32LE(p+6),bs=dir.readUInt32LE(p+10);p+=14;ents.push({name,alg,flag,raw,o,bs});}
   console.table(ents);}
 }}
