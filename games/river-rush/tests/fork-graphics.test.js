import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LANES,LANE_SPACING} from '../src/game/lanes.js';
import {LEVELS} from '../src/game/levels.js';
import {createCourseProfile,riverPoint,riverHalfWidth} from '../src/game/river-course.js';
import {riverFork,forkLaneCross,islandContains} from '../src/game/river-forks.js';
import {chaseCameraPose,cameraEnvelope} from '../src/game/chase-camera.js';
import {shorelineBranch} from '../src/game/shoreline-branch.js';
import {nativeOakContacts} from '../src/game/meshy-bough-shape.js';
import {BRANCH_LANE_RADIUS} from '../src/game/branch-spans.js';
import {createTreasureVisuals,TREASURE_CAPACITY,islandDrawRange,visibleCourseDrawRange} from '../src/game/fork-visuals.js';
import {surfaceAt} from '../src/game/hydrodynamics.js';
import {islandHeight} from '../src/game/river-forks.js';

test('split river frames the full chosen stream hero and previews both choices before commitment',()=>{
 for(const [w,h] of [[390,844],[360,640],[1365,900],[844,390]]){
  const camera=new THREE.PerspectiveCamera(60,w/h,.3,1200),probe=new THREE.Vector3();let maximum=0,samples=0;
  for(const level of LEVELS)for(const seed of [0,137,98213]){
   const profile=createCourseProfile(seed,level.length,level.index);
   for(let distance=800;distance<level.length-150;distance+=23){
    const fork=riverFork(distance,profile);if(!fork)continue;
    for(const reduced of [false,true])for(const lane of [0,1,3,4]){
     const pose=chaseCameraPose(w,h,distance,profile,lane,reduced);camera.fov=pose.fov;camera.updateProjectionMatrix();camera.position.set(pose.x,pose.y,pose.z);camera.lookAt(pose.look.x,pose.look.y,pose.look.z);camera.updateMatrixWorld();
     const cross=forkLaneCross(lane,distance,profile),envelope=cameraEnvelope(camera,probe,cross,.85,2.9);
     maximum=Math.max(maximum,Math.abs(envelope.left),Math.abs(envelope.right));
     assert.ok(envelope.left>-.985&&envelope.right<.985,`${w}x${h}: physical jumping raft ${seed}:${level.index}:${distance}:${lane}`);
     assert.ok(envelope.bottom>-.9&&envelope.top<.9,'the widened camera retains the full rider vertically');
     for(const routeLane of lane<2?[0,1]:[3,4]){const p=riverPoint(distance,distance+20,forkLaneCross(routeLane,distance+20,profile),profile);probe.set(p.x,p.y+1,p.z).project(camera);assert.ok(Math.abs(probe.x)<.91&&Math.abs(probe.y)<.95,'both approaching lanes in the chosen stream remain visible');}
     samples++;
    }
   }
   const seen=new Set();
   for(let d=800;d<level.length-150;d+=20){const fork=riverFork(d,profile);if(!fork||seen.has(fork.id))continue;seen.add(fork.id);
    const distance=fork.start-55,pose=chaseCameraPose(w,h,distance,profile,2);camera.fov=pose.fov;camera.updateProjectionMatrix();camera.position.set(pose.x,pose.y,pose.z);camera.lookAt(pose.look.x,pose.look.y,pose.look.z);camera.updateMatrixWorld();
    for(const lane of [0,1,3,4]){const p=riverPoint(distance,fork.splitStart,forkLaneCross(lane,fork.splitStart,profile),profile);probe.set(p.x,p.y+1,p.z).project(camera);assert.ok(Math.abs(probe.x)<.91&&Math.abs(probe.y)<.95,'both waterway choices fit in the approach preview');}
   }
  }
  assert.ok(samples>500);console.log(JSON.stringify({forkFraming:`${w}x${h}`,samples,maximum}));
 }
});

test('fork canopy spans are rooted outside their own stream with native contacts over the two physical lanes',()=>{
 let samples=0;
 for(const level of LEVELS)for(const seed of [0,137,98213]){
  const profile=createCourseProfile(seed,level.length,level.index);
  for(let course=850;course<level.length-150;course+=37){
   const fork=riverFork(course,profile);if(!fork||fork.strength<.98)continue;
   for(const side of [-1,1]){
    const lanes=side<0?[0,1]:[3,4],shape=shorelineBranch({id:1100+Math.round(course),type:'branch',lane:lanes[0],branchLanes:lanes,branchSide:side,streamSide:side},course,profile);
    assert.ok(side*shape.root.x>riverHalfWidth(course+shape.root.d,profile),'the connected trunk grows from the outer shoreline');
    for(const contact of nativeOakContacts(shape)){
     assert.ok(Math.abs(contact.x-forkLaneCross(contact.lane,course,profile))<1e-10,'actual authored native wood contacts the physical stream lane');
     assert.ok(!islandContains(contact.x,course,profile),'low duck wood stays over water');
     assert.ok(contact.y>2.7&&contact.y<3.8,'the native low limb keeps its readable duck clearance');
    }
    const min=forkLaneCross(lanes[0],course,profile)-BRANCH_LANE_RADIUS*LANE_SPACING,max=forkLaneCross(lanes[1],course,profile)+BRANCH_LANE_RADIUS*LANE_SPACING;
    assert.ok(!islandContains(min,course,profile)&&!islandContains(max,course,profile),'physical coverage marker endpoints remain in their own stream');samples++;
   }
  }
 }
 assert.ok(samples>100);
});

test('fork chase framing changes continuously through divergence and confluence',()=>{
 const profile=createCourseProfile(137,4200,0);
 for(let distance=1400;distance<2300;distance+=2){
  const before=chaseCameraPose(390,844,distance-1e-4,profile,4),after=chaseCameraPose(390,844,distance+1e-4,profile,4);
  assert.ok(Math.abs(after.x-before.x)<1e-4);assert.ok(Math.abs(after.y-before.y)<1e-4);assert.ok(Math.abs(after.z-before.z)<1e-4);
 }
});

test('prepared treasure graphics reuse a bounded pool through many rewards and freeze cosmetic motion',()=>{
 const scene=new THREE.Scene(),mat=color=>new THREE.MeshStandardMaterial({color}),camera=new THREE.PerspectiveCamera(60,1,.3,300);
 camera.position.set(0,12,24);camera.lookAt(0,0,-20);camera.updateMatrixWorld();
 const visual=createTreasureVisuals(scene,mat('#755037'),mat),prepared=scene.children.map(mesh=>({mesh,geometry:mesh.geometry,material:mesh.material,buffer:mesh.instanceMatrix.array}));
 const draw=(time,reduced)=>{visual.begin();for(let i=0;i<TREASURE_CAPACITY+4;i++)visual.add({id:i,routeRole:i%2?'risk':'safe',routeSide:i%2?1:-1,treasureBase:200,treasureCleanBonus:i%2?400:0},{x:i%2?14:-14,y:0,z:-20-i*2},time,reduced,camera);visual.finish();};
 draw(1,true);const frozen=prepared.map(part=>Array.from(part.buffer));draw(99,true);
 for(let i=0;i<prepared.length;i++)assert.deepEqual(Array.from(prepared[i].buffer),frozen[i],'reduced mode freezes the chest and every orbiting gold spark');
 for(let run=0;run<200;run++)draw(run*.3,false);
 assert.equal(visual.state.active,TREASURE_CAPACITY);assert.equal(visual.state.samples.length,TREASURE_CAPACITY);
 assert.ok(visual.state.samples.some(sample=>sample.baseValue===200&&sample.cleanBonus===400));
 assert.equal(scene.children.length,prepared.length);
 for(const part of prepared){assert.equal(part.mesh.geometry,part.geometry);assert.equal(part.mesh.material,part.material);assert.equal(part.mesh.instanceMatrix.array,part.buffer);assert.ok(part.mesh.count<=part.mesh.instanceMatrix.count);}
});

test('island draw ranges retain every visible land row and omit the empty prepared corridor',()=>{
 const rows=205,columns=18,geometry=new THREE.PlaneGeometry(2,330,columns,rows);geometry.rotateX(-Math.PI/2);geometry.translate(0,0,-95);
 let partial=0,empty=0;
 for(const level of LEVELS)for(const seed of [0,137,98213]){
  const profile=createCourseProfile(seed,level.length,level.index);
  for(let distance=0;distance<level.length+100;distance+=53){
   const range=islandDrawRange(distance,profile,rows,columns),first=range.start/(columns*6),last=first+range.count/(columns*6);
   assert.ok(range.start>=0&&range.count>=0&&range.start+range.count<=geometry.index.count);
   if(!range.count)empty++;else if(range.count<geometry.index.count)partial++;
   for(let row=0;row<rows;row++){
    const firstZ=geometry.attributes.position.getZ(row*(columns+1)),lastZ=geometry.attributes.position.getZ((row+1)*(columns+1));
    const courses=[distance-firstZ,distance-lastZ,distance-(firstZ+lastZ)/2];
    if(courses.some(course=>(riverFork(course,profile)?.islandHalfWidth??0)>.035))assert.ok(row>=first&&row<last,'every vertex or midpoint containing visible land remains submitted');
   }
  }
 }
 assert.ok(partial>100&&empty>100,'the same mesh avoids submitting empty land outside forks and beyond their noses');
});

test('course row culling retains visible wave and land vertices on every camera layout',()=>{
 const rows=205,waterColumns=32,landColumns=18,step=330/rows,frustum=new THREE.Frustum(),matrix=new THREE.Matrix4(),point=new THREE.Vector3();let removed=0;
 for(const [w,h] of [[390,844],[1365,900],[844,390]])for(const level of LEVELS)for(const seed of [0,137]){
  const profile=createCourseProfile(seed,level.length,level.index);
  for(let distance=0;distance<level.length;distance+=211)for(const lane of [0,4]){
   const pose=chaseCameraPose(w,h,distance,profile,lane),camera=new THREE.PerspectiveCamera(pose.fov,w/h,.3,1200);camera.position.set(pose.x,pose.y,pose.z);camera.lookAt(pose.look.x,pose.look.y,pose.look.z);camera.updateMatrixWorld();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
   for(const land of [false,true]){
    const columns=land?landColumns:waterColumns,initial=land?islandDrawRange(distance,profile,rows,columns):undefined,range=visibleCourseDrawRange(distance,profile,rows,columns,frustum,land,initial),first=range.start/(columns*6),last=first+range.count/(columns*6);removed+=rows-range.count/(columns*6);
    for(let row=0;row<=rows;row++){
     const course=distance+260-row*step,fork=riverFork(course,profile);if(land&&(!fork||fork.islandHalfWidth<=.035))continue;
     for(const across of [-1,-.5,0,.5,1]){
      const cross=land?fork.islandCenter+across*fork.islandHalfWidth:across*riverHalfWidth(course,profile),p=riverPoint(distance,course,cross,profile),height=land?islandHeight(cross,course,profile):surfaceAt(cross,course,distance/70,false,profile).height;
      point.set(p.x,p.y+height,p.z);if(frustum.containsPoint(point))assert.ok(row>=first&&row<=last,`${land?'land':'water'} visible vertex was culled at ${w}x${h}:${seed}:${level.index}:${distance}:${lane}:${row}`);
     }
    }
   }
  }
 }
 assert.ok(removed>1000,'hidden near rows are omitted without changing any mesh vertex');
});
