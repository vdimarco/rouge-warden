import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,queueAction,updateGame,speedAt,JUMP_SECONDS,DUCK_SECONDS,HAZARD_LANE_RADIUS} from '../src/game/engine.js';
import {laneSpring} from '../src/game/world.js';

// Isolated constant-speed crossings; controls still pass through the normal
// input queue. These fixtures separate physical contact from frame cadence.
function crossing(hz,items,options={}){
 const {steer='',until=Math.max(...items.map(e=>e.at))+.002,...state}=options;
 const g=Object.assign(createGame(73,1),{entities:[],nextRow:1e9,time:1000,shield:false,goal:{kind:'tricks',start:0,target:1e9}},state);
 const speed=speedAt(g.time,g.levelIndex)*(g.rush?1.32:1),input=emptyInput();
 g.entities=items.map((item,index)=>({id:900+index,done:false,...item,d:speed*item.at}));
 if(steer)queueAction(input,steer);
 const start=g.eventId;
 for(let elapsed=0;elapsed<until;elapsed+=1/hz)updateGame(g,input,1/hz);
 return{g,events:g.effects.filter(e=>e.id>start&&['hit','lose','smash','perfect'].includes(e.type))};
}

test('a late swipe toward a neighboring rock cannot hit a raft still beside it',()=>{
 for(const hz of [30,60,120])for(const shield of [false,true]){
  const {g,events}=crossing(hz,[{type:'rock',lane:2,at:.005}],{steer:'right',shield});
  assert.equal(g.phase,'playing');assert.equal(g.shield,shield);assert.equal(g.shieldsUsed,0);assert.equal(events.length,0);
  assert.equal(g.lane,2);assert.ok(g.visualLane<1.4);
 }
});

test('selecting a safe target does not grant immunity while the raft still touches a rock',()=>{
 for(const hz of [30,60,120])for(const shield of [false,true]){
  const {g,events}=crossing(hz,[{type:'rock',lane:1,at:.005}],{steer:'right',shield});
  assert.equal(g.phase,shield?'playing':'lost');assert.equal(g.shieldsUsed,shield?1:0);assert.equal(events.length,1);
  const hit=events[0];assert.equal(hit.type,shield?'hit':'lose');assert.equal(hit.obstacleLane,1);assert.equal(hit.entityId,900);
  assert.ok(Math.abs(hit.playerLane-laneSpring(1,0,2,.005).position)<1e-10);
  assert.ok(Math.abs(hit.contactTime-1000.005)<1e-10);assert.ok(Math.abs(hit.playerLane-1)*3.8<.06);
  if(!shield){assert.equal(g.visualLane,hit.playerLane);assert.equal(g.distance,hit.distance);assert.equal(g.time,hit.contactTime);assert.equal(hit.time,g.time);}
 }
});

test('a completed carve and a reversal clear or hit according to visible crossing position',()=>{
 for(const hz of [30,60,120]){
  const cleared=crossing(hz,[{type:'rock',lane:1,at:.1}],{steer:'right'});
  assert.equal(cleared.g.phase,'playing');assert.equal(cleared.events.length,0);
  const returnPosition=laneSpring(1,0,2,.09);
  const touched=crossing(hz,[{type:'rock',lane:2,at:.005}],{lane:1,visualLane:returnPosition.position,laneVelocity:returnPosition.velocity});
  assert.equal(touched.g.phase,'lost');assert.equal(touched.events[0].obstacleLane,2);
  assert.ok(Math.abs(touched.events[0].playerLane-2)<=HAZARD_LANE_RADIUS);
 }
});

test('full-width action waves have no gaps between lanes and award one trick per row',()=>{
 for(const hz of [30,60,120])for(const visualLane of [.5,1.5])for(const [type,action] of [['log','jump'],['branch','duck']]){
  const items=[0,1,2].map(lane=>({type,lane,at:.005,row:17})),position={lane:visualLane<1?0:2,visualLane};
  const miss=crossing(hz,items,position);assert.equal(miss.g.phase,'lost','the gap between adjacent wave parts bypassed the action');
  const clear=crossing(hz,items,{...position,action,actionTime:.2});
  assert.equal(clear.g.phase,'playing');assert.equal(clear.g[action==='jump'?'jumps':'ducks'],1);
  assert.equal(clear.g.bonus,100);assert.equal(clear.events.filter(e=>e.type==='perfect').length,1);
 }
});

test('jump and duck outcomes use the action at contact, including expiry and queued relaunch',()=>{
 for(const hz of [30,60,120]){
  const duck=crossing(hz,[{type:'branch',lane:1,at:.003}],{action:'duck',actionTime:DUCK_SECONDS-.006});
  assert.equal(duck.g.phase,'playing');assert.equal(duck.g.ducks,1);assert.equal(duck.events[0].action,'duck');
  assert.ok(duck.events[0].actionTime<DUCK_SECONDS);
  const late=crossing(hz,[{type:'log',lane:1,at:.006}],{action:'jump',actionTime:JUMP_SECONDS-.01,buffered:'jump',bufferTime:.2});
  assert.equal(late.g.phase,'lost','a future buffered launch cleared an earlier contact');
  const relaunch=crossing(hz,[{type:'log',lane:1,at:.015}],{action:'jump',actionTime:JUMP_SECONDS-.01,buffered:'jump',bufferTime:.2});
  assert.equal(relaunch.g.phase,'playing');assert.equal(relaunch.g.jumps,1);
  assert.equal(relaunch.events[0].action,'jump');assert.ok(relaunch.events[0].actionTime<.06);
  const launch=crossing(hz,[{type:'log',lane:1,at:.005}],{action:'jump'});
  assert.equal(launch.g.phase,'playing');assert.equal(launch.g.jumps,1);
 }
});

test('Rush and grace protect their exact crossing, with no powered trick or dodge recharge',()=>{
 for(const hz of [30,60,120])for(const power of ['rush','grace']){
  const early=crossing(hz,[{type:'rock',lane:1,at:.005}],{[power]:.01});
  assert.equal(early.g.phase,'playing');assert.equal(early.events[0].type,'smash');
  const expired=crossing(hz,[{type:'rock',lane:1,at:.02}],{[power]:.01});
  assert.equal(expired.g.phase,'lost');assert.equal(expired.events[0].type,'lose');
 }
 for(const hz of [30,60,120]){
  const action=crossing(hz,[{type:'log',lane:1,at:.005}],{rush:.01,action:'jump',actionTime:.3});
  assert.equal(action.g.phase,'playing');assert.equal(action.g.jumps,0);assert.equal(action.g.bonus,0);assert.equal(action.g.charge,0);
  const dodge=crossing(hz,[{type:'rock',lane:0,at:.005}],{rush:.01});assert.equal(dodge.g.charge,0);
 }
});

test('a shield breaks once and starts exact contact-time grace for subsequent hazards',()=>{
 for(const hz of [30,60,120]){
  const {g,events}=crossing(hz,[{type:'rock',lane:1,at:.003},{type:'rock',lane:1,at:.009}],{shield:true,until:.012});
  assert.equal(g.phase,'playing');assert.equal(g.shield,false);assert.equal(g.shieldsUsed,1);
  assert.deepEqual(events.map(e=>e.type),['hit','smash']);
  assert.ok(Math.abs(g.grace-(1.1+.003-(g.time-1000)))<1e-10);
 }
});

test('rocks remain dodge-only during visibly airborne contact',()=>{
 for(const hz of [30,60,120]){
  const {g,events}=crossing(hz,[{type:'rock',lane:1,at:.005}],{action:'jump',actionTime:.325});
  assert.equal(g.phase,'lost');assert.equal(events[0].obstacle,'rock');assert.ok(events[0].playerHeight>.99);
 }
});

test('a 50 ms wipeout frame freezes at contact and keeps only rewards already crossed',()=>{
 const g=Object.assign(createGame(73,1),{entities:[],nextRow:1e9,time:1000,shield:false,action:'duck',actionTime:DUCK_SECONDS-.02,goal:{kind:'tricks',start:0,target:1e9}});
 const speed=speedAt(g.time,1),input=emptyInput();queueAction(input,'right');
 g.entities=[{id:990,type:'coin',lane:1,d:speed*.002},{id:991,type:'rock',lane:1,d:speed*.005},{id:992,type:'coin',lane:1,d:speed*.009}];
 updateGame(g,input,.05);
 const loss=g.effects.find(e=>e.type==='lose'),coins=g.effects.filter(e=>e.type==='coin');
 assert.equal(g.phase,'lost');assert.equal(g.time,1000.005);assert.equal(g.distance,speed*.005);
 assert.equal(g.visualLane,loss.playerLane);assert.ok(Math.abs(g.visualLane-laneSpring(1,0,2,.005).position)<1e-10);
 assert.equal(g.action,'duck');assert.ok(Math.abs(g.actionTime-(DUCK_SECONDS-.015))<1e-10);
 assert.equal(g.coins,1);assert.equal(coins.length,1);assert.equal(coins[0].time,1000.002);assert.equal(g.lastCoin,1000.002);
 assert.ok(g.effects.every(e=>e.time<=g.time),'an effect from after fatal contact survived');assert.notEqual(g.entities[2].done,true);
 const frozen=JSON.stringify(g);updateGame(g,emptyInput(),.05);assert.equal(JSON.stringify(g),frozen);
});
