import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HEROES} from '../../public/tidebreak/sim.js';
const root=new URL('../../public/tidebreak/art/animated/',import.meta.url);
const sources=JSON.parse(readFileSync(new URL('sources.json',root)));
assert.equal(sources.heroes.length,HEROES.length);
for(const hero of HEROES){
 const source=sources.heroes.find(h=>h.slug===hero.slug);assert(source);
 const bytes=readFileSync(new URL(hero.slug+'-idle.gif',root));assert.equal(bytes.toString('ascii',0,6),'GIF89a');assert.equal(bytes.length,source.bytes);
 assert.equal(bytes.readUInt16LE(6),source.width);assert.equal(bytes.readUInt16LE(8),source.height);
 let offset=13+(bytes[10]&128?3*(1<<((bytes[10]&7)+1)):0),frames=0;
 const skipBlocks=()=>{while(bytes[offset]){offset+=bytes[offset]+1;}offset++;};
 while(offset<bytes.length){const tag=bytes[offset++];if(tag===0x3b)break;
  if(tag===0x21){offset++;skipBlocks();}
  else if(tag===0x2c){const packed=bytes[offset+8];offset+=9;if(packed&128)offset+=3*(1<<((packed&7)+1));offset++;skipBlocks();frames++;}
  else throw Error('Invalid GIF block for '+hero.slug);
 }
 assert.equal(frames,source.frames);assert(frames>=24,'A hero must have a real animation');assert(bytes.includes(Buffer.from('NETSCAPE2.0')),'Loop extension is required');
}
console.log('All twelve GIFs pass byte counts, dimensions, decoded frame-block counts and loop checks.');
