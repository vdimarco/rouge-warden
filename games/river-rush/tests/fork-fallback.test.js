import test from 'node:test';
import assert from 'node:assert/strict';
import {projection,branchProjection,fallbackRiderWidth,encounterProjection,renderGame} from '../src/game/render.js';
import {forkFallbackGeometry,projectPhysical,fallbackCamera,fallbackShoreHalfWidth,drawForkFallback,treasurePresentation,drawTreasure2D} from '../src/game/fork-fallback.js';
import {createCourseProfile,riverHalfWidth} from '../src/game/river-course.js';
import {nextRiverFork,riverFork,forkLaneCross,islandContains} from '../src/game/river-forks.js';
import {LEVELS} from '../src/game/levels.js';
import {HAZARD_LANE_RADIUS,createGame,updateGame} from '../src/game/engine.js';
import {RIDER_SIZE} from '../src/game/rider.js';
import {LANE_SPACING} from '../src/game/lanes.js';
import {drawWater} from '../src/game/water.js';

const layouts=[[390,844],[360,640],[1365,900],[844,390]],close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
const fixture=(seed=137,index=0)=>{const level=LEVELS[index],terrainProfile=createCourseProfile(seed,level.length,index),fork=nextRiverFork(0,terrainProfile);assert.ok(fork);return{seed,levelIndex:index,terrainProfile,distance:(fork.splitStart+fork.splitEnd)/2,visualLane:1,time:20,fork};};

test('fallback lanes, enemies and two water channels share actual fork geography on every map and layout',()=>{
 for(const seed of [1,137,249])for(const level of LEVELS)for(const [width,height] of layouts){
  const g=fixture(seed,level.index),fork=riverFork(g.distance,g.terrainProfile),geometry=forkFallbackGeometry(g,width,height);
  assert.ok(geometry.length>0&&geometry.length<=3);
  for(const lane of [0,1,3,4]){
   const p=projection(width,height,lane,0,g),physical=forkLaneCross(lane,g.distance,g.terrainProfile),at=projectPhysical(width,height,physical,0,g);
   close(p.x,at.x);close(p.y,at.y);assert.equal(islandContains(physical,g.distance,g.terrainProfile),false);
   const enemy={id:3,enemy:'crocodile',type:'log',lane,d:g.distance};close(encounterProjection(enemy,g,width,height).x,p.x);
  }
  close(projection(width,height,1,0,g).x-projection(width,height,0,0,g).x,LANE_SPACING*projection(width,height,0,0,g).unit);
  close(projection(width,height,4,0,g).x-projection(width,height,3,0,g).x,LANE_SPACING*projection(width,height,4,0,g).unit);
  assert.ok(projection(width,height,3,0,g).x-projection(width,height,1,0,g).x>LANE_SPACING*projection(width,height,1,0,g).unit*4);
  assert.ok(fork.islandHalfWidth>6);
  for(const mesh of geometry)for(let i=0;i<mesh.innerLeft.length;i++){
   const left=mesh.outerLeft[i],innerLeft=mesh.innerLeft[i],innerRight=mesh.innerRight[i],right=mesh.outerRight[i];
   assert.ok(left.x<=innerLeft.x&&innerLeft.x<=innerRight.x&&innerRight.x<=right.x);
   const sampled=riverFork(innerLeft.course,g.terrainProfile);if(sampled){close(innerLeft.cross,sampled.islandCenter-sampled.islandHalfWidth);close(innerRight.cross,sampled.islandCenter+sampled.islandHalfWidth);}
  }
 }
});

test('island camera keeps complete banking riders visible and reunites without a position jump',()=>{
 for(const level of LEVELS)for(const [width,height] of layouts){
  const g=fixture(137,level.index),fork=g.fork;
  for(const distance of [fork.start-1,fork.start+30,fork.splitStart,(fork.splitStart+fork.splitEnd)/2,fork.splitEnd,fork.end-1,fork.end,fork.end+1]){
   g.distance=distance;const rider=fallbackRiderWidth(width,height,g),half=rider/2,top=rider*(RIDER_SIZE.foot/RIDER_SIZE.width+.14);
   for(const lane of [0,1,3,4])for(const roll of [-.16,0,.16]){
    g.visualLane=lane;const p=projection(width,height,lane,0,g),extent=half*Math.cos(roll)+top*Math.abs(Math.sin(roll));assert.ok(p.x-extent>=0&&p.x+extent<=width,`${width}x${height} lane${lane} clips at${distance}`);
   }
  }
  g.distance=fork.end-.001;const before=projection(width,height,4,0,g);g.distance=fork.end+.001;const after=projection(width,height,4,0,g);assert.ok(Math.abs(before.x-after.x)<.001,'reunion is continuous');
  close(after.x,projection(width,height,4,0).x);
 }
});

test('committed stream keeps the full-size rider and a stable camera during within-stream steering',()=>{
 for(const level of LEVELS)for(const [width,height] of layouts){
  const g=fixture(137,level.index),normal=fallbackRiderWidth(width,height);
  for(const lanes of [[0,1],[3,4]]){
   let previous;
   for(let lane=lanes[0];lane<=lanes[1]+1e-9;lane+=.125){
    g.visualLane=lane;const camera=fallbackCamera(g),rider=fallbackRiderWidth(width,height,g);
    assert.ok(rider>=normal*.98,'route commitment must not halve the hero');assert.ok(camera.commit>.98);
    if(previous)close(camera.cross,previous.cross);previous=camera;
   }
   const points=lanes.map(lane=>projection(width,height,lane,0,g));assert.ok(points.every(point=>point.x>width*.15&&point.x<width*.85),'both chosen-stream lanes stay in the central view');
  }
  g.visualLane=2;assert.equal(fallbackCamera(g).commit,0,'an undecided preview shows both streams');
  const preview=[0,1,3,4].map(lane=>projection(width,height,lane,90,g));assert.ok(preview.every(point=>point.x>0&&point.x<width));
 }
});

test('fork branch contact strips use physical meter margins rather than stretching into the island',()=>{
 for(const side of [-1,1])for(const [width,height] of layouts){
  const g=fixture(),lanes=side<0?[0,1]:[3,4],e={id:5,type:'branch',lane:lanes[0],branchLanes:lanes,branchSide:side,d:g.distance},p=branchProjection(e,g,width,height);
  close(p.lowCross,forkLaneCross(lanes[0],e.d,g.terrainProfile)-HAZARD_LANE_RADIUS*LANE_SPACING);
  close(p.highCross,forkLaneCross(lanes[1],e.d,g.terrainProfile)+HAZARD_LANE_RADIUS*LANE_SPACING);
  assert.ok(p.marks.every(mark=>mark.x>p.start.x&&mark.x<p.end.x));
  if(side<0)assert.ok(p.highCross<riverFork(g.distance,g.terrainProfile).islandCenter);else assert.ok(p.lowCross>riverFork(g.distance,g.terrainProfile).islandCenter);
 }
});

test('fork shores smooth into the approved normal apron and reach shared physical core banks',()=>{
 const g=fixture(),fork=g.fork;
 for(const distance of [fork.start,fork.end]){
  const width=fallbackShoreHalfWidth(distance,g.terrainProfile),next=fallbackShoreHalfWidth(distance+.001,g.terrainProfile);assert.ok(Math.abs(width-next)<.001);
 }
 close(fallbackShoreHalfWidth(g.distance,g.terrainProfile),riverHalfWidth(g.distance,g.terrainProfile));
});

function recordingContext(){
 const calls=[],gradient={addColorStop(...args){calls.push(['color',...args]);}},target={calls,createPattern(){return'prepared-pattern';},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;}};
 return new Proxy(target,{get(object,key){if(key in object)return object[key];return(...args)=>calls.push([key,...args]);},set(object,key,value){calls.push(['set',key,value===gradient?'gradient':value]);object[key]=value;return true;}});
}

test('fork fallback freezes exactly from game time and distance with bounded reusable patterns',()=>{
 const g=fixture(),art={surfaceground:{},surfacewater:{}};g.levelIndex=0;
 const first=recordingContext();assert.equal(drawForkFallback(first,g,art,390,844),true);const count=first.calls.length;assert.ok(count<4000);
 const paused=recordingContext();assert.equal(drawForkFallback(paused,{...g,phase:'paused'},art,390,844),true);assert.deepEqual(paused.calls,first.calls);
 for(let i=0;i<8;i++){const context=recordingContext();drawForkFallback(context,{...g,distance:g.distance+i*14},art,390,844);assert.ok(context.calls.length<4000);}
 assert.deepEqual(forkFallbackGeometry({...g,phase:'paused'},390,844),forkFallbackGeometry(g,390,844));
 const reduced={...g,reducedMotion:true};assert.deepEqual(forkFallbackGeometry(reduced,390,844),forkFallbackGeometry(g,390,844));
 const still=recordingContext();drawForkFallback(still,reduced,art,390,844,true);assert.ok(still.calls.some(call=>call[0]==='lineTo'&&call[1]!==0),'reduced motion retains actual fork terrain');
 for(const lane of [0,1,3,4])assert.deepEqual(projection(390,844,lane,0,reduced),projection(390,844,lane,0,g));
});

test('Canopy fork noses and reunions preserve the normal whitewater surface instead of cutting in a darker rectangle',()=>{
 const g=fixture(),card={width:1024,height:1536},art={portrait:card,environment:{width:1024,height:688},surfaceground:card,surfacewater:card};
 for(const [width,height] of layouts)for(const distance of [g.fork.start-70,g.fork.end-70]){
  const at={...g,distance},normal=recordingContext(),fork=recordingContext();
  drawWater(normal,at,art,width,height,true,false);assert.equal(drawForkFallback(fork,at,art,width,height,true),true);
  const baseline=normal.calls.find(call=>call[0]==='drawImage'),channelPaints=fork.calls.filter(call=>call[0]==='drawImage');
  assert.ok(baseline);assert.ok(channelPaints.length>=2,'both actual stream masks receive the same whitewater art');
  for(const image of channelPaints)assert.deepEqual(image,baseline,'fork clipping cannot change the surface color or image registration at the transition');
  assert.ok(fork.calls.filter(call=>call[0]==='clip').length>=3,'solid island land still has its own physical mask beside the two water masks');
 }
});

test('treasure silhouettes and promise distinguish the actual completion bonus from a route label',()=>{
 const calm={id:9,type:'treasure',treasureBase:200,treasureCleanBonus:0,routeRole:'risk'},risky={...calm,treasureCleanBonus:400};
 assert.equal(treasurePresentation(calm).payoff,200);assert.equal(treasurePresentation(calm).risk,false);assert.equal(treasurePresentation(risky).payoff,600);assert.equal(treasurePresentation(risky).risk,true);
 const a=recordingContext(),b=recordingContext();drawTreasure2D(a,calm,{x:150,y:300},40,12,true);drawTreasure2D(b,risky,{x:150,y:300},40,12,true);assert.notDeepEqual(a.calls,b.calls,'a crown and different metal distinguish the clean-completion cache');
 const stopped=recordingContext();drawTreasure2D(stopped,risky,{x:150,y:300},40,60,true);assert.deepEqual(stopped.calls,b.calls,'reduced motion leaves the recognizable cache still');
});

test('a real protected island rebound renders impact feedback without trying to explode missing terrain art',()=>{
 const g=createGame(137,1),fork=nextRiverFork(0,g.terrainProfile);assert.ok(fork);
 g.distance=(fork.splitStart+fork.splitEnd)/2;g.time=20;g.rush=1;g.shield=false;g.entities=[];g.nextRow=Infinity;
 g.lane=g.visualLane=2;g.laneVelocity=0;updateGame(g,{actions:[]},1/60);
 const smash=g.effects.find(effect=>effect.type==='smash'&&effect.obstacle==='island');assert.ok(smash,'actual protected terrain contact should emit its shared impact');assert.equal(g.phase,'playing');assert.ok(g.islandReboundSide);
 const card={width:512,height:704},art={surfaceground:card,surfacewater:card,sprites:card,paddleFrames:[{width:448,height:380}],downstreamFrames:Array(9).fill(card),world:{foam:Array(3).fill(card)},map2d:{grounds:Array(3).fill(card),rivers:Array(3).fill(card),canyonSkyline:[card,card],props:[null,null,null],finish:null}};
 const context=recordingContext();assert.doesNotThrow(()=>renderGame(context,g,art,390,844,false,true));
 assert.ok(context.calls.some(call=>call[0]==='arc'),'contact splash is rendered');assert.ok(context.calls.some(call=>call[0]==='drawImage'),'the rider remains rendered after impact');
});
