import test from 'node:test';
import assert from 'node:assert/strict';
import {LANES,LANE_SPACING,laneToX} from '../src/game/lanes.js';
import {terrainSection,terrainKindAt} from '../src/game/course-sections.js';
import {riverFork,nextRiverFork,forkLaneCross,islandContains,islandHeight,FORK_GLSL} from '../src/game/river-forks.js';
import {createCourseProfile,riverHash,riverHalfWidth,riverPoint,COURSE_GLSL} from '../src/game/river-course.js';
import {createFloat,advanceFloat,floatTarget} from '../src/game/hydrodynamics.js';

const lengths=[4200,5400,6600];
const close=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} ≈ ${expected}`);
function allForks(profile){const forks=[];let distance=0;for(let i=0;i<20;i++){const fork=nextRiverFork(distance,profile);if(!fork)break;forks.push(fork);distance=fork.end+.001;}return forks;}

test('every seeded map has finite real forks outside tutorials, wave trains and the finish runway',()=>{
 const themes=new Set(),sides=new Set();
 for(let mapIndex=0;mapIndex<3;mapIndex++)for(let seed=0;seed<251;seed++){
  const profile=createCourseProfile(seed,lengths[mapIndex],mapIndex),forks=allForks(profile);
  assert.ok(forks.length>=1&&forks.length<=6,`fork count ${mapIndex}:${seed}`);
  if(forks.length>1){assert.equal(new Set(forks.map(f=>f.riskSide)).size,2,'risk bank alternates across actual eligible forks');assert.ok(new Set(forks.map(f=>f.theme)).size>=2,'successive remembered episodes differ');}
  if(forks.length>=3)assert.equal(new Set(forks.slice(0,3).map(f=>f.theme)).size,3);
  for(const fork of forks){
   assert.ok(fork.start>800&&fork.end<=profile.length-150);assert.ok(fork.end-fork.start>=530);
   assert.ok(fork.splitEnd-fork.splitStart>=350,'three timed beats and a landing cache fit the core');
   assert.equal(fork.strength,1);assert.notEqual(terrainSection((fork.splitStart+fork.splitEnd)/2,profile).type,'wave-train');
   assert.equal(fork.safeSide,-fork.riskSide);themes.add(fork.theme);sides.add(fork.riskSide);
   assert.deepEqual(nextRiverFork(fork.start+1,profile).id,fork.id);
   assert.equal(riverFork(fork.start-1e-4,profile),null);assert.equal(riverFork(fork.end+1e-4,profile),null);
  }
  assert.equal(nextRiverFork(profile.length-150,profile),null);assert.equal(riverFork(profile.length-50,profile),null);
 }
 assert.equal(themes.size,3);assert.equal(sides.size,2);
 assert.equal(riverFork(1200,137),null);assert.equal(nextRiverFork(0,{seed:137,length:0}),null);
});

test('stream fans retain lane spacing and physically distinct shores, then continuously rejoin',()=>{
 for(const seed of [0,3,137,249,7123])for(let mapIndex=0;mapIndex<3;mapIndex++){
  const profile=createCourseProfile(seed,lengths[mapIndex],mapIndex);
  for(const fork of allForks(profile)){
   for(let d=fork.start;d<=fork.end;d+=1.79){
    const at=riverFork(d,profile),xs=LANES.map(lane=>forkLaneCross(lane,d,profile));
    close(xs[1]-xs[0],LANE_SPACING);close(xs[4]-xs[3],LANE_SPACING);
    assert.ok(xs[0]>-riverHalfWidth(d,profile)+2&&xs[4]<riverHalfWidth(d,profile)-2,'outer stream stays inside widened outerbanks');
    if(at.strength>.1){assert.ok(!islandContains(xs[1],d,profile,1.05));assert.ok(!islandContains(xs[3],d,profile,1.05));}
    if(at.strength>.7){assert.ok(islandContains(xs[2],d,profile));assert.ok(xs[3]-xs[1]>18,'water streams physically diverge');assert.ok(islandHeight(at.islandCenter,d,profile)>1.5);}
    for(let lane=.1;lane<4;lane+=.13)assert.ok(forkLaneCross(lane+.01,d,profile)>forkLaneCross(lane,d,profile),'continuous crossing cannot skip the island');
    close(riverPoint(d,d,0,profile).x,0);
   }
   for(const edge of [fork.start,fork.splitStart,fork.splitEnd,fork.end])for(const lane of [...LANES,.3,1.6,2.7]){
    close(forkLaneCross(lane,edge-1e-5,profile),forkLaneCross(lane,edge+1e-5,profile),1e-5);
    close(riverHalfWidth(edge-1e-5,profile),riverHalfWidth(edge+1e-5,profile),1e-4);
   }
   for(const d of [fork.start,fork.end])for(const lane of LANES)close(forkLaneCross(lane,d,profile),laneToX(lane));
  }
 }
});

test('actual island footprint and edge height do not classify adjacent channel water as land',()=>{
 const profile=createCourseProfile(137,4200,0),fork=nextRiverFork(0,profile),distance=(fork.splitStart+fork.splitEnd)/2,at=riverFork(distance,profile);
 for(const side of [-1,1]){
  const edge=at.islandCenter+side*at.islandHalfWidth;
  assert.equal(islandContains(edge-side*.001,distance,profile),true);assert.equal(islandContains(edge+side*.001,distance,profile),false);
  assert.equal(islandContains(edge+side*.5,distance,profile,.6),true);assert.equal(islandContains(edge+side*.7,distance,profile,.6),false);
  assert.ok(islandHeight(edge-side*.001,distance,profile)>.079);assert.equal(islandHeight(edge+side*.001,distance,profile),0);
 }
 assert.equal(islandContains(0,fork.start,profile,1.05),false);assert.equal(islandContains(0,fork.end,profile,1.05),false);
 const before=riverFork(distance,profile);riverFork(distance,createCourseProfile(4,6600,2));assert.deepEqual(riverFork(distance,profile),before,'interleaving maps never changes the fork');
});

test('each island has broad asymmetric headlands and physically bending streams rather than a straight median',()=>{
 const shapes=[];
 for(const seed of [0,3,73,137,249])for(let mapIndex=0;mapIndex<3;mapIndex++){
  const profile=createCourseProfile(seed,lengths[mapIndex],mapIndex);
  for(const fork of allForks(profile)){
   let minWidth=Infinity,maxWidth=0,minCenter=Infinity,maxCenter=-Infinity;
   const silhouette=[];
   for(let d=fork.splitStart;d<fork.splitEnd;d+=5){
    const at=riverFork(d,profile);minWidth=Math.min(minWidth,at.islandHalfWidth);maxWidth=Math.max(maxWidth,at.islandHalfWidth);minCenter=Math.min(minCenter,at.islandCenter);maxCenter=Math.max(maxCenter,at.islandCenter);
    close(forkLaneCross(2,d,profile),at.islandCenter);
    for(const channel of at.channels)close(channel.center,channel.lanes.reduce((sum,lane)=>sum+forkLaneCross(lane,d,profile),0)/2);
    for(const lane of [0,1,3,4]){
     const cross=forkLaneCross(lane,d,profile);
     assert.ok(Math.abs(cross-at.islandCenter)-at.islandHalfWidth>1.05,'raft has real margin around every broad land bulb');
    }
    silhouette.push([Number(at.islandCenter.toFixed(2)),Number(at.islandHalfWidth.toFixed(2))]);
   }
   assert.ok(maxWidth-minWidth>1.5,'a headland and a narrower waist are visible within the full island');
   assert.ok(maxCenter-minCenter>1.5,'streams wind coherently around opposite broad bends');
   assert.ok(minCenter<-.5&&maxCenter>.5,'the bend changes direction instead of uniformly offsetting a straight median');
   shapes.push(JSON.stringify(silhouette));
  }
 }
 assert.ok(new Set(shapes).size>20,'seed and map profiles produce different island silhouettes');
});

// Execute the actual GLSL fork body with scalar JS equivalents. This checks
// the shader equations, not a separately maintained copy of fork geometry.
function shaderFork(profile){
 const body=FORK_GLSL.match(/vec4 rFork\(float d\)\{([\s\S]*?)\n\}/)[1].replace(/\bfloat\b/g,'let');
 const smooth=n=>{const u=Math.max(0,Math.min(1,n));return u*u*(3-2*u);};
 const vector=(...args)=>args.length===1?{x:args[0],y:args[0],z:args[0],w:args[0]}:{x:args[0],y:args[1],z:args[2],w:args[3]};
 return Function('uCourseLength','uCourseMap','uSeed','rHash','rSmooth','rSectionKind','clamp','floor','sin','vec4',`return function(d){${body}}`)(profile.length,profile.mapIndex,profile.seed,n=>riverHash(n,profile),smooth,n=>terrainKindAt(n,profile.seed),(n,a,b)=>Math.max(a,Math.min(b,n)),Math.floor,Math.sin,vector);
}
function shaderLaneCross(gpu){
 const body=FORK_GLSL.match(/float rForkLaneCross\(float lane,float d\)\{([^\n]+)\}/)[1].replace(/\b(?:float|vec4)\b/g,'let');
 const smooth=n=>{const u=Math.max(0,Math.min(1,n));return u*u*(3-2*u);};
 return Function('rFork','rSmooth',`return function(lane,d){${body}}`)(gpu,smooth);
}
test('CPU and actual GPU fork equations agree across entry, full island, reunion and profile seeds',()=>{
 assert.ok(COURSE_GLSL.indexOf('float rSectionKind')<COURSE_GLSL.indexOf('vec4 rFork'),'shader section dependency is declared first');
 assert.ok(COURSE_GLSL.includes(FORK_GLSL));assert.match(COURSE_GLSL,/float rWidth\(float d\)[^\n]+\+rFork\(d\)\.w/);
 for(let mapIndex=0;mapIndex<3;mapIndex++)for(const seed of [0,3,137,249,7123]){
  const profile=createCourseProfile(seed,lengths[mapIndex],mapIndex),gpu=shaderFork(profile),gpuCross=shaderLaneCross(gpu);
  for(let d=0;d<=profile.length+200;d+=3.713){
   const cpu=riverFork(d,profile),shader=gpu(d);close(shader.x,cpu?.strength??0);close(shader.y,cpu?.islandHalfWidth??0);close(shader.z,cpu?.islandCenter??0);close(shader.w,cpu?.fanOffset??0);
   for(const lane of [...LANES,.4,1.7,2.65,3.8])close(gpuCross(lane,d),forkLaneCross(lane,d,profile));
  }
 }
});

test('raft buoyancy probes the actual fork stream physical cross and pauses exactly',()=>{
 const profile=createCourseProfile(509,5400,1),fork=nextRiverFork(0,profile),distance=(fork.splitStart+fork.splitEnd)/2;
 for(const visualLane of [0,.35,1,3,3.65,4]){
  const g={seed:509,time:7.5,distance,visualLane,laneVelocity:0,effects:[]},state=createFloat(g,profile);
  const target=floatTarget(forkLaneCross(visualLane,distance,profile),distance,g.time,false,profile);
  close(state.height,target.height);close(state.heightTarget,target.height);
  const old=floatTarget(laneToX(visualLane),distance,g.time,false,profile);assert.notEqual(state.height,old.height,'probes leave the unsplit corridor');
  g.time+=1/60;advanceFloat(state,g);close(state.heightTarget,floatTarget(forkLaneCross(visualLane,distance,profile),distance,g.time,false,profile).height);
  const paused={...state};advanceFloat(state,g);assert.deepEqual(state,paused);
 }
});
