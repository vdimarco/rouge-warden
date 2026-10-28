import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../public/vr/js/actionview.js',import.meta.url),'utf8');
const helper=source.match(/const addSlot = \(c, i, d\) => \{[\s\S]*?\n  \};/)?.[0];assert.ok(helper,'production slot helper exists');
const slots=[],pool=[],add=new Function('slots','slotPool',helper+'; return addSlot;')(slots,pool);
const identities=new Set();
for(let frame=0;frame<100;frame++){
 const count=frame===0?8:frame%9,reference=[];slots.length=0;
 for(let i=0;i<count;i++){
  const c=(frame+i)%2?{id:i}:null,index=100+i,d=i===0?-1:i%3;
  add(c,index,d);reference.push({c,i:index,d});identities.add(slots.at(-1));
 }
 slots.sort((a,b)=>a.d-b.d);reference.sort((a,b)=>a.d-b.d);
 assert.deepEqual(slots,reference,'selection order and all reused fields match');
 assert.deepEqual(slots.slice(0,4),reference.slice(0,4),'nearest four and stable ties match');
}
assert.equal(identities.size,8,'no new records after eight-candidate warmup');assert.equal(pool.length,8);
console.log('PASS: 100 shrink/grow/type-change selections match; eight slot identities reused');
