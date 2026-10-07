import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,queueAction,applyAction,updateGame,generateAhead,jumpHeight,speedAt,validBest,JUMP_SECONDS,nextLevel,restartLevel,snapshot} from '../src/game/engine.js';
import {LEVELS,FINISH_RUNWAY,levelSeed,validProgress,freshProgress,unlockLevel} from '../src/game/levels.js';
const clean=()=>Object.assign(createGame(1),{entities:[],nextRow:1e9,shield:false});
const hazard=(type,lane=1)=>({id:999,type,lane,d:1,done:false});
const advance=(g,seconds,input=emptyInput())=>{for(let t=0;t<seconds;t+=1/60)updateGame(g,input,Math.min(1/60,seconds-t));};
test('discrete input survives a short tap, clamps lanes and is consumed once',()=>{const g=clean(),i=emptyInput();queueAction(i,'left');updateGame(g,i,.016);assert.equal(g.lane,0);updateGame(g,i,.016);assert.equal(g.lane,0);applyAction(g,'left');assert.equal(g.lane,0);queueAction(i,'right');queueAction(i,'right');updateGame(g,i,.016);assert.equal(g.lane,2);assert.equal(i.actions.length,0);});
test('jump clears logs and earns trick score and charge; duck clears branches',()=>{for(const [type,action] of [['log','jump'],['branch','duck']]){const g=clean();g.entities=[hazard(type)];applyAction(g,action);g.actionTime=.3;updateGame(g,emptyInput(),.05);assert.equal(g.phase,'playing');assert.ok(g.charge>=12);assert.ok(g.bonus>=100);assert.equal(g[action==='jump'?'jumps':'ducks'],1);}});
test('wrong actions and boulders end unprotected runs with useful cause',()=>{for(const [type,action] of [['rock','jump'],['branch','jump'],['log','duck']]){const g=clean();g.entities=[hazard(type)];applyAction(g,action);g.actionTime=.3;updateGame(g,emptyInput(),.05);assert.equal(g.phase,'lost');assert.match(g.reason,/Switch lanes|Jump|Duck/);const d=g.distance;updateGame(g,emptyInput(),.05);assert.equal(g.distance,d);}});
test('shield grants one rescue, breaks streak and supplies grace',()=>{const g=clean();g.shield=true;g.streak=16;g.multiplier=3;g.entities=[hazard('rock'),{...hazard('log'),id:1000,d:1.5}];advance(g,.1);assert.equal(g.phase,'playing');assert.equal(g.shield,false);assert.equal(g.shieldsUsed,1);assert.equal(g.multiplier,1);assert.ok(g.grace>0);advance(g,1.2);g.entities=[{...hazard('rock'),d:g.distance+1}];advance(g,.1);assert.equal(g.phase,'lost');});
test('opposite action cancels immediately and same-action input buffers near landing',()=>{const g=clean();applyAction(g,'jump');advance(g,.2);assert.ok(jumpHeight(g)>.2);applyAction(g,'duck');assert.equal(g.action,'duck');applyAction(g,'jump');advance(g,JUMP_SECONDS-.1);applyAction(g,'jump');advance(g,.15);assert.equal(g.action,'jump');assert.ok(g.actionTime<.15);});
test('coins increase multiplier once and expire after a collection gap',()=>{const g=clean();g.entities=Array.from({length:16},(_,i)=>({id:i,type:'coin',lane:1,d:(i+1)*.1,done:false}));advance(g,.12);assert.equal(g.coins,16);assert.equal(g.multiplier,3);assert.equal(g.charge,32);advance(g,3);assert.equal(g.multiplier,1);assert.equal(g.streak,0);});
test('magnet crosses lanes for eight seconds, high coins require jumping normally',()=>{const g=clean();g.entities=[{id:0,type:'magnet',lane:1,d:.2},{id:1,type:'coin',lane:0,d:.5},{id:2,type:'coin',lane:2,d:1,high:true}];advance(g,.1);assert.equal(g.coins,2);assert.ok(g.magnet>7.8);advance(g,8);g.entities=[{id:3,type:'coin',lane:0,d:g.distance+1},{id:4,type:'coin',lane:1,d:g.distance+1,high:true}];advance(g,.1);assert.equal(g.coins,2);});
test('Rush spends once, speeds up and clears every hazard before expiring',()=>{const g=clean(),i=emptyInput();g.charge=100;queueAction(i,'rush');queueAction(i,'rush');g.entities=[hazard('rock')];updateGame(g,i,.05);assert.equal(g.charge,0);assert.equal(g.phase,'playing');assert.ok(g.speed>speedAt(g.time));assert.ok(g.rush>3.9);advance(g,4.1);assert.equal(g.rush,0);assert.equal(g.speed,speedAt(g.time));});
test('seeded finite maps vary routes, stop hazards before the finish and use increasing speed profiles',()=>{
 for(let seed=0;seed<100;seed++)for(const level of LEVELS){
  const g=createGame(seed,level.index);
  assert.equal(g.seed,levelSeed(seed,level.index));
  assert.deepEqual(g.entities,createGame(seed,level.index).entities);
  // Inspect every seeded row, not only the first visible section.
  for(let d=0;d<level.length;d+=120){g.distance=d;g.time=d/level.startSpeed;generateAhead(g);}
  const rows=new Map();
  for(const e of g.entities.filter(e=>['rock','log','branch'].includes(e.type))){
   assert.ok(e.d<level.length-FINISH_RUNWAY,'finish runway contains an obstacle');
   if(!rows.has(e.row))rows.set(e.row,[]);rows.get(e.row).push(e);
  }
  for(const row of rows.values())assert.ok(new Set(row.map(e=>e.lane)).size<=2||row.every(e=>e.type==='log')||row.every(e=>e.type==='branch'));
  assert.equal(new Set(g.patternsSeen.filter(p=>p!=='tutorial')).size,6);
  assert.ok(g.entities.every(e=>e.d<level.length),'entities continue after the finish');
  const count=g.entities.length;g.distance=level.length+100;generateAhead(g);assert.equal(g.entities.length,count);
  assert.equal(speedAt(0,level.index),level.startSpeed);assert.equal(speedAt(99999,level.index),level.maxSpeed);
 }
 assert.equal(speedAt(0),42);assert.equal(speedAt(99999),56);assert.equal(speedAt(99999,2),72);
 const tutorial=createGame(7).entities.filter(e=>e.row<3&&['log','branch','rock'].includes(e.type));
 assert.deepEqual(tutorial.map(e=>[e.type,e.lane]),[['log',1],['branch',1],['rock',1]]);
 assert.ok(Math.abs(tutorial[1].d-112.6758)<.0001);
});
test('finite-adventure best scores reject malformed records and every prior endless score',()=>{
 const good={version:3,score:2500,distance:1400,coins:12,levelsCleared:1};
 for(const x of [null,{}, {score:2000},{...good,version:2},{...good,score:Infinity},{...good,score:NaN},{...good,score:-1},{...good,score:1.5},{...good,distance:-1},{...good,coins:NaN},{...good,levelsCleared:4}])assert.equal(validBest(x),null);
 assert.deepEqual(validBest(good),good);
});

test('trick challenges pay once and rotate to an active coin goal',()=>{const g=clean();g.jumps=3;updateGame(g,emptyInput(),.016);assert.equal(g.goalsCleared,1);assert.equal(g.bonus,500);assert.equal(g.goal.kind,'coins');updateGame(g,emptyInput(),.016);assert.equal(g.bonus,500);g.coins=40;updateGame(g,emptyInput(),.016);assert.equal(g.goalsCleared,2);assert.equal(g.goal.kind,'distance');});
test('Rush never recharges from coins or avoided hazards',()=>{const g=clean();g.rush=3;g.entities=[{id:1,type:'coin',lane:0,d:.2},{id:2,type:'rock',lane:0,d:.4}];advance(g,.1);assert.equal(g.coins,1);assert.equal(g.charge,0);});

test('finish stops at the exact gate, pays once and carries each clear once through all three maps',()=>{
 let g=createGame(715);const totals={score:0,coins:0,distance:0,jumps:0,ducks:0,levelsCleared:0};
 for(const level of LEVELS){
  assert.equal(g.levelIndex,level.index);assert.equal(g.campaignSeed,715);
  Object.assign(g,{entities:[],nextRow:1e9,distance:level.length-.5,coins:10+level.index,jumps:3,ducks:4,bonus:210,goal:{kind:'tricks',start:0,target:1e9}});
  updateGame(g,emptyInput(),.05);
  assert.equal(g.phase,'won');assert.equal(g.distance,level.length);
  assert.equal(g.bonus,210+1000*(level.index+1));
  const s=snapshot(g);assert.equal(s.level.remaining,0);assert.equal(s.level.progress,1);assert.equal(s.level.final,level.index===2);
  for(const key of ['score','coins','distance','jumps','ducks'])totals[key]+=g[key];totals.levelsCleared++;
  assert.deepEqual(s.campaign,totals);
  const frozen=JSON.stringify(g);queueAction(emptyInput(),'jump');updateGame(g,emptyInput(),.05);applyAction(g,'right');assert.equal(JSON.stringify(g),frozen);
  const next=nextLevel(g);
  if(level.index<2){assert.deepEqual(next.carry,totals);assert.equal(next.score,0);assert.equal(next.coins,0);assert.equal(next.distance,0);g=next;}
  else assert.equal(next,null);
 }
 assert.equal(totals.distance,5400);assert.equal(totals.levelsCleared,3);
});

test('a wipeout cannot be promoted to victory in the finish frame, and retry preserves only prior clears',()=>{
 const carry={score:7800,coins:70,distance:1400,jumps:5,ducks:4,levelsCleared:1};
 const g=createGame(987,1,carry),length=LEVELS[1].length;
 assert.equal(nextLevel(g),null);
 Object.assign(g,{entities:[{id:912,type:'rock',lane:1,d:length-.1}],nextRow:1e9,distance:length-.5,shield:false,coins:99,bonus:900});
 updateGame(g,emptyInput(),.05);
 assert.equal(g.phase,'lost');assert.equal(g.bonus,900);assert.equal(snapshot(g).campaign.levelsCleared,1);assert.equal(nextLevel(g),null);
 const retry=restartLevel(g);
 assert.equal(retry.levelIndex,1);assert.equal(retry.campaignSeed,987);assert.deepEqual(retry.carry,carry);
 assert.equal(retry.phase,'playing');assert.equal(retry.distance,0);assert.equal(retry.score,0);assert.equal(retry.coins,0);assert.equal(retry.shield,true);
 assert.deepEqual(snapshot(retry).campaign,carry);assert.deepEqual(retry.entities,createGame(987,1,carry).entities);
 assert.deepEqual(carry,{score:7800,coins:70,distance:1400,jumps:5,ducks:4,levelsCleared:1});
});

test('malformed saved map progress resets safely while repeated clears preserve unlocks',()=>{
 for(const value of [null,{},[],{version:2,unlocked:2,completed:true},{version:1,unlocked:'2',completed:true},{version:1,unlocked:3,completed:true},{version:1,unlocked:-1,completed:false},{version:1,unlocked:1.5,completed:false},{version:1,unlocked:NaN,completed:false},{version:1,unlocked:2,completed:'false'},{version:1,unlocked:0,completed:true},{version:1,unlocked:1,completed:true}]){
  assert.equal(validProgress(value),null);
 }
 let progress=freshProgress();
 assert.deepEqual(progress,{version:1,unlocked:0,completed:false});
 progress=unlockLevel(progress,0);assert.deepEqual(progress,{version:1,unlocked:1,completed:false});
 assert.deepEqual(unlockLevel(progress,0),progress);
 progress=unlockLevel(progress,1);assert.deepEqual(progress,{version:1,unlocked:2,completed:false});
 progress=unlockLevel(progress,2);assert.deepEqual(progress,{version:1,unlocked:2,completed:true});
 assert.deepEqual(validProgress(JSON.parse(JSON.stringify(progress))),progress);
 assert.deepEqual(unlockLevel(progress,0),progress);assert.deepEqual(unlockLevel(progress,1),progress);
});
