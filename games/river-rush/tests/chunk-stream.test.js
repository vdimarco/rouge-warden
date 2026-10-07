import test from 'node:test';
import assert from 'node:assert/strict';
import {TERRAIN_CHUNKS,createChunkStream,updateChunkStream} from '../src/game/chunk-stream.js';
import {createCourseProfile,riverBankHeight,riverHalfWidth,riverPoint} from '../src/game/river-course.js';

const ids=stream=>stream.chunks.map(chunk=>chunk.id).sort((a,b)=>a-b);
function checkCoverage(stream){
 assert.equal(stream.active,6);assert.equal(stream.scheduled,2);
 assert.equal(stream.end-stream.start,384);
 assert.ok(stream.coveredBehind>=32&&stream.coveredBehind<96);
 assert.ok(stream.coveredAhead>288&&stream.coveredAhead<=352);
 assert.deepEqual(ids(stream),Array.from({length:6},(_,i)=>stream.firstId+i));
 assert.deepEqual(stream.ahead.map(chunk=>chunk.id),[stream.lastId+1,stream.lastId+2]);
 for(const chunk of stream.chunks){assert.equal(chunk.end-chunk.start,64);assert.equal(chunk.matrixZ,-chunk.center);}
}

test('six prepared terrain slots keep a contiguous ahead corridor and recycle only the retired slot',()=>{
 assert.deepEqual(TERRAIN_CHUNKS,{length:64,capacity:6,behind:32,prefetch:2});
 const stream=createChunkStream(137);assert.equal(stream.active,0);
 assert.equal(updateChunkStream(stream,0),stream);checkCoverage(stream);
 assert.equal(stream.start,-64);assert.equal(stream.end,320);assert.equal(stream.changedCount,6);
 const matrices=stream.chunks.map(chunk=>chunk.matrixZ),next={...stream.ahead[0]};
 for(const d of [.01,1,19,31.999999]){
  updateChunkStream(stream,d);checkCoverage(stream);
  assert.equal(stream.changedCount,0);assert.equal(stream.retiredCount,0);
  assert.deepEqual(stream.chunks.map(chunk=>chunk.matrixZ),matrices);
 }
 updateChunkStream(stream,32);checkCoverage(stream);
 assert.equal(stream.changedCount,1);assert.equal(stream.changedSlots[0],5);
 assert.equal(stream.retiredCount,1);assert.equal(stream.retiredIds[0],-1);
 assert.equal(stream.chunks[5].id,next.id);assert.equal(stream.chunks[5].variant,next.variant);
 assert.equal(stream.chunks[5].matrixZ,next.matrixZ);
 assert.equal(stream.recycled,1);assert.equal(stream.updates,2);assert.equal(stream.matrixUpdates,7);
 for(let slot=0;slot<5;slot++)assert.equal(stream.chunks[slot].matrixZ,matrices[slot]);
 updateChunkStream(stream,96);assert.equal(stream.changedSlots[0],0);assert.equal(stream.retiredIds[0],0);
});

test('terrain streaming keeps fixed object and buffer identities through three maps at varied frame rates',()=>{
 const stream=createChunkStream(),chunks=stream.chunks,ahead=stream.ahead;
 const objects=[...chunks,...ahead],changed=stream.changedSlots,retired=stream.retiredIds;
 for(const [map,length,speed] of [[0,4200,68],[1,5400,80],[2,6600,92]]){
  const profile=createCourseProfile(137+map*71,length,map);
  const startUploads=stream.matrixUpdates;
  let frame=0;
  for(let distance=0;distance<=length;){
   updateChunkStream(stream,distance,profile);checkCoverage(stream);
   assert.equal(stream.chunks,chunks);assert.equal(stream.ahead,ahead);
   assert.equal(stream.changedSlots,changed);assert.equal(stream.retiredIds,retired);
   for(let i=0;i<6;i++)assert.equal(stream.chunks[i],objects[i]);
   for(let i=0;i<2;i++)assert.equal(stream.ahead[i],objects[i+6]);
   assert.ok(stream.changedCount<=6);
   distance+=speed/[30,60,120][frame++%3];
  }
  assert.ok(stream.matrixUpdates-startUploads<=Math.ceil(length/64)+6,'uploads scale with sections, not frames');
  assert.ok(frame>3000);
 }
 assert.equal(stream.chunks.length,6);assert.equal(stream.ahead.length,2);
});

test('absolute chunk edges agree on course, world height and projected z through bends and chutes',()=>{
 const stream=createChunkStream(7123),profile=createCourseProfile(7123,5400,1);
 for(const distance of [0,31.999999,32,64,96,180,780,2111.35,4096,5400]){
  updateChunkStream(stream,distance,profile);
  const ordered=[...stream.chunks].sort((a,b)=>a.id-b.id);
  for(let i=0;i<ordered.length-1;i++){
   const left=ordered[i],right=ordered[i+1];
   const courseA=-(-32+left.matrixZ),courseB=-(32+right.matrixZ);
   assert.ok(courseA===courseB);assert.ok(courseA===left.end);assert.ok(courseB===right.start);
   const zA=-32+left.matrixZ+distance,zB=32+right.matrixZ+distance;
   assert.ok(zA===zB);assert.ok(zA===riverPoint(distance,courseA,0,profile).z);
   for(const side of [-1,1])for(const across of [0,.1,.5,1]){
    const xA=side*(riverHalfWidth(courseA,profile)+across*32);
    const xB=side*(riverHalfWidth(courseB,profile)+across*32);
    const a=riverPoint(distance,courseA,xA,profile),b=riverPoint(distance,courseB,xB,profile);
    a.y+=riverBankHeight(xA,courseA,profile);b.y+=riverBankHeight(xB,courseB,profile);
    assert.deepEqual(a,b,'shared absolute samples leave no seam between mesh edges');
   }
  }
 }
});

test('direct seeks and seed resets remain bounded while paused and reduced travel do not upload matrices',()=>{
 const stream=createChunkStream(137);updateChunkStream(stream,0);
 const initialVariants=stream.chunks.map(chunk=>chunk.variant);
 updateChunkStream(stream,0,138);
 assert.equal(stream.changedCount,0);assert.equal(stream.matrixUpdates,6);assert.equal(stream.seedChanges,1);
 assert.notDeepEqual(stream.chunks.map(chunk=>chunk.variant),initialVariants);
 const twin=createChunkStream(138);updateChunkStream(twin,0);
 assert.deepEqual(stream.chunks,twin.chunks);assert.deepEqual(stream.ahead,twin.ahead);
 for(const distance of [1e6,-700,6600,0]){
  const updates=stream.updates,recycled=stream.recycled;
  updateChunkStream(stream,distance);checkCoverage(stream);
  assert.equal(stream.changedCount,6);assert.equal(stream.retiredCount,6);
  assert.equal(stream.updates,updates+1);assert.equal(stream.recycled,recycled+6);
 }
 const updates=stream.updates,matrixUpdates=stream.matrixUpdates,recycled=stream.recycled;
 for(let i=0;i<1000;i++)updateChunkStream(stream,0);
 assert.equal(stream.changedCount,0);assert.equal(stream.updates,updates);
 assert.equal(stream.matrixUpdates,matrixUpdates);assert.equal(stream.recycled,recycled);
 const before=JSON.stringify(stream);
 for(const invalid of [NaN,Infinity,-Infinity])assert.throws(()=>updateChunkStream(stream,invalid),RangeError);
 assert.throws(()=>updateChunkStream(stream,0,NaN),RangeError);
 assert.equal(JSON.stringify(stream),before,'invalid positions cannot damage the prepared window');
});
