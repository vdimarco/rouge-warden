import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MOONLIT_FAR,MOONLIT_LAYERS,moonlitPlacement,moonlitLayerRange,createMoonlitHorizon} from '../src/game/moonlit-horizon.js';
import {createCourseProfile,riverPoint,riverHalfWidth,riverBankHeight,riverGrade} from '../src/game/river-course.js';
import {COURSE_ACTS} from '../src/game/course-intensity.js';
import {LEVELS} from '../src/game/levels.js';

const seeds=[0,3,137,7123,98213];
const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const profiles=()=>LEVELS.flatMap(level=>seeds.map(seed=>createCourseProfile(seed,level.length,level.index)));
const travels=profile=>[-100,0,...COURSE_ACTS.flatMap(act=>[act.from*profile.length,((act.from+act.to)/2)*profile.length]),profile.length,profile.length+150];
const placements=(travel,layer,profile)=>{
 const {first,last}=moonlitLayerRange(travel,layer),samples=[];
 for(let n=first;n<=last;n++)for(const side of [-1,1]){
  const placement=moonlitPlacement(travel,layer,n,side,profile);
  if(placement)samples.push(placement);
 }
 return samples;
};
const cameraAt=aspect=>{
 const camera=new THREE.PerspectiveCamera(52,aspect,.1,1600);
 camera.position.set(0,9.4,18);camera.lookAt(0,.8,-110);camera.updateMatrixWorld();
 return camera;
};
const material=(color,roughness)=>new THREE.MeshStandardMaterial({color,roughness});
const resources=scene=>scene.children.map(mesh=>({
 mesh,geometry:mesh.geometry,material:mesh.material,map:mesh.material.map,
 matrix:mesh.instanceMatrix,matrixArray:mesh.instanceMatrix.array,
 colors:mesh.instanceColor,colorArray:mesh.instanceColor.array,
 attributes:Object.entries(mesh.geometry.attributes),materialVersion:mesh.material.version
}));
const assertResources=(scene,prepared)=>{
 assert.equal(scene.children.length,prepared.length,'updates must not add scene resources');
 for(let i=0;i<prepared.length;i++){
  const before=prepared[i],mesh=scene.children[i];
  assert.equal(mesh,before.mesh);assert.equal(mesh.geometry,before.geometry);assert.equal(mesh.material,before.material);
  assert.equal(mesh.material.map,before.map);assert.equal(mesh.material.version,before.materialVersion);
  assert.equal(mesh.instanceMatrix,before.matrix);assert.equal(mesh.instanceMatrix.array,before.matrixArray);
  assert.equal(mesh.instanceColor,before.colors);assert.equal(mesh.instanceColor.array,before.colorArray);
  assert.deepEqual(Object.keys(mesh.geometry.attributes),before.attributes.map(([name])=>name));
  for(const [name,attribute] of before.attributes)assert.equal(mesh.geometry.attributes[name],attribute);
 }
};

test('Moonlit ridge definitions are immutable and bounded to three prepared layers',()=>{
 assert.ok(Object.isFrozen(MOONLIT_LAYERS));assert.equal(MOONLIT_LAYERS.length,3);
 let previousNear=0;
 for(const layer of MOONLIT_LAYERS){
  assert.ok(Object.isFrozen(layer));assert.equal(layer.capacity,8);
  for(const field of ['spacing','near','far','cross','width','height','depth'])assert.ok(Number.isFinite(layer[field])&&layer[field]>0,field);
  assert.ok(layer.near>previousNear&&layer.far>layer.near);previousNear=layer.near;
  assert.equal(typeof layer.color,'string');
 }
});

test('Moonlit landmarks share the profiled river coordinates and stay wholly outside its banks',()=>{
 for(const profile of profiles())for(const travel of travels(profile))for(const layer of MOONLIT_LAYERS){
  const samples=placements(travel,layer,profile);
  assert.ok(samples.length>0&&samples.length<=layer.capacity);
  assert.equal(new Set(samples.map(sample=>sample.id)).size,samples.length);
  for(const sample of samples){
   const [n,side]=sample.id.split(':').map(Number);
   assert.deepEqual(sample,moonlitPlacement(travel,layer,n,side,profile),'placement must be deterministic');
   assert.equal(sample.course,n*layer.spacing+(side>0?layer.spacing*.37:0));
   assert.equal(sample.ahead,sample.course-travel);
   for(const field of ['course','ahead','cross','x','y','z','width','height','depth','visibility','variation','rotation'])assert.ok(Number.isFinite(sample[field]),`${sample.id} ${field}`);
   assert.ok(sample.width>0&&sample.height>0&&sample.depth>0&&sample.variation>0);
   assert.ok(sample.visibility>0&&sample.visibility<=1);
   const point=riverPoint(travel,sample.course,sample.cross,profile);
   const burial=layer.height*sample.variation*(1-sample.visibility);
   close(sample.x,point.x);close(sample.y,point.y+riverBankHeight(sample.cross,sample.course,profile)-6-burial);close(sample.z,point.z);
   // The ridge geometry has a conservative unit radius of 1.1. Include the
   // rotated depth in its shoreward extent, rather than checking only its root.
   const radius=1.1*(Math.abs(Math.cos(sample.rotation))*sample.width+Math.abs(Math.sin(sample.rotation))*sample.depth);
   assert.ok(Math.abs(sample.cross)-radius>riverHalfWidth(sample.course,profile),`ridge overlaps bank: map ${profile.mapIndex}, seed ${profile.seed}, ${sample.id}`);
  }
 }
});

test('matching Moonlit landmark IDs advance with travel while their absolute courses and forms stay stable',()=>{
 const delta=3.75;
 for(const profile of profiles())for(const travel of travels(profile))for(const layer of MOONLIT_LAYERS){
  const before=placements(travel,layer,profile),after=new Map(placements(travel+delta,layer,profile).map(sample=>[sample.id,sample]));
  let matched=0;
  for(const a of before){
   const b=after.get(a.id);if(!b)continue;matched++;
   for(const field of ['course','cross','variation','rotation'])assert.equal(b[field],a[field],`${a.id} changed ${field}`);
   for(const field of ['width','depth'])close(a[field]/a.footprint,b[field]/b.footprint);
   close(b.ahead,a.ahead-delta);close(b.z-a.z,delta);
  }
  assert.ok(matched>=2,'nearby frames must retain course landmarks');
 }
});

test('Moonlit index windows contain every visible landmark without exceeding their instance capacities',()=>{
 for(const layer of MOONLIT_LAYERS)for(let travel=-500;travel<=7500;travel+=29.13){
  const {first,last}=moonlitLayerRange(travel,layer);
  assert.ok(Number.isInteger(first)&&Number.isInteger(last)&&last>=first);
  assert.ok(last-first+1<=Math.ceil((layer.far-layer.near+24)/layer.spacing)+3,'index range grows independently of run distance');
  const samples=placements(travel,layer,137);assert.ok(samples.length<=layer.capacity);
  for(const n of [first-2,first-1,last+1,last+2])for(const side of [-1,1])assert.equal(moonlitPlacement(travel,layer,n,side,137),null,'range omitted a visible course index');
 }
});

test('Moonlit silhouettes shrink continuously to zero at both slot boundaries',()=>{
 const epsilon=1e-4;
 for(const profile of profiles())for(const layer of MOONLIT_LAYERS)for(const n of [0,Math.round(profile.length/layer.spacing)])for(const side of [-1,1]){
  const course=n*layer.spacing+(side>0?layer.spacing*.37:0);
  for(const [ahead,direction] of [[layer.near-24,1],[layer.far,-1]]){
   const travel=course-ahead;
   assert.equal(moonlitPlacement(travel+direction*epsilon,layer,n,side,profile),null);
   const inside=moonlitPlacement(travel-direction*epsilon,layer,n,side,profile);
   assert.ok(inside,'silhouette must exist just inside its range');
   assert.ok(inside.height<1e-5&&inside.visibility<1e-7,'replacement must happen after the silhouette has faded');
   assert.ok(inside.width<1e-10&&inside.depth<1e-10,'collapsed caps must have no finite footprint');
   const river=riverPoint(travel,course,inside.cross,profile);
   assert.ok(inside.y+inside.height*1.4<river.y-10,'collapsed width/depth must retire below the river, rather than leave an exposed plate');
   const further=moonlitPlacement(travel-direction*epsilon*2,layer,n,side,profile);
   assert.ok(further.height>inside.height&&further.visibility>inside.visibility);
   close(further.z-inside.z,-direction*epsilon);
   assert.ok(Math.abs(further.x-inside.x)<.01&&Math.abs(further.y-inside.y)<.01,'bank placement must remain continuous at a slot edge');
  }
 }
});

test('Moonlit updates reuse prepared scene resources and expose finite projected samples on each layout',()=>{
 const scene=new THREE.Scene(),stoneTexture=new THREE.Texture(),horizon=createMoonlitHorizon(scene,material,stoneTexture);
 assert.equal(scene.children.length,4);
 for(const mesh of scene.children){assert.ok(mesh.isInstancedMesh);assert.equal(mesh.instanceMatrix.count,8);assert.ok(mesh.instanceColor,'instance colors must exist before preparation');assert.equal(mesh.material.map,stoneTexture);}
 const prepared=resources(scene),textureVersion=stoneTexture.version,matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
 assert.equal(horizon.state.kind,'procedural');assert.equal(horizon.state.id,'ruins');assert.equal(horizon.state.paintedRiver,false);
 for(const aspect of [390/844,1440/900,844/390])for(const profile of profiles())for(const travel of travels(profile)){
  const camera=cameraAt(aspect),g={seed:profile.seed,time:travel/80};
  horizon.update(g,travel,true,camera,profile);assertResources(scene,prepared);
  assert.equal(horizon.state.layers.length,3);assert.equal(horizon.state.ruins.capacity,8);
  const groups=[...horizon.state.layers,horizon.state.ruins];
  assert.equal(horizon.state.instances,scene.children.reduce((total,mesh)=>total+mesh.count,0));
  assert.equal(horizon.state.ridgeInstances,horizon.state.layers.reduce((total,layer)=>total+layer.count,0));
  assert.ok(horizon.state.instances<=32&&horizon.state.instances>0);
  for(let i=0;i<groups.length;i++){
   const group=groups[i],mesh=scene.children[i];
   assert.equal(group.count,mesh.count);assert.equal(group.samples.length,mesh.count);assert.ok(mesh.count<=8);
   assert.equal(new Set(group.samples.map(sample=>sample.id)).size,mesh.count);
   for(let j=0;j<group.samples.length;j++){
    const sample=group.samples[j];
    for(const field of ['course','x','y','z'])assert.ok(Number.isFinite(sample[field]),`${sample.id} ${field}`);
    assert.equal(sample.screen.length,2);assert.ok(sample.screen.every(Number.isFinite));
    mesh.getMatrixAt(j,matrix);matrix.decompose(position,rotation,scale);
    close(position.x,sample.x,1e-4);close(position.y,sample.y,1e-4);close(position.z,sample.z,1e-4);
    if(i<3){
     const [n,side]=sample.id.split(':').map(Number),expected=moonlitPlacement(travel,MOONLIT_LAYERS[i],n,side,profile);
     assert.ok(expected);assert.equal(sample.course,expected.course);
     close(scale.x,expected.width,1e-4);close(scale.y,expected.height,1e-4);close(scale.z,expected.depth,1e-4);
     const projected=new THREE.Vector3(expected.x,expected.y+expected.height*.5,expected.z).project(camera);
     close(sample.screen[0],projected.x);close(sample.screen[1],projected.y);
    }
   }
  }
  const state=structuredClone(horizon.state),matrices=scene.children.map(mesh=>Array.from(mesh.instanceMatrix.array)),colors=scene.children.map(mesh=>Array.from(mesh.instanceColor.array));
  horizon.update({...g,time:g.time+100,reducedMotion:true},travel,true,camera,profile);
  assert.deepEqual(horizon.state,state,'paused/reduced scenery must be stable at fixed travel');
  assert.deepEqual(scene.children.map(mesh=>Array.from(mesh.instanceMatrix.array)),matrices);
  assert.deepEqual(scene.children.map(mesh=>Array.from(mesh.instanceColor.array)),colors);
  horizon.update(g,travel,false,camera,profile);assertResources(scene,prepared);
  assert.equal(horizon.state.instances,0);assert.ok(scene.children.every(mesh=>!mesh.visible&&mesh.count===0));
  horizon.update(g,travel,true,camera,profile);assert.deepEqual(horizon.state,state,'reenabling must restore the same course scene');
 }
 assert.equal(stoneTexture.version,textureVersion,'updates must not reupload the prepared texture');
});

test('the real Moonlit cameras keep non-hidden on-screen horizon vertices inside their far plane',t=>{
 const scene=new THREE.Scene(),horizon=createMoonlitHorizon(scene,material,new THREE.Texture());
 const instance=new THREE.Matrix4(),localToView=new THREE.Matrix4(),vertex=new THREE.Vector3(),projected=new THREE.Vector3();
 let checked=0,farthest=0;
 for(const seed of seeds){
  const profile=createCourseProfile(seed,LEVELS[2].length,2),distances=new Set(travels(profile));
  for(let travel=0;travel<=profile.length;travel+=83)distances.add(travel);
  // Exercise the steepest point of early, middle and late chutes as well as
  // nearly entering/leaving course slots, where the camera's pitch matters.
  for(const cell of [0,11,26,39,51]){
   let steepest=cell*126;
   for(let d=cell*126;d<(cell+1)*126;d++)if(riverGrade(d,profile)<riverGrade(steepest,profile))steepest=d;
   distances.add(steepest);
  }
  for(const act of COURSE_ACTS)for(const layer of MOONLIT_LAYERS)for(const side of [-1,1]){
   const n=Math.ceil((act.from*profile.length+layer.far)/layer.spacing),course=n*layer.spacing+(side>0?layer.spacing*.37:0);
   for(const ahead of [layer.near-24,layer.far])for(const offset of [-5,5]){
    const travel=course-ahead+offset;
    if(travel>=0&&travel<=profile.length)distances.add(travel);
   }
  }
  for(const [width,height] of [[390,844],[1440,900],[844,390]]){
   const phone=width/height<.85,camera=new THREE.PerspectiveCamera(phone?80:60,width/height,.1,MOONLIT_FAR);
   camera.position.set(0,phone?10.4:9.4,phone?19:18);
   let layoutChecked=0;
   for(const travel of distances){
    const look=riverPoint(travel,travel+(phone?32:38),0,profile);
    camera.lookAt(look.x*.65,look.y+.8+riverGrade(travel,profile)*6,look.z);camera.updateMatrixWorld();
    horizon.update({seed:profile.seed,time:0},travel,true,camera,profile);scene.updateMatrixWorld();
    const groups=[...horizon.state.layers,horizon.state.ruins];
    for(let i=0;i<groups.length;i++){
     const mesh=scene.children[i],positions=mesh.geometry.attributes.position;
     for(let j=0;j<mesh.count;j++){
      const sample=groups[i].samples[j];
      if(sample.visibility<=.01)continue;
      mesh.getMatrixAt(j,instance);localToView.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld).multiply(instance);
      for(let k=0;k<positions.count;k++){
       vertex.fromBufferAttribute(positions,k).applyMatrix4(localToView);
       const depth=-vertex.z;if(depth<=0)continue;
       projected.copy(vertex).applyMatrix4(camera.projectionMatrix);
       // Check screen x/y before far clipping: including projected z here
       // would exclude precisely the distant geometry this test must detect.
       if(Math.abs(projected.x)>1||Math.abs(projected.y)>1)continue;
       checked++;layoutChecked++;farthest=Math.max(farthest,depth);
       assert.ok(depth<=camera.far+1e-4,`non-hidden on-screen horizon vertex exceeds far plane: ${width}x${height}, seed ${seed}, travel ${travel}, ${sample.id}, vertex ${k}, depth ${depth}, far ${camera.far}`);
      }
     }
    }
   }
   assert.ok(layoutChecked>0,`no non-hidden on-screen vertices tested for ${width}x${height}, seed ${seed}`);
  }
 }
 assert.ok(farthest>800,'coverage must include visible geometry that the former 800m plane clipped');
 t.diagnostic(`Checked ${checked} non-hidden on-screen vertices; farthest camera-space depth ${farthest.toFixed(2)}m, far plane ${MOONLIT_FAR}m.`);
});
