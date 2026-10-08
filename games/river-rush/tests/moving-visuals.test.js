import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMovingEncounterVisuals,MOVING_VISUAL_CAPACITY} from '../src/game/moving-visuals.js';
import {entityLane} from '../src/game/moving-encounters.js';

const material=(color,roughness)=>new THREE.MeshStandardMaterial({color,roughness});
const encounter=(kind,id=1)=>({id,type:kind==='target'?'target':kind==='crocodile'?'log':'branch',enemy:kind==='target'?undefined:kind,lane:2,d:180,motion:{from:0,to:2,startD:0,endD:100}});
const matrices=scene=>scene.children.map(batch=>Array.from(batch.instanceMatrix.array.slice(0,batch.count*16)));
const draw=(visual,e,distance=50,time=1,reduced=false)=>{
 visual.begin();const lane=entityLane(e,distance),position={x:(lane-1)*3.8,y:.3,z:distance-e.d},destination={x:(e.lane-1)*3.8,y:.3,z:distance-e.d};
 visual.add(e,position,destination,time,reduced,lane,distance);visual.finish();return {position,destination};
};
const center=(batch,index=0)=>{const matrix=new THREE.Matrix4();batch.getMatrixAt(index,matrix);return new THREE.Vector3().setFromMatrixPosition(matrix);};
const resources=scene=>scene.children.map(batch=>({batch,geometry:batch.geometry,material:batch.material,matrix:batch.instanceMatrix,colors:batch.instanceColor,materialVersion:batch.material.version}));

test('moving bodies and destination guides register to separate actual and locked lanes',()=>{
 const scene=new THREE.Scene(),visual=createMovingEncounterVisuals(scene,material,true);
 for(const kind of ['crocodile','bird','target'])for(const distance of [0,25,50,75,100,180]){
  const e=encounter(kind),{position,destination}=draw(visual,e,distance),sample=visual.state.samples[0];
  assert.equal(sample.kind,kind);assert.equal(sample.lane,entityLane(e,distance));assert.equal(sample.destinationLane,e.lane);
  assert.deepEqual(sample.position,Object.values(position));assert.deepEqual(sample.destination,Object.values(destination));
  assert.equal(sample.settled,distance>=e.motion.endD);
  const marker=center(scene.children[4]);assert.ok(Math.abs(marker.x-destination.x)<1e-5);assert.ok(Math.abs(marker.z-destination.z)<1e-5);
  const body=center(scene.children[kind==='target'?1:0]);assert.ok(Math.abs(body.x-position.x)<1e-5);
 }
});

test('crocodiles and birds have clearly different low and high silhouettes',()=>{
 const scene=new THREE.Scene(),visual=createMovingEncounterVisuals(scene,material,true);
 draw(visual,encounter('crocodile'),100,1,true);const croc=scene.children[0],lowCenters=Array.from({length:croc.count},(_,i)=>center(croc,i).y);
 assert.ok(lowCenters.length>=20);assert.ok(Math.max(...lowCenters)<1.1);assert.equal(scene.children[2].count,0);
 draw(visual,encounter('bird'),100,1,true);const bird=scene.children[0],highCenters=Array.from({length:bird.count},(_,i)=>center(bird,i).y);
 assert.ok(Math.min(...highCenters)>2);assert.equal(scene.children[2].count,2,'both articulated wings must exist');
 draw(visual,encounter('target'),100,1,true);assert.equal(scene.children[4].count,2,'bonus has its distinct double destination ring');assert.equal(scene.children[3].count,2,'bonus has two independent cyan/gold hoops');
});

test('animation clocks pause exactly and reduced motion keeps gameplay motion registered',()=>{
 const scene=new THREE.Scene(),visual=createMovingEncounterVisuals(scene,material,true);
 for(const kind of ['crocodile','bird','target']){
  const e=encounter(kind);draw(visual,e,50,2,false);const first=matrices(scene);draw(visual,e,50,2,false);assert.deepEqual(matrices(scene),first,'same paused clock must produce identical transforms');
  draw(visual,e,50,2.14,false);assert.notDeepEqual(matrices(scene),first,'articulated secondary animation must move continuously');
  draw(visual,e,50,2,true);const quiet=matrices(scene);draw(visual,e,50,120,true);assert.deepEqual(matrices(scene),quiet,'reduced motion must suppress clocks without changing lane');
  draw(visual,e,75,120,true);assert.notDeepEqual(matrices(scene),quiet);assert.equal(visual.state.samples[0].lane,entityLane(e,75));
 }
});

test('encounter pools reuse every prepared geometry material buffer and color across long runs',()=>{
 const scene=new THREE.Scene(),visual=createMovingEncounterVisuals(scene,material,true),prepared=resources(scene);
 assert.equal(scene.children.length,6);assert.ok(prepared.every(resource=>resource.colors));
 for(let frame=0;frame<100;frame++){
  visual.begin();for(let i=0;i<MOVING_VISUAL_CAPACITY+9;i++){
   const e=encounter(['crocodile','bird','target'][i%3],i+frame*100),distance=frame*17,lane=entityLane(e,distance);
   visual.add(e,{x:(lane-1)*3.8,y:0,z:-20-i},{x:3.8,y:0,z:-20-i},frame/60,false,lane,distance);
  }
  for(let i=0;i<12;i++)visual.burst({id:i},{x:0,y:0,z:0},.2,false);visual.finish();
  assert.equal(visual.state.active,MOVING_VISUAL_CAPACITY);assert.equal(visual.state.bursts,8);assert.ok(visual.state.instances>0);
  assert.equal(scene.children.length,prepared.length);
  for(const [i,batch] of scene.children.entries()){
   const before=prepared[i];assert.equal(batch,before.batch);assert.equal(batch.geometry,before.geometry);assert.equal(batch.material,before.material);assert.equal(batch.material.version,before.materialVersion);assert.equal(batch.instanceMatrix,before.matrix);assert.equal(batch.instanceColor,before.colors);assert.ok(batch.count<=batch.instanceMatrix.count);
   assert.ok(Array.from(batch.instanceMatrix.array.slice(0,batch.count*16)).every(Number.isFinite));
  }
 }
});
