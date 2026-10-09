import test from 'node:test';
import assert from 'node:assert/strict';
import {projection,branchProjection,fallbackRiderWidth,encounterProjection,renderGame} from '../src/game/render.js';
import {forkFallbackGeometry,islandRelief2D,islandGroundPatches,projectPhysical,fallbackCamera,fallbackShoreHalfWidth,drawForkFallback,treasurePresentation,drawTreasure2D,stashPresentation,drawStash2D} from '../src/game/fork-fallback.js';
import {createCourseProfile,riverHalfWidth} from '../src/game/river-course.js';
import {nextRiverFork,riverFork,forkLaneCross,islandContains,islandHeight} from '../src/game/river-forks.js';
import {LEVELS} from '../src/game/levels.js';
import {HAZARD_LANE_RADIUS,createGame,updateGame} from '../src/game/engine.js';
import {RIDER_SIZE} from '../src/game/rider.js';
import {LANE_SPACING} from '../src/game/lanes.js';
import {drawWater} from '../src/game/water.js';
import {FORK_PALETTES,islandLandmarks,islandSurfaceTile,ISLAND_SURFACE_TILE_SIZE} from '../src/game/fork-art-direction.js';
import {prepareForkFallbackArt} from '../src/game/fork-fallback-art.js';

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
 const calls=[],gradient={addColorStop(...args){calls.push(['color',...args]);}},target={calls,createPattern(source){calls.push(['pattern',source]);return'prepared-pattern';},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;}};
 return new Proxy(target,{get(object,key){if(key in object)return object[key];return(...args)=>calls.push([key,...args]);},set(object,key,value){calls.push(['set',key,value===gradient?'gradient':value]);object[key]=value;return true;}});
}
// The runtime prepares both the sprite atlas and independent foliage before
// starting a run. Resource bounds must include those actual detailed images.
function preparedArt(){
 const card={width:1024,height:1024};return{surfaceground:card,surfacewater:card,portrait:card,environment:card,sprites:{width:1280,height:1280},branchLeaves:{width:512,height:512}};
}

test('organic island material is seamless shared data and themed fallback cards are prepared only before play',()=>{
 const tile=islandSurfaceTile();assert.equal(tile,islandSurfaceTile(),'the shared resource is prepared exactly once');
 assert.equal(tile.width,ISLAND_SURFACE_TILE_SIZE);assert.equal(tile.height,ISLAND_SURFACE_TILE_SIZE);assert.equal(tile.data.length,tile.width*tile.height*4);
 for(const channel of [0,1]){
  let edge=0,min=255,max=0;
  for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++){
   const index=(y*tile.width+x)*4,value=tile.data[index+channel];min=Math.min(min,value);max=Math.max(max,value);assert.equal(tile.data[index+3],255);
   if(x===0)edge=Math.max(edge,Math.abs(value-tile.data[(y*tile.width+tile.width-1)*4+channel]));
   if(y===0)edge=Math.max(edge,Math.abs(value-tile.data[((tile.height-1)*tile.width+x)*4+channel]));
  }
  assert.ok(max-min>120,'the material has irregular patches across its full tile');assert.ok(edge<10,'seamless broad and medium fields do not form tile boundary stripes');
 }
 const art=preparedArt(),canvases=[];
 const createCanvas=()=>{
  const context=recordingContext();context.createImageData=(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)});
  const canvas={width:0,height:0,getContext:()=>context};canvases.push(canvas);return canvas;
 };
 art.fork2d=prepareForkFallbackArt(art,createCanvas);assert.equal(canvases.length,9);assert.equal(art.fork2d.grounds.length,3);assert.equal(art.fork2d.rocks.length,3);assert.equal(art.fork2d.plants.length,3);
 for(const level of LEVELS){
  const g=fixture(137,level.index),ctx=recordingContext();drawForkFallback(ctx,g,art,390,844);const stopped=recordingContext();drawForkFallback(stopped,{...g,phase:'paused'},art,390,844);
  assert.deepEqual(ctx.calls,stopped.calls);assert.ok(ctx.calls.some(call=>call[0]==='pattern'&&call[1]===art.fork2d.grounds[level.index]),'terrain selects its prepared thematic material');
  assert.ok(ctx.calls.some(call=>call[0]==='drawImage'&&call[1]===art.fork2d.rocks[level.index]),'actual island clumps use the prepared mineral colors and detailed silhouette');
 }
 assert.equal(canvases.length,9,'rendering and changing map never create an extra art canvas');
});

test('fork fallback freezes exactly from game time and distance with bounded reusable patterns',()=>{
 const g=fixture(),art=preparedArt();g.levelIndex=0;
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

test('fallback island relief rises from actual land height without moving contact shores or changing camera registration',()=>{
 for(const level of LEVELS)for(const [width,height] of layouts){
  const g=fixture(137,level.index),geometry=forkFallbackGeometry(g,width,height);let peaks=0;
  for(const island of geometry){
   const rows=islandRelief2D(g,width,height,island);assert.ok(rows.length<=33);
   for(const row of rows){
    if(!row.length)continue;assert.equal(row.length,9);
    for(const point of row){const water=projectPhysical(width,height,point.cross,point.course-g.distance,g);close(point.x,water.x);close(point.waterY,water.y);close(point.height,islandHeight(point.cross,point.course,g.terrainProfile));close(point.y,water.y-point.height*water.unit);}
    assert.ok(row[0].height<=.081&&row.at(-1).height<=.081,'wet edges remain at physical land contact');
    if(row[4].height>2){assert.ok(row[4].y<row[4].waterY-2*row[4].unit);peaks++;}
   }
  }
  assert.ok(peaks>0,'the island must have observable relief, not just a flat colored median');
  for(const island of geometry)assert.deepEqual(islandRelief2D({...g,phase:'paused'},width,height,island),islandRelief2D(g,width,height,island));
 }
});

test('fallback island materials and landmarks retain all three map identities with bounded stopped drawing',()=>{
 const identities=[];
 for(const level of LEVELS){
  const g=fixture(137,level.index),art=preparedArt(),a=recordingContext(),b=recordingContext();
  drawForkFallback(a,g,art,390,844);drawForkFallback(b,{...g,phase:'paused'},art,390,844);assert.deepEqual(a.calls,b.calls);
  const colors=a.calls.filter(call=>call[0]==='set'&&(call[1]==='fillStyle'||call[1]==='strokeStyle')).map(call=>call[2]);
  assert.ok(colors.includes(FORK_PALETTES[level.index].wet)&&colors.includes(FORK_PALETTES[level.index].shore)&&colors.includes(FORK_PALETTES[level.index].ridge));
  identities.push(islandLandmarks(g.fork,g.terrainProfile)[0].type);assert.ok(a.calls.length<4000,'relief and prepared detailed ground clumps keep the fallback drawing bounded');
 }
 assert.deepEqual(identities,['root-grove','sandstone-shelf','broken-obelisk']);
});

test('both island coasts have bounded seeded soil and detailed ground clumps instead of uninterrupted color strips',()=>{
 let count=0;
 for(const level of LEVELS)for(const seed of [0,137,98213]){
  const g=fixture(seed,level.index),patches=islandGroundPatches(g.fork,g.terrainProfile);
  assert.ok(patches.length>24&&patches.length<=52,'a finite island has a small, bounded set of authored ground patches');
  assert.deepEqual(patches,islandGroundPatches(riverFork(g.fork.splitStart+20,g.terrainProfile),g.terrainProfile),'absolute ground identities do not change with the camera');
  assert.equal(new Set(patches.map(patch=>patch.id)).size,patches.length);
  for(const side of [-1,1]){
   const coast=patches.filter(patch=>patch.side===side);
   for(let i=1;i<coast.length;i++)assert.ok(coast[i].d-coast[i-1].d<35,'neither visible coast stays bare for a long straight stretch');
  }
  for(const patch of patches){
   const fork=riverFork(patch.d,g.terrainProfile),cross=fork.islandCenter+patch.fraction*fork.islandHalfWidth;
   assert.ok(islandContains(cross,patch.d,g.terrainProfile));
   if(fork.strength>.45)assert.ok(islandContains(cross-.6,patch.d,g.terrainProfile)&&islandContains(cross+.6,patch.d,g.terrainProfile),'detailed low clumps fit entirely on actual land');
   assert.ok(Number.isFinite(patch.turn)&&patch.length>3&&patch.length<8);count++;
  }
  const art=preparedArt(),ctx=recordingContext();drawForkFallback(ctx,g,art,390,844);
  const stones=ctx.calls.filter(call=>call[0]==='drawImage'&&call[1]===art.sprites);
  assert.ok(stones.length>=12,'the committed stream sees detailed atlas stones along its island coast');
  if(level.index!==1)assert.ok(ctx.calls.some(call=>call[0]==='drawImage'&&call[1]===art.branchLeaves),'root groves or moonlit scrub break the earth surface');
 }
 assert.ok(count>300);
});

test('gold stashes have a stationary ground silhouette and truthful fixed-value receipt distinct from the final chest',()=>{
 for(const value of [120,200]){
  const e={id:91,type:'stash',value,lane:1,d:1200},a=recordingContext(),b=recordingContext(),chest=recordingContext(),point={x:190,y:610};
  assert.equal(stashPresentation(e).value,value);drawStash2D(a,e,point,42,1,true);drawStash2D(b,e,point,42,60,true);assert.deepEqual(a.calls,b.calls);
  assert.ok(a.calls.some(call=>call[0]==='fillText'&&call[1]===`+${value} PTS`));drawTreasure2D(chest,{id:92,treasureBase:200,treasureCleanBonus:400},point,42,1,true);assert.notDeepEqual(a.calls,chest.calls,'a low gold purse must not promise the clean-cache chest');
  const g=createGame(137,1),fork=nextRiverFork(0,g.terrainProfile);g.distance=(fork.splitStart+fork.splitEnd)/2;g.time=20;g.lane=g.visualLane=1;g.laneVelocity=0;g.nextRow=Infinity;g.entities=[{...e,d:g.distance+1,collected:false}];g.streak=18;g.multiplier=3;g.lastCoin=20;g.magnet=6;g.charge=37;
  const card={width:512,height:704},art={surfaceground:card,surfacewater:card,sprites:card,paddleFrames:[{width:448,height:380}],downstreamFrames:Array(9).fill(card),world:{foam:Array(3).fill(card)},map2d:{grounds:Array(3).fill(card),rivers:Array(3).fill(card),canyonSkyline:[card,card],props:[null,null,null],finish:null}},beforeRender=recordingContext();
  assert.doesNotThrow(()=>renderGame(beforeRender,g,art,390,844,false,true));assert.ok(beforeRender.calls.some(call=>call[0]==='fillText'&&call[1]===`+${value} PTS`),'the actual approaching purse advertises its fixed payout');
  const before={bonus:g.bonus,coins:g.coins,streak:g.streak,charge:g.charge};updateGame(g,{actions:[]},1/60);
  assert.equal(g.bonus-before.bonus,value);assert.equal(g.coins,before.coins);assert.equal(g.streak,before.streak);assert.equal(g.charge,before.charge);
  const receipt=g.effects.find(effect=>effect.type==='stash');assert.equal(receipt.value,value);assert.equal(receipt.entityId,e.id);
  const afterRender=recordingContext();assert.doesNotThrow(()=>renderGame(afterRender,g,art,390,844,false,true));assert.ok(afterRender.calls.some(call=>call[0]==='fillText'&&call[1]===`+${value}`),'the physically collected purse has its own visible receipt');
 }
});

test('bank fallback advertises actual coin currency rather than an invented fixed point value',()=>{
 const entity={id:92,type:'stash',value:80,coinCount:8,choiceFamily:'wildlife-bank'},ctx=recordingContext();
 assert.equal(stashPresentation(entity).coinCount,8);
 assert.equal(stashPresentation(entity).label,'8 COINS');
 drawStash2D(ctx,entity,{x:190,y:610},42,0,true);
 assert.ok(ctx.calls.some(call=>call[0]==='fillText'&&call[1]==='8 COINS'));
 assert.equal(ctx.calls.some(call=>call[0]==='fillText'&&call[1]==='+80 PTS'),false);
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
