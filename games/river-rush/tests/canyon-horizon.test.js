import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CANYON_LAYERS,canyonForm,canyonPlacement,canyonLayerRange,canyonVertexAt,createCanyonHorizon} from '../src/game/canyon-horizon.js';
import {createCourseProfile,riverPoint,riverHalfWidth} from '../src/game/river-course.js';
import {LEVELS} from '../src/game/levels.js';

const profiles=[0,73,137,250].map(seed=>createCourseProfile(seed,LEVELS[1].length,1));
const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);
const material=(color,roughness)=>new THREE.MeshStandardMaterial({color,roughness});
const placements=(travel,layer,profile)=>{
 const {first,last}=canyonLayerRange(travel,layer),result=[];
 for(let n=first;n<=last;n++)for(const side of [-1,1]){
  const p=canyonPlacement(travel,layer,n,side,profile);if(p)result.push(p);
 }
 return result;
};

test('approaching mesas retain their complete forms across the former near deletion thresholds',()=>{
 for(const profile of profiles)for(const layer of CANYON_LAYERS)for(const n of [4,17])for(const side of [-1,1]){
  const form=canyonForm(layer,n,side,profile);
  for(const ahead of [layer.near+27,layer.near,layer.near-19,10,0,-10]){
   const p=canyonPlacement(form.course-ahead,layer,n,side,profile);
   assert.ok(p,'a mesa ahead of the raft must not be recycled');
   for(const field of ['course','cross','width','height','depth','variation','rotation'])close(p[field],form[field]);
   assert.equal(p.visibility,1);assert.equal(p.footprint,1);assert.equal(p.id,form.id);
  }
 }
});

test('mesas recycle only when their entire rotated footprint is behind both chase cameras',()=>{
 for(const profile of profiles)for(const layer of CANYON_LAYERS)for(const n of [-3,4,27])for(const side of [-1,1]){
  const form=canyonForm(layer,n,side,profile),retiredAt=form.course+20+form.extentZ;
  const p=canyonPlacement(retiredAt-.001,layer,n,side,profile);
  assert.ok(p);assert.equal(p.height,form.height);assert.equal(p.visibility,1);
  assert.equal(canyonPlacement(retiredAt+.001,layer,n,side,profile),null);
  assert.ok(p.z-p.extentZ>19,'the furthest-forward footprint must have passed the portrait camera at z19');
 }
});

test('course windows include every retained mesa and never truncate the prepared12-instance layers',()=>{
 for(const layer of CANYON_LAYERS){
  assert.ok(Object.isFrozen(layer));assert.equal(layer.capacity,12);
  for(const profile of profiles)for(let travel=-100;travel<=6000;travel+=25.13){
   const {first,last}=canyonLayerRange(travel,layer),samples=placements(travel,layer,profile);
   assert.ok(samples.length>0&&samples.length<=layer.capacity,`unbounded pool at ${travel}`);
   assert.equal(new Set(samples.map(p=>p.id)).size,samples.length);
   for(const n of [first-2,first-1,last+1,last+2])for(const side of [-1,1])assert.equal(canyonPlacement(travel,layer,n,side,profile),null,'range dropped a visible mesa');
  }
 }
});

test('actual mesa vertices follow the curved downhill course and stay outside all playable banks',()=>{
 const scene=new THREE.Scene(),horizon=createCanyonHorizon(scene,material,new THREE.Texture());
 const position=scene.children[0].geometry.attributes.position,vertex=new THREE.Vector3();
 for(const profile of profiles)for(const travel of [0,600,2750,5400])for(const layer of CANYON_LAYERS){
  for(const p of placements(travel,layer,profile))for(let i=0;i<position.count;i++){
   vertex.fromBufferAttribute(position,i);
   const point=canyonVertexAt(travel,p,vertex,profile),river=riverPoint(travel,point.course,point.cross,profile);
   for(const field of ['x','y','z','course','cross'])assert.ok(Number.isFinite(point[field]));
   close(point.x,river.x);close(point.z,river.z);close(point.y,river.y+p.localY+vertex.y*p.height);
   assert.ok(Math.abs(point.cross)>riverHalfWidth(point.course,profile)+layer.cross,'a rotated/deep mesa vertex cut across the playable river');
  }
 }
});

test('far-edge emergence has no exposed zero-height plates and approaching forms stay stable',()=>{
 for(const profile of profiles)for(const layer of CANYON_LAYERS){
  const form=canyonForm(layer,4,-1,profile),edge=form.course-layer.far;
  assert.equal(canyonPlacement(edge,layer,4,-1,profile),null);
  const first=canyonPlacement(edge+.0001,layer,4,-1,profile);
  assert.ok(first);assert.ok(first.height<1e-5&&first.width<1e-8&&first.depth<1e-8);
  assert.ok(first.y+first.height<form.height*.1,'a far slot boundary must retire the whole cap below its bank');
  const emerged=canyonPlacement(form.course-layer.far+65,layer,4,-1,profile);
  assert.equal(emerged.visibility,1);assert.equal(emerged.width,form.width);assert.equal(emerged.height,form.height);assert.equal(emerged.depth,form.depth);
 }
});

test('updates reuse all prepared canyon resources, uniforms and shader variants on every layout',()=>{
 const scene=new THREE.Scene(),texture=new THREE.Texture(),uniforms={uDistance:{value:0},uSeed:{value:137},uCourseLength:{value:5400},uCourseMap:{value:1}};
 const horizon=createCanyonHorizon(scene,material,texture,uniforms);
 assert.equal(scene.children.length,3);
 const prepared=scene.children.map(mesh=>({mesh,geometry:mesh.geometry,material:mesh.material,matrix:mesh.instanceMatrix,colors:mesh.instanceColor,version:mesh.material.version,compile:mesh.material.onBeforeCompile,key:mesh.material.customProgramCacheKey()}));
 for(const aspect of [390/844,1536/1024,844/390])for(const profile of profiles)for(const travel of [0,280,340,600,2750,5390]){
  const camera=new THREE.PerspectiveCamera(aspect<.85?80:60,aspect,.3,1050);camera.position.set(0,aspect<.85?10.4:9.4,aspect<.85?19:18);camera.lookAt(0,.8,-38);camera.updateMatrixWorld();
  horizon.update({seed:profile.seed,time:travel/80},travel,true,camera,profile);
  assert.equal(uniforms.uDistance.value,travel);assert.equal(uniforms.uSeed.value,profile.seed);
  assert.ok(horizon.state.instances>0&&horizon.state.instances<=36);
  for(const [i,before] of prepared.entries()){
   const mesh=scene.children[i];assert.equal(mesh,before.mesh);assert.equal(mesh.geometry,before.geometry);assert.equal(mesh.material,before.material);
   assert.equal(mesh.instanceMatrix,before.matrix);assert.equal(mesh.instanceColor,before.colors);assert.equal(mesh.material.map,texture);
   assert.equal(mesh.material.version,before.version);assert.equal(mesh.material.onBeforeCompile,before.compile);assert.equal(mesh.material.customProgramCacheKey(),before.key);
   assert.ok(mesh.count<=12);assert.equal(mesh.frustumCulled,false);
   for(const p of horizon.state.layers[i].samples)assert.ok(p.screen.every(Number.isFinite));
  }
 }
 horizon.update({seed:137,time:0},0,false,new THREE.PerspectiveCamera(),profiles[0]);
 assert.equal(horizon.state.instances,0);assert.ok(scene.children.every(mesh=>!mesh.visible&&mesh.count===0));
});
