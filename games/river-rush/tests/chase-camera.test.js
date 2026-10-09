import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chaseCameraPose,chaseCameraSettings,cameraEnvelope,RAFT_SCREEN_ENVELOPE} from '../src/game/chase-camera.js';
import {LANES,LANE_SPACING,laneToX,CENTER_LANE} from '../src/game/lanes.js';
import {LEVELS} from '../src/game/levels.js';
import {createCourseProfile,riverPoint} from '../src/game/river-course.js';
import {riverFork,forkLaneCross} from '../src/game/river-forks.js';

test('all five active raft bodies, jumps and upcoming routes remain in phone, desktop and landscape framing',()=>{
 for(const [w,h] of [[390,844],[360,640],[1365,900],[844,390]]){
  const camera=new THREE.PerspectiveCamera(chaseCameraSettings(w,h).fov,w/h,.3,1200),point=new THREE.Vector3();let bodyMax=0,routeMax=0;
  for(const seed of [0,137,98213])for(const level of LEVELS)for(let d=0;d<level.length;d+=73){
   const profile=createCourseProfile(seed,level.length,level.index);
   const fork=riverFork(d,profile);
   for(const visualLane of LANES){if(fork&&visualLane===CENTER_LANE)continue;const pose=chaseCameraPose(w,h,d,profile,visualLane);camera.position.set(pose.x,pose.y,pose.z);camera.lookAt(pose.look.x,pose.look.y,pose.look.z);camera.updateMatrixWorld();
    for(const x of [forkLaneCross(visualLane,d,profile)-2.4,forkLaneCross(visualLane,d,profile)+2.4])for(const y of [-.3,3.7,7.45]){point.set(x,y,1.5).project(camera);bodyMax=Math.max(bodyMax,Math.abs(point.x));assert.ok(Math.abs(point.x)<.985,'the outer jumping body/paddle must stay on screen');assert.ok(Math.abs(point.y)<.9,'the rider remains within the vertical game view');}
    for(const lane of LANES){if(fork&&(lane===CENTER_LANE||(lane<2)!==(visualLane<2)))continue;const p=riverPoint(d,d+20,forkLaneCross(lane,d+20,profile),profile);point.set(p.x,p.y+1,p.z).project(camera);routeMax=Math.max(routeMax,Math.abs(point.x));assert.ok(Math.abs(point.x)<.9&&Math.abs(point.y)<.95,'upcoming routes stay visible');}
   }
  }
  console.log(JSON.stringify({layout:`${w}x${h}`,bodyMax,routeMax}));
 }
});

test('camera uses the shared center for all steering positions and reduced motion freezes its chase origin',()=>{
 const profile=createCourseProfile(137,5400,1);
 for(const visualLane of [...LANES,.25,1.5,3.9]){const actual=chaseCameraPose(390,844,580,profile,visualLane);assert.ok(Math.abs(actual.x-(visualLane-CENTER_LANE)*.22)<1e-12);const fixed=chaseCameraPose(390,844,0,profile,visualLane,true);assert.equal(fixed.x,0);assert.equal(fixed.fov,86);}
 assert.equal(chaseCameraPose(1365,900,580,profile,CENTER_LANE).x,0);assert.equal(LANE_SPACING,3.8);
});

test('framing diagnostics contain every projected hull, rider and paddle corner for the active lane',()=>{
 const profile=createCourseProfile(98213,5400,2),probe=new THREE.Vector3(),corner=new THREE.Vector3(),e=RAFT_SCREEN_ENVELOPE;
 for(const [w,h] of [[390,844],[1365,900],[844,390]])for(const lane of LANES)for(const lift of [0,e.maxJumpLift]){
  const pose=chaseCameraPose(w,h,1480,profile,lane),camera=new THREE.PerspectiveCamera(pose.fov,w/h,.3,1200);
  camera.position.set(pose.x,pose.y,pose.z);camera.lookAt(pose.look.x,pose.look.y,pose.look.z);camera.updateMatrixWorld();
  const bounds=cameraEnvelope(camera,probe,laneToX(lane),.85,lift);
  for(const dx of [-e.halfWidth,e.halfWidth])for(const y of [e.footHeight,e.headHeight]){
   corner.set(laneToX(lane)+dx,.85+lift+y,e.nearZ).project(camera);
   assert.ok(corner.x>=bounds.left-1e-12&&corner.x<=bounds.right+1e-12);
   assert.ok(corner.y>=bounds.bottom-1e-12&&corner.y<=bounds.top+1e-12);
  }
  assert.ok(bounds.left>-.985&&bounds.right<.985,'the diagnostic must show the full active outer raft on screen');
  assert.ok(bounds.bottom>-.9&&bounds.top<.9,'the jumping rider remains within the vertical game view');
 }
});
