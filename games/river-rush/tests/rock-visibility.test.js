import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,updateGame,speedAt,VIEW_DISTANCE} from '../src/game/engine.js';
import {worldEntityVisible} from '../src/game/world.js';

function fixture(levelIndex,hz,entity,state={}){
 const g=Object.assign(createGame(73,levelIndex),{time:1000,entities:[],nextRow:1e9,shield:false,goal:{kind:'tricks',start:0,target:1e9}},state);
 const speed=speedAt(g.time,levelIndex)*(g.rush?1.32:1);
 const rock={id:900,type:'rock',lane:0,d:speed*.005,done:false,...entity};
 g.entities=[rock];updateGame(g,emptyInput(),1/hz);
 return {g,rock};
}
const shown=(entity,g)=>worldEntityVisible(entity,g.distance,VIEW_DISTANCE);

test('dodged rocks remain solid as they pass beside the raft on every map and frame cadence',()=>{
 for(const level of [0,1,2])for(const hz of [30,60,120]){
  const {g,rock}=fixture(level,hz,{});
  assert.equal(g.phase,'playing');assert.equal(g.dodges,1);assert.equal(rock.done,true);
  assert.ok(rock.d<g.distance,'the rock crossed the raft center');
  assert.equal(shown(rock,g),true,'scoring the dodge must not delete a visible rock');
  const input=emptyInput();
  while(g.distance-rock.d<15)updateGame(g,input,1/hz);
  if(g.entities.includes(rock))assert.equal(shown(rock,g),true,'a retained rock must still render behind the raft');
  while(g.entities.includes(rock))updateGame(g,input,1/hz);
  assert.ok(g.distance-rock.d>=16);assert.equal(shown(rock,g),false,'retire after the rock leaves the near view');
 }
});

test('shield and Rush destroy only the struck rock while adjacent resolved rocks continue past',()=>{
 for(const protection of [{shield:true},{rush:1}])for(const hz of [30,60,120]){
  const {g,rock}=fixture(1,hz,{lane:1},protection);
  assert.equal(g.phase,'playing');assert.equal(rock.done,true);assert.equal(shown(rock,g),false);
  assert.ok(g.effects.some(effect=>['hit','smash'].includes(effect.type)&&effect.entityId===rock.id));
  assert.equal(rock.destroyed,true);
  const neighbor={...rock,id:901,lane:0,destroyed:false};assert.equal(shown(neighbor,g),true);
 }
});

test('destroyed rocks cannot reappear when subsequent rewards evict the collision effect',()=>{
 for(const protection of [{shield:true},{rush:1}]){
  const g=Object.assign(createGame(73,1),{time:1000,nextRow:1e9,shield:false,goal:{kind:'tricks',start:0,target:1e9}},protection);
  const rock={id:900,type:'rock',lane:1,d:.1,done:false};
  g.entities=[rock,...Array.from({length:30},(_,i)=>({id:901+i,type:'coin',lane:1,d:.2+i*.02,done:false}))];
  updateGame(g,emptyInput(),1/60);
  assert.equal(g.phase,'playing');assert.equal(g.coins,30);assert.equal(g.effects.length,24);
  assert.equal(g.effects.some(effect=>effect.entityId===rock.id),false,'the collision effect was evicted');
  assert.equal(g.entities.includes(rock),true);assert.equal(rock.destroyed,true);assert.equal(shown(rock,g),false);
  g.effects=[];assert.equal(shown(rock,g),false,'transient effects cannot determine permanent destruction');
  const input=emptyInput();
  while(g.entities.includes(rock)){assert.equal(shown(rock,g),false);updateGame(g,input,1/120);}
  assert.ok(g.distance-rock.d>=16);
 }
});

test('the fatal rock remains in the contact frame and cannot disappear while results are frozen',()=>{
 for(const level of [0,1,2])for(const hz of [30,60,120]){
  const {g,rock}=fixture(level,hz,{lane:1});
  assert.equal(g.phase,'lost');assert.equal(g.distance,rock.d);assert.equal(rock.done,true);
  assert.equal(shown(rock,g),true);const contact=JSON.stringify(g);
  for(let i=0;i<120;i++)updateGame(g,emptyInput(),1/hz);
  assert.equal(JSON.stringify(g),contact);assert.equal(shown(rock,g),true);
 }
});

test('a successfully jumped log stays physical behind the raft without changing its score',()=>{
 for(const hz of [30,60,120]){
  const {g,rock:log}=fixture(1,hz,{type:'log',lane:1},{action:'jump',actionTime:.3});
  assert.equal(g.phase,'playing');assert.equal(g.jumps,1);assert.equal(g.bonus,100);assert.equal(log.done,true);
  assert.equal(shown(log,g),true);
 }
});

test('consumed pickups disappear while uncollected crossing coins remain visible briefly',()=>{
 const {g,rock:coin}=fixture(1,60,{type:'coin',lane:0});
 assert.equal(coin.done,true);assert.equal(coin.collected,undefined);assert.equal(g.coins,0);assert.equal(shown(coin,g),true);
 coin.collected=true;assert.equal(shown(coin,g),false);
 const {g:collected,rock:reward}=fixture(1,60,{type:'coin',lane:1});
 assert.equal(collected.coins,1);assert.equal(reward.collected,true);assert.equal(shown(reward,collected),false);
});
