'use strict';
// Schema-driven reader for UE unversioned property data (zen exports). Fragment layout (FUnversionedHeader):
// bits 0-6 SkipNum, bit 7 HasAnyZeroes, bit 8 IsLast, bits 9-15 ValueNum; zero mask 1/2 bytes or u32 words.
// FName = (index u32, number u32); a non-zero number renders as name_(number-1) (e.g. ("R", 12008) → R_12007).
// Extra types used by this project: name4 (bare 4-byte name index), ivec3 (FIntVector), auto:A|B (pick the struct
// whose field count matches the header).
// Schema-driven unversioned property reader for zen exports.
// types: u8 i8 bool i16 u16 i32 u32 f32 i64 u64 f64 name str text soft obj guid vec3 vec3d rot3d transform
//        struct:<Name>  arr:<type>  map:<ktype>:<vtype>  set:<type>  tag (GameplayTag struct)
const fs=require('fs');const {parse}=require('./zenpkg');
class Reader{constructor(buf,names){this.b=buf;this.p=0;this.names=names;}
 u8(){return this.b[this.p++];} i8(){return this.b.readInt8(this.p++);} u16(){const v=this.b.readUInt16LE(this.p);this.p+=2;return v;} i16(){const v=this.b.readInt16LE(this.p);this.p+=2;return v;}
 i32(){const v=this.b.readInt32LE(this.p);this.p+=4;return v;} u32(){const v=this.b.readUInt32LE(this.p);this.p+=4;return v;} f32(){const v=this.b.readFloatLE(this.p);this.p+=4;return v;}
 i64(){const v=this.b.readBigInt64LE(this.p);this.p+=8;return Number(v);} f64(){const v=this.b.readDoubleLE(this.p);this.p+=8;return v;}
 name(){const i=this.u32(),n=this.u32();const s=this.names[i&0x3fffffff];if(s===undefined)throw new Error('bad name idx '+i+' at '+(this.p-8));return n?s+'_'+(n-1):s;}
 str(){const l=this.i32();if(l===0)return '';if(l<0){const s=this.b.subarray(this.p,this.p-2*l-2).toString('utf16le');this.p+=-2*l;return s;}if(l>100000)throw new Error('bad str len '+l+' at '+(this.p-4));const s=this.b.subarray(this.p,this.p+l-1).toString('utf8');this.p+=l;return s;}
 text(){const flags=this.u32();const t=this.i8();if(t===-1){const has=this.u32();return has?{inv:this.str()}:null;}if(t===0){const ns=this.str(),key=this.str(),src=this.str();return {ns,key,src};}if(t===11){/*StringTableEntry*/return {table:this.name(),key:this.str()};}throw new Error('unsupported text history '+t+' at '+this.p);}
 soft(){const pkg=this.name(),asset=this.name(),sub=this.str();return pkg==='None'?null:pkg+'.'+asset+(sub?':'+sub:'');}
}
function readHeader(rd){const frags=[];let zeroBits=0;for(;;){const v=rd.u16();const f={skip:v&0x7f,zeros:!!(v&0x80),last:!!(v&0x100),num:v>>9};frags.push(f);if(f.zeros)zeroBits+=f.num;if(f.last)break;if(frags.length>256)throw new Error('runaway header');}
 let mask=null;if(zeroBits){const nb=zeroBits<=8?1:zeroBits<=16?2:4*Math.ceil(zeroBits/32);mask=rd.b.subarray(rd.p,rd.p+nb);rd.p+=nb;}
 // expand to list of {index, zero}
 const present=[];let idx=0,zi=0;for(const f of frags){idx+=f.skip;for(let k=0;k<f.num;k++){let zero=false;if(f.zeros){zero=!!(mask[zi>>3]&(1<<(zi&7)));zi++;}present.push({index:idx++,zero});}}
 return present;}
function readValue(rd,type,schema){
 if(type.startsWith('arr:')){const n=rd.i32();if(n<0||n>1e6)throw new Error('bad array count '+n+' at '+rd.p);const inner=type.slice(4);const out=[];for(let i=0;i<n;i++)out.push(readValue(rd,inner,schema));return out;}
 if(type.startsWith('set:')){const rem=rd.i32();const n=rd.i32();const inner=type.slice(4);const out=[];for(let i=0;i<n;i++)out.push(readValue(rd,inner,schema));return out;}
 if(type.startsWith('map:')){const [,kt,vt]=type.match(/^map:([^:]+):(.+)$/);const rem=rd.i32();const n=rd.i32();if(n<0||n>1e6)throw new Error('bad map count '+n+' at '+rd.p);const out=[];for(let i=0;i<n;i++){const k=readValue(rd,kt,schema);const v=readValue(rd,vt,schema);out.push([k,v]);}return out;}
 if(type.startsWith('struct:')){return readStruct(rd,type.slice(7),schema);}
 if(type.startsWith('auto:')){const save=rd.p;const pres=readHeader(rd);rd.p=save;const n=pres.length?pres[pres.length-1].index+1:0;const cands=type.slice(5).split('|');const pick=cands.find(c=>schema[c]&&schema[c].length===n);if(!pick)throw new Error('auto: no struct with '+n+' fields among '+cands.join(',')+' at '+rd.p);return readStruct(rd,pick,schema);}
 switch(type){case 'u8':return rd.u8();case 'i8':return rd.i8();case 'bool':return !!rd.u8();case 'i16':return rd.i16();case 'u16':return rd.u16();case 'i32':return rd.i32();case 'u32':return rd.u32();case 'f32':return rd.f32();case 'i64':return rd.i64();case 'u64':return rd.i64();case 'f64':return rd.f64();
  case 'name':return rd.name();case 'name4':{const i=rd.u32();return rd.names[i&0x3fffffff]??('?'+i);}case 'str':return rd.str();case 'text':return rd.text();case 'soft':return rd.soft();case 'obj':return rd.i32();
  case 'guid':{const g=rd.b.subarray(rd.p,rd.p+16).toString('hex');rd.p+=16;return g;}
  case 'vec3':return [rd.f32(),rd.f32(),rd.f32()];case 'ivec3':return [rd.i32(),rd.i32(),rd.i32()];case 'vec3d':return [rd.f64(),rd.f64(),rd.f64()];case 'rot3d':return [rd.f64(),rd.f64(),rd.f64()];case 'quat4d':return [rd.f64(),rd.f64(),rd.f64(),rd.f64()];
  case 'transform':return {rot:[rd.f64(),rd.f64(),rd.f64(),rd.f64()],loc:[rd.f64(),rd.f64(),rd.f64()],scale:[rd.f64(),rd.f64(),rd.f64()]};
  case 'tag':return readStruct(rd,'GameplayTag',schema);
  default:throw new Error('unknown type '+type);}}
const TRACE=[];function readStruct(rd,sname,schema){const def=schema[sname];if(!def)throw new Error('no schema for '+sname);const hp=rd.p;const present=readHeader(rd);const out={};TRACE.push(sname+'@'+hp+'['+present.map(x=>x.index+(x.zero?'z':'')).join(',')+']');
 for(const {index,zero} of present){const prop=def[index];if(!prop)throw new Error(`struct ${sname}: property index ${index} beyond schema (${def.length}) at ${rd.p}`);const [pname,ptype]=prop;TRACE.push('.'+pname+'@'+rd.p);if(zero){out[pname]=zeroOf(ptype);continue;}out[pname]=readValue(rd,ptype,schema);}
 TRACE.push('}'+sname);return out;}
function zeroOf(t){if(t.startsWith('arr:')||t.startsWith('set:')||t.startsWith('map:'))return [];if(t==='name'||t==='name4')return 'None';if(t==='str')return '';if(t==='bool')return false;if(t==='text'||t==='soft')return null;if(t.startsWith('struct:')||t==='tag')return {};return 0;}
module.exports={Reader,readHeader,readValue,readStruct,zeroOf,parse,TRACE};
