import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,queueAction,updateGame,timeToImpact,generateAhead,hazardTouchesLane,snapshot,ISLAND_RAFT_RADIUS,speedAt} from '../src/game/engine.js';
import {LEVELS} from '../src/game/levels.js';
import {nextRiverFork,riverFork,forkLaneCross,islandContains} from '../src/game/river-forks.js';
import {createAdventure,treasurePayout} from '../src/game/river-adventures.js';
import {laneSpring} from '../src/game/world.js';
import {entityPose} from '../src/game/moving-encounters.js';
const steer=(g,input,lane)=>{for(let n=0;n<Math.abs(lane-g.lane);n++)queueAction(input,lane>g.lane?'right':'left');};
function fixture(seed,index,fork=null){
 const g=createGame(seed,index);fork??=nextRiverFork(0,g.terrainProfile);
 assert.ok(fork);g.distance=fork.start-140;g.time=260;g.nextRow=fork.start;g.entities=[];g.adventures=[];g.shield=false;g.goal={kind:'coins',start:0,target:1e9};generateAhead(g);
 return {g,fork};
}
function ride(seed,index,hz,role,{rush=false,skipStep=null}={}){
 const {g,fork}=fixture(seed,index);if(rush)g.charge=100;const input=emptyInput(),side=role==='risk'?fork.riskSide:fork.safeSide,handled=new Set(),events=[];let last=0,maxEntities=0;
 while(g.phase==='playing'&&g.distance<fork.end+6){
  const packet=g.adventures.find(p=>p.id===fork.id),guards=g.entities.filter(e=>!e.done&&e.adventureId===fork.id&&['rock','branch','log'].includes(e.type)&&e.routeSide===side),guard=guards[0];
  const cache=g.entities.find(e=>!e.done&&e.type==='treasure'&&e.adventureId===fork.id&&e.routeSide===side);
  if(guard){steer(g,input,role==='risk'?guard.adventureRouteLane:guard.adventureRouteLane);if(role==='risk'&&!handled.has(guard.row)&&timeToImpact(g,guard.d)<=.31){if(guard.adventureStep!==skipStep)queueAction(input,guard.type==='log'?'jump':'duck');handled.add(guard.row);}}
  else if(cache)steer(g,input,cache.lane);
  else if(g.distance<fork.splitStart)steer(g,input,side<0?1:3);
  if(rush&&g.charge>=100&&!g.rush)queueAction(input,'rush');
  updateGame(g,input,1/hz);maxEntities=Math.max(maxEntities,g.entities.length);
  for(const e of g.effects)if(e.id>last){events.push({...e});last=e.id;}
  assert.notEqual(g.phase,'lost',`${seed}/${index} ${hz}Hz ${role} rush${rush}: ${g.reason} at${g.distance}`);
  if(g.distance>=fork.end)break;
 }
 return{g,fork,events,maxEntities};
}
test('both authored streams offer natural distinct challenges and physical conditional treasure across refresh rates and future Rush',()=>{
 let rides=0,clean=0,base=0,maxEntities=0;const themes=new Set(),sides=new Set();
 for(const seed of [1,12,137,29])for(const level of LEVELS)for(const hz of [30,60,120])for(const role of ['safe','risk'])for(const rush of [false,true]){
  const result=ride(seed,level.index,hz,role,{rush}),{g,fork,events}=result;rides++;themes.add(fork.theme);sides.add(fork.riskSide);maxEntities=Math.max(maxEntities,result.maxEntities);
  const receipt=events.find(e=>e.type==='treasure'&&e.routeRole===role);assert.ok(receipt,`missing${role} cache`);
  assert.equal(receipt.value,role==='safe'?200:receipt.clean?600:200);
  if(role==='risk'&&rush){assert.equal(receipt.clean,false);assert.equal(receipt.value,200);assert.ok(events.some(e=>e.type==='smash'),'future Rush never actually crossed a guard');}if(role==='risk'&&!rush){assert.equal(receipt.clean,true);assert.equal(receipt.clears,3);assert.equal(receipt.value,600);clean++;}else base++;
  assert.equal(g.shieldsUsed,0);assert.equal(events.filter(e=>e.type==='treasure').length,1,'adjacent stream prize collected');
  for(const receipt of events.filter(e=>e.type==='coin'||e.type==='treasure'))assert.ok(Math.abs(forkLaneCross(receipt.lane,receipt.distance,g.terrainProfile)-forkLaneCross(receipt.playerLane,receipt.distance,g.terrainProfile))<=.95+1e-8);
  for(const e of g.entities.filter(e=>e.adventureId===fork.id&&e.enemy)){const pose=entityPose(e,e.d);assert.ok(!islandContains(forkLaneCross(pose.lane,e.d,g.terrainProfile),e.d,g.terrainProfile));}
 }
 assert.ok(themes.size>=2);assert.deepEqual([...sides].sort(),[-1,1]);assert.ok(maxEntities<120);console.log(JSON.stringify({branchRides:rides,cleanCaches:clean,baseOrProtectedCaches:base,maxEntities,themes:[...themes]}));
});
test('dodging a single wildlife guard sacrifices the clean cache bonus while preserving its contacted base prize',()=>{
 let found=null;
 for(let seed=1;seed<100&&!found;seed++){const candidate=fixture(seed,0);if(candidate.fork.theme==='crocodile-run')found={seed,...candidate};}
 assert.ok(found);const {g,fork}=found,input=emptyInput(),side=fork.riskSide,handled=new Set(),events=[];let last=0;
 while(g.phase==='playing'&&g.distance<fork.end){
  const guards=g.entities.filter(e=>!e.done&&e.adventureId===fork.id&&e.routeSide===side&&['log','branch'].includes(e.type)),guard=guards[0],cache=g.entities.find(e=>!e.done&&e.type==='treasure'&&e.routeSide===side);
  if(guard){const lane=guard.adventureStep===1?([side<0?0:3,side<0?1:4].find(lane=>lane!==guard.adventureRouteLane)):guard.adventureRouteLane;steer(g,input,lane);if(guard.adventureStep!==1&&!handled.has(guard.row)&&timeToImpact(g,guard.d)<=.31){queueAction(input,guard.type==='log'?'jump':'duck');handled.add(guard.row);}}
  else if(cache)steer(g,input,cache.lane);else steer(g,input,side<0?1:3);
  updateGame(g,input,1/60);for(const e of g.effects)if(e.id>last){events.push(e);last=e.id;}assert.notEqual(g.phase,'lost');
 }
 const receipt=events.find(e=>e.type==='treasure');assert.ok(receipt);assert.equal(receipt.value,200);assert.equal(receipt.clean,false);assert.equal(receipt.clears,2);
});
test('island collision sweeps across land at 30/60/120Hz and protected contact rebounds on the entered side',()=>{
 for(const hz of [30,60,120])for(const protection of ['none','shield','rush','grace']){
  const {g,fork}=fixture(137,0);g.distance=(fork.splitStart+fork.splitEnd)/2;g.entities=[];g.nextRow=1e9;g.visualLane=g.lane=1;g.laneVelocity=0;g.shield=protection==='shield';g.rush=protection==='rush'?4:0;g.grace=protection==='grace'?4:0;
  const input=emptyInput();queueAction(input,'right');queueAction(input,'right');
  for(let n=0;n<hz/2&&g.phase==='playing';n++)updateGame(g,input,1/hz);
  const impact=g.effects.find(e=>e.obstacle==='island');assert.ok(impact,`${hz}Hz ${protection} did not contact land`);
  assert.equal(g.phase,protection==='none'?'lost':'playing');
  if(protection!=='none'){assert.equal(g.lane,1);assert.ok(g.visualLane<1.01);assert.ok(!islandContains(forkLaneCross(g.visualLane,g.distance,g.terrainProfile),g.distance,g.terrainProfile,ISLAND_RAFT_RADIUS));}
 }
});
test('physical fork pickups cannot use the widening logical lane radius or collect airborne treasure',()=>{
 for(const hz of [30,60,120])for(const kind of ['coin','treasure'])for(const airborne of [false,true]){
  const {g,fork}=fixture(137,0);g.distance=(fork.splitStart+fork.splitEnd)/2;g.nextRow=1e9;g.visualLane=g.lane=1.24;g.laneVelocity=0;
  const e={id:900,type:kind,lane:1,d:g.distance+.1,coinValue:20,treasureBase:200,treasureCleanBonus:400,requiredClears:3,routeSide:-1,adventureId:fork.id};g.entities=[e];if(airborne){g.action='jump';g.actionTime=.3;g.visualLane=g.lane=e.lane;}
  updateGame(g,emptyInput(),1/hz);assert.equal(e.collected,undefined);assert.equal(g.coins,0);assert.equal(g.bonus,0);
 }
});

test('land sweeps use exact fractional Rush travel and detect a momentum reversal between safe endpoints',()=>{
 for(const hz of [30,60,120]){
  const {g,fork}=fixture(137,0),dt=1/hz;g.distance=(fork.splitStart+fork.splitEnd)/2;g.entities=[];g.nextRow=1e9;g.visualLane=1;g.lane=4;g.laneVelocity=65;g.rush=.004;g.shield=false;
  const previous=g.distance,start=g.time;
  for(let n=0;n<20&&g.phase==='playing';n++)updateGame(g,emptyInput(),dt);
  assert.equal(g.phase,'lost');const receipt=g.effects.find(e=>e.obstacle==='island');assert.ok(receipt);
  const cross=forkLaneCross(g.visualLane,g.distance,g.terrainProfile),land=riverFork(g.distance,g.terrainProfile);
  assert.ok(Math.abs(Math.abs(cross-land.islandCenter)-land.islandHalfWidth-ISLAND_RAFT_RADIUS)<1e-4,'fatal land pose does not match actual contact edge');
  if(hz===30){const elapsed=g.time-start;assert.ok(elapsed<dt);assert.ok(elapsed>.004);assert.ok(Math.abs(g.distance-previous-g.speed*(Math.min(elapsed,.004)*1.32+Math.max(0,elapsed-.004)))<1e-6);}
 }
 // A deliberate high-momentum reversal has safe endpoints but sweeps land
 // between them. The impact must stop at that first boundary, not skip it.
 const {g,fork}=fixture(137,0);g.distance=(fork.splitStart+fork.splitEnd)/2;g.entities=[];g.nextRow=1e9;g.visualLane=g.lane=0;g.laneVelocity=175;g.shield=false;
 updateGame(g,emptyInput(),.05);assert.equal(g.phase,'lost');assert.ok(g.effects.some(e=>e.obstacle==='island'));assert.ok(g.time<260.05);
});

test('an actual rescued island impact forfeits clean treasure even after three later unprotected clears',()=>{
 const {g,fork}=fixture(137,0),input=emptyInput(),side=fork.riskSide;
 g.distance=fork.start+9;g.lane=g.visualLane=side<0?1:3;g.shield=true;g.entities=[];g.nextRow=fork.start;g.adventures=[];generateAhead(g);
 steer(g,input,side<0?3:1);
 while(g.phase==='playing'&&g.shieldsUsed===0)updateGame(g,input,1/120);
 assert.equal(g.shieldsUsed,1);assert.equal(g.phase,'playing');assert.ok(g.effects.some(e=>e.obstacle==='island'));
 const handled=new Set(),events=[];let last=0;
 while(g.phase==='playing'&&g.distance<fork.end){
  const guard=g.entities.find(e=>!e.done&&e.adventureId===fork.id&&e.routeSide===side&&['log','branch'].includes(e.type)),cache=g.entities.find(e=>!e.done&&e.type==='treasure'&&e.routeSide===side);
  if(guard){steer(g,input,guard.adventureRouteLane);if(!handled.has(guard.row)&&timeToImpact(g,guard.d)<=.31){queueAction(input,guard.type==='log'?'jump':'duck');handled.add(guard.row);}}
  else if(cache)steer(g,input,cache.lane);
  updateGame(g,input,1/120);for(const e of g.effects)if(e.id>last){events.push(e);last=e.id;}assert.equal(g.phase,'playing');
 }
 const receipt=events.find(e=>e.type==='treasure');assert.ok(receipt);assert.equal(receipt.clears,3);assert.equal(receipt.clean,false);assert.equal(receipt.value,200);
});

test('complete richer-stream maps rejoin ordinary five-lane routes and finish unshielded with strictly contacted rewards',()=>{
 let stages=0,caches=0,clean=0,maxEntities=0;
 for(const hz of [30,60,120])for(const level of LEVELS)for(const seed of [1,137])for(const useRush of [false,true]){
  const g=createGame(seed,level.index),input=emptyInput(),handled=new Set();g.shield=false;let last=0;
  while(g.phase==='playing'){
   const fork=nextRiverFork(g.distance,g.terrainProfile);
   if(fork&&g.distance>=fork.start-g.speed*.18&&g.distance<fork.splitStart)steer(g,input,fork.riskSide<0?1:3);
   const selected=e=>!e.done&&(e.type==='treasure'?e.routeRole==='risk':e.type==='coin'&&(e.adventureId!==undefined?e.routeRole==='risk':e.primaryRoute!==false));
   const next=g.entities.find(selected);
   if(next&&timeToImpact(g,next.d)<.24)steer(g,input,next.lane);
   const obstacles=g.entities.filter(e=>!e.done&&['rock','log','branch'].includes(e.type)),first=obstacles[0];
   if(first&&!handled.has(first.row)&&timeToImpact(g,first.d)<=.31){
    const row=obstacles.filter(e=>e.row===first.row),lane=next?.lane??g.lane,contact=row.find(e=>hazardTouchesLane(e,lane));
    if(contact&&contact.type!=='rock')queueAction(input,contact.type==='log'?'jump':'duck');handled.add(first.row);
   }
   if(useRush&&g.charge>=100&&!g.rush)queueAction(input,'rush');
   const pending=g.entities.filter(selected);updateGame(g,input,1/hz);
   assert.notEqual(g.phase,'lost',`${hz}Hz ${level.id}/${seed} richer stream Rush${useRush}: ${g.reason}`);assert.equal(g.shieldsUsed,0);
   for(const e of pending)if(e.done)assert.ok(e.collected,`${level.id}/${seed} richer route missed ${e.type} lane${e.lane} at${e.d}`);
   for(const e of g.effects)if(e.id>last){last=e.id;if(e.type==='treasure'){caches++;if(e.clean&&e.routeRole==='risk')clean++;assert.equal(e.routeRole,'risk');}}
   maxEntities=Math.max(maxEntities,g.entities.length);
  }
  assert.equal(g.phase,'won');assert.equal(g.distance,level.length);stages++;
 }
 assert.ok(caches>=stages*2);assert.ok(clean>20);assert.ok(maxEntities<120);console.log(JSON.stringify({completeRicherStreamStages:stages,physicallyContactedCaches:caches,cleanRicherCaches:clean,maxEntities}));
});

test('a shallow reversal contacts land at its analytic extremum even when every uniform sweep sample is clear',()=>{
 const {g,fork}=fixture(137,0),dt=.05,turning=1/36;
 g.distance=(fork.splitStart+fork.splitEnd)/2;g.visualLane=g.lane=0;g.entities=[];g.nextRow=1e9;
 const start=g.distance,speed=speedAt(g.time+dt),at=(velocity,time)=>{
  const d=start+speed*time,lane=laneSpring(0,velocity,0,time).position,cross=forkLaneCross(lane,d,g.terrainProfile);
  return{cross,inside:islandContains(cross,d,g.terrainProfile,ISLAND_RAFT_RADIUS)};
 };
 let clear=0,touching=200;
 for(let n=0;n<60;n++){const velocity=(clear+touching)/2;if(at(velocity,turning).inside)touching=velocity;else clear=velocity;}
 g.laneVelocity=touching+1e-7;
 assert.equal(at(g.laneVelocity,0).inside,false);assert.equal(at(g.laneVelocity,dt).inside,false);assert.equal(at(g.laneVelocity,turning).inside,true);
 const uniformCount=Math.max(8,Math.min(96,Math.ceil(Math.abs(at(g.laneVelocity,dt).cross-at(g.laneVelocity,0).cross)/.22)+8));
 for(let n=1;n<=uniformCount;n++)assert.equal(at(g.laneVelocity,dt*n/uniformCount).inside,false,'fixture no longer isolates a between-sample grazing contact');
 updateGame(g,emptyInput(),dt);assert.equal(g.phase,'lost');assert.ok(g.effects.some(e=>e.obstacle==='island'));assert.ok(g.time<260+turning);
});

test('co-located guard and coin keep numeric creation order across decimal ID boundaries',()=>{
 for(const hz of [30,60,120])for(const guardId of [9,99]){
  const g=createGame(1);Object.assign(g,{entities:[{id:guardId,type:'branch',lane:2,d:.1},{id:guardId+1,type:'coin',lane:2,d:.1}],nextRow:1e9,shield:false,action:'duck',actionTime:.2,streak:7,lastCoin:0,multiplier:1,goal:{kind:'coins',start:0,target:1e9}});
  updateGame(g,emptyInput(),1/hz);assert.equal(g.phase,'playing');assert.equal(g.bonus,120);assert.equal(g.multiplier,2);
  const contacts=g.effects.filter(e=>e.type==='perfect'||e.type==='coin');assert.deepEqual(contacts.map(e=>e.type),['perfect','coin']);assert.equal(contacts[0].entityId,guardId);assert.equal(contacts[1].entityId,guardId+1);
 }
});
