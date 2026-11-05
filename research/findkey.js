const fs=require('fs'),crypto=require('crypto');
const exe=process.argv[2];
const needle=Buffer.from('sealed but block is PLAINTEXT','utf16le');
const fd=fs.openSync(exe,'r');const size=fs.fstatSync(fd).size;
const CH=64*1024*1024, OV=needle.length+256;
let hits=[];
for(let pos=0;pos<size;pos+=CH){const len=Math.min(CH+OV,size-pos);const b=Buffer.alloc(len);fs.readSync(fd,b,0,len,pos);
 let i=-1;while((i=b.indexOf(needle,i+1))!==-1){const abs=pos+i;if(!hits.includes(abs))hits.push(abs);}}
console.log('size',size,'hits',hits);
for(const h of hits){const b=Buffer.alloc(512);fs.readSync(fd,b,0,512,h);console.log(h, b.toString('hex').match(/.{1,64}/g).join('\n'));}
