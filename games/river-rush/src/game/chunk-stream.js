import {riverHash,riverSeed} from './river-course.js';

export const TERRAIN_CHUNKS=Object.freeze({length:64,capacity:6,behind:32,prefetch:2});
const {length,capacity,behind,prefetch}=TERRAIN_CHUNKS;
const slotFor=id=>((id%capacity)+capacity)%capacity;
const descriptor=slot=>({slot,id:null,start:0,end:0,center:0,matrixZ:0,variant:0});
function assign(chunk,id,seed){
 chunk.id=id;chunk.start=id*length;chunk.end=chunk.start+length;
 chunk.center=chunk.start+length/2;chunk.matrixZ=-chunk.center;
 chunk.variant=riverHash(id,seed);
}

// These descriptors schedule analytic terrain; meshes, materials and instance
// buffers belong to the renderer's fixed prepared pool. No update allocates a
// descriptor or keeps a history of sections that have left the corridor.
export function createChunkStream(seed=137){
 const normalized=riverSeed(seed);
 if(!Number.isFinite(normalized))throw new RangeError('Terrain seed must be finite');
 return {
  seed:normalized,initialized:false,distance:0,firstId:null,lastId:null,
  start:0,end:0,coveredBehind:0,coveredAhead:0,active:0,scheduled:0,
  chunks:Array.from({length:capacity},(_,slot)=>descriptor(slot)),
  ahead:Array.from({length:prefetch},(_,slot)=>descriptor(-1-slot)),
  changedSlots:new Uint8Array(capacity),changedCount:0,
  retiredIds:new Float64Array(capacity),retiredCount:0,
  updates:0,matrixUpdates:0,recycled:0,seedChanges:0
 };
}

// Absolute z=-center remains unchanged while a slot is active. The vertex
// shader samples course=-(localZ+matrixZ), then adds current travel to z.
// Across a 64 m boundary only the retired slot needs another matrix upload.
// The third argument also supports a new run/profile without replacing pools.
export function updateChunkStream(stream,distance,seed=stream.seed){
 const normalized=riverSeed(seed);
 if(!Number.isFinite(distance)||!Number.isFinite(normalized))throw new RangeError('Terrain distance and seed must be finite');
 const firstId=Math.floor((distance-behind)/length);
 const seedChanged=normalized!==stream.seed;
 stream.changedCount=0;stream.retiredCount=0;
 if(!stream.initialized||firstId!==stream.firstId||seedChanged){
  for(let id=firstId;id<firstId+capacity;id++){
   const slot=slotFor(id),chunk=stream.chunks[slot];
   if(chunk.id!==id){
    if(stream.initialized){stream.retiredIds[stream.retiredCount++]=chunk.id;stream.recycled++;}
    stream.changedSlots[stream.changedCount++]=slot;
   }
   assign(chunk,id,normalized);
  }
  for(let i=0;i<prefetch;i++)assign(stream.ahead[i],firstId+capacity+i,normalized);
  if(stream.changedCount){stream.updates++;stream.matrixUpdates+=stream.changedCount;}
  if(seedChanged)stream.seedChanges++;
  stream.seed=normalized;stream.firstId=firstId;stream.lastId=firstId+capacity-1;
  stream.start=firstId*length;stream.end=stream.start+capacity*length;
  stream.active=capacity;stream.scheduled=prefetch;stream.initialized=true;
 }
 stream.distance=distance;stream.coveredBehind=distance-stream.start;stream.coveredAhead=stream.end-distance;
 return stream;
}
