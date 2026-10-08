import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,queueAction,updateGame,timeToImpact,coinTouchesAtHeight,COIN_LANE_RADIUS,hazardTouchesLane} from '../src/game/engine.js';
import {LEVELS} from '../src/game/levels.js';
import {laneSpring} from '../src/game/world.js';
import {coinJumpHeight,jumpArcHeight,JUMP_REWARD_OFFSETS} from '../src/game/jump-rewards.js';
import {coveredLanes,actionWall,formation} from './route-coverage.js';
const hazard=e=>['log','branch','rock'].includes(e.type);
function naturalCourse(seed,index){
 const g=createGame(seed,index),items=new Map(),arrival=new Map();
 while(g.phase==='playing'){
  for(const e of g.entities){items.set(e.id,{...e});if(hazard(e)&&!arrival.has(e.row))arrival.set(e.row,g.time+timeToImpact(g,e.d));}
  // Reveal generation with its real simulation clock/acceleration; this
  // trace does not claim playability (the delayed-input campaigns check it).
  g.entities=[];updateGame(g,emptyInput(),.05);
 }
 const rows=new Map();for(const e of items.values())if(hazard(e)){if(!rows.has(e.row))rows.set(e.row,[]);rows.get(e.row).push(e);}
 return{g,items:[...items.values()],rows:[...rows.values()],arrival};
}

test('required jumps and ducks arrive just after tutorials, action droughts are bounded and formations vary',()=>{
 let required=0,holds=0,earlyJumps=0,earlyDucks=0;const intervals=new Set(),seedRoutes=new Set();
 for(let seed=1;seed<=35;seed++)for(const level of LEVELS){
  const {rows,arrival}=naturalCourse(seed,level.index);
  assert.deepEqual(rows.slice(0,3).map(row=>row.map(e=>e.type)),[['log'],['branch'],['rock']]);
  const firstJump=rows.find(row=>actionWall(row)&&row[0].type==='log'),firstDuck=rows.find(row=>actionWall(row)&&row[0].type==='branch');
  assert.equal(firstJump[0].row,3);assert.ok(firstJump[0].d<500);assert.ok(firstDuck[0].row<=5);assert.ok(firstDuck[0].d<650);
  earlyJumps++;earlyDucks++;
  let drought=0,lastFormation='',run=0;
  const clearLanes=[];
  for(let i=3;i<rows.length;i++){
   const row=rows[i],kind=formation(row);run=kind===lastFormation?run+1:1;lastFormation=kind;
   assert.ok(run<=3,`${level.id} seed${seed} repeats ${kind} for ${run} rows`);
   if(actionWall(row)){required++;drought=0;assert.ok(row.every(e=>e.type===row[0].type&&e.type!=='rock'));}
   else{drought++;assert.ok(drought<=3,`${level.id} seed${seed} has ${drought} dodge-only beats`);}
   const safe=[0,1,2].find(lane=>!row.some(e=>hazardTouchesLane(e,lane)));
   if(safe!==undefined){if(clearLanes.at(-1)===safe)holds++;clearLanes.push(safe);}
   if(i+1<rows.length){const interval=arrival.get(rows[i+1][0].row)-arrival.get(row[0].row);assert.ok(interval>=level.minInterval-.015);intervals.add(Math.round(interval*100));}
  }
  seedRoutes.add(rows.slice(3,18).map(row=>`${formation(row)}:${coveredLanes(row).join('')}`).join('|'));
 }
 assert.ok(holds>100,'every clear lane turns back at the next gate');assert.ok(seedRoutes.size>95,'seeds repeat a small set of routes');assert.ok(intervals.size>25,'obstacles repeat one metronomic interval');
 console.log(JSON.stringify({naturalSeedMaps:105,earlyRequiredJumps:earlyJumps,earlyRequiredDucks:earlyDucks,mandatoryActionRows:required,safeLaneHolds:holds,distinctIntervals:intervals.size,distinctOpeningRoutes:seedRoutes.size}));
});

test('dodging-only players cannot camp through the first third of any map',()=>{
 for(const hz of [30,60,120])for(let seed=1;seed<=12;seed++)for(const level of LEVELS){
  const g=createGame(seed,level.index),input=emptyInput();g.shield=false;
  while(g.phase==='playing'&&g.distance<level.length/3){
   const obstacles=g.entities.filter(e=>!e.done&&hazard(e)),next=obstacles.find(e=>hazardTouchesLane(e,g.lane));
   if(next&&timeToImpact(g,next.d)<.6){const row=obstacles.filter(e=>e.row===next.row),safe=[0,1,2].find(lane=>!row.some(e=>hazardTouchesLane(e,lane)));if(safe!==undefined)for(let n=0;n<Math.abs(safe-g.lane);n++)queueAction(input,safe>g.lane?'right':'left');}
   updateGame(g,input,1/hz);
  }
  assert.equal(g.phase,'lost');assert.match(g.reason,/Log hit/);assert.ok(g.distance<500);assert.equal(g.jumps,0);
 }
});

function firstRequiredArc(seed,index,hz,lead){
 const g=createGame(seed,index),input=emptyInput();g.shield=false;
 const handled=new Set();let row=null,coins=null,appliedLead=null;
 for(let frame=0;frame<15*hz&&g.phase==='playing';frame++){
  const obstacles=g.entities.filter(e=>!e.done&&hazard(e)),next=obstacles[0];
  if(next){
   const group=obstacles.filter(e=>e.row===next.row),gold=g.entities.filter(e=>e.type==='coin'&&e.row===next.row);
   const marked=gold.find(e=>Number.isFinite(e.jumpHeight));
   const lane=marked?.lane??gold[0]?.lane??[0,1,2].find(l=>!group.some(e=>hazardTouchesLane(e,l)))??g.lane;
   if(timeToImpact(g,next.d)<.85&&g.lane!==lane)for(let n=0;n<Math.abs(lane-g.lane);n++)queueAction(input,lane>g.lane?'right':'left');
   const contact=group.find(e=>hazardTouchesLane(e,lane));
   if(next.row===3&&row===null){row={...next};coins=gold.filter(e=>Number.isFinite(e.jumpHeight));assert.equal(coins.length,5);}
   if(contact&&contact.type!=='rock'&&!handled.has(next.row)&&timeToImpact(g,next.d)<=lead){
    if(next.row===3)appliedLead=timeToImpact(g,next.d);
    queueAction(input,contact.type==='log'?'jump':'duck');handled.add(next.row);
   }
   if(contact?.type==='rock'&&timeToImpact(g,next.d)<.6){const safe=[0,1,2].find(l=>!group.some(e=>hazardTouchesLane(e,l)));if(safe!==undefined&&g.lane!==safe)for(let n=0;n<Math.abs(safe-g.lane);n++)queueAction(input,safe>g.lane?'right':'left');}
  }
  updateGame(g,input,1/hz);
  if(row&&g.distance>coins.at(-1).d){
   assert.equal(g.phase,'playing',`${hz}Hz map${index} seed${seed} lead${lead}: ${g.reason}`);
   const actual=g.entities.filter(e=>coins.some(c=>c.id===e.id));
   assert.equal(actual.length,5);assert.ok(actual.every(e=>e.collected),`${hz}Hz map${index} seed${seed} requestedlead${lead}, applied${appliedLead}: ${JSON.stringify(actual.map(e=>({offset:e.jumpOffset,height:e.jumpHeight,collected:!!e.collected})))}`);
   assert.ok(g.jumps>=1);return appliedLead;
  }
 }
 assert.fail(`first arc did not complete: ${g.reason}`);
}

test('one natural jump collects its whole five-coin arc at early, normal and late human leads at 30/60/120 Hz',()=>{
 let arcs=0,minLead=1,maxLead=0;
 for(const hz of [30,60,120])for(const lead of [.22,.32,.42])for(let seed=1;seed<=18;seed++)for(const level of LEVELS){const applied=firstRequiredArc(seed,level.index,hz,lead);minLead=Math.min(minLead,applied);maxLead=Math.max(maxLead,applied);arcs++;}
 console.log(JSON.stringify({naturalJumpArcs:arcs,raisedCoinsCollected:arcs*5,requestedLeadSeconds:[.22,.32,.42],actualLeadSeconds:[minLead,maxLead],refreshRates:[30,60,120]}));
});

test('generated jump gold stays wholly on one airborne hazard-lane route',()=>{
 let arcs=0;
 for(let seed=1;seed<=12;seed++)for(const level of LEVELS){
  const {rows,items}=naturalCourse(seed,level.index);
  for(const row of rows){
   const coins=items.filter(e=>e.type==='coin'&&e.row===row[0].row),raised=coins.filter(e=>Number.isFinite(e.jumpHeight));
   if(!raised.length)continue;arcs++;
   assert.equal(raised.length,5);assert.equal(coins.length,5,'low gold overlaps the displayed jump route');
   assert.deepEqual(raised.map(e=>e.jumpOffset),JUMP_REWARD_OFFSETS);
   assert.equal(new Set(coins.map(e=>e.lane)).size,1,'the shown reward trail changes lanes halfway through the jump');
   assert.ok(row.some(e=>e.type==='log'&&e.lane===raised[0].lane));
  }
 }
 assert.ok(arcs>400);
});

test('marked gold leaves a human lane-change window between successive rows, including Rush speed',()=>{
 let transitions=0,minWindow=Infinity;
 for(let seed=1;seed<=35;seed++)for(const level of LEVELS){
  const {rows,items}=naturalCourse(seed,level.index);
  for(let i=1;i<rows.length;i++){
   const previous=items.filter(e=>e.type==='coin'&&e.row===rows[i-1][0].row),next=items.filter(e=>e.type==='coin'&&e.row===rows[i][0].row);
   if(previous[0].lane===next[0].lane)continue;
   const window=(next[0].d-previous.at(-1).d)/(level.maxSpeed*1.32);
   minWindow=Math.min(minWindow,window);transitions++;
   assert.ok(window>=.18,`${level.id} seed${seed} rows${rows[i-1][0].row}→${rows[i][0].row} leave ${window}s to move between shown gold`);
  }
 }
 assert.ok(transitions>1000);console.log(JSON.stringify({laneTransitions:transitions,minLaneChangeWindowAtMaximumRushSpeed:minWindow}));
});

test('earned Rush never puts the next ground ribbon under a still-airborne late-jumping raft',()=>{
 let rushes=0,alignedGround=0,finishCoins=0,highestEntities=0;
 for(const hz of [30,60,120])for(const level of LEVELS)for(const lead of [.22,.42])for(const seed of [8,12,137]){
  const g=createGame(seed,level.index),input=emptyInput(),handled=new Set();g.shield=false;
  let holding=null;
  while(g.phase==='playing'){
   const obstacles=g.entities.filter(e=>!e.done&&hazard(e)),first=obstacles[0];
   if(first){
    const row=obstacles.filter(e=>e.row===first.row),coins=g.entities.filter(e=>e.type==='coin'&&e.row===first.row),lane=coins[0]?.lane??[0,1,2].find(l=>!row.some(e=>hazardTouchesLane(e,l)));
    const contact=row.find(e=>hazardTouchesLane(e,lane));
    if((!holding||g.distance>=holding.until)&&lane!==undefined&&g.lane!==lane)for(let n=0;n<Math.abs(lane-g.lane);n++)queueAction(input,lane>g.lane?'right':'left');
    if(contact&&contact.type!=='rock'&&!handled.has(first.row)&&timeToImpact(g,first.d)<=lead){queueAction(input,contact.type==='log'?'jump':'duck');handled.add(first.row);holding={until:Math.max(...coins.map(e=>e.d))};}
   }
   if(!first&&g.runwayGenerated&&(!holding||g.distance>=holding.until)&&g.lane!==1)queueAction(input,g.lane<1?'right':'left');
   if(g.charge>=100&&!g.rush){queueAction(input,'rush');rushes++;}
   const dt=1/hz,previous=g.distance,position=g.visualLane,velocity=g.laneVelocity;
   const coins=g.entities.filter(e=>!e.done&&e.type==='coin'&&!Number.isFinite(e.jumpHeight)&&e.d>previous&&e.d<=previous+level.maxSpeed*1.32*dt);
   updateGame(g,input,dt);highestEntities=Math.max(highestEntities,g.entities.length);
   assert.notEqual(g.phase,'lost',g.reason);
   for(const coin of coins)if(coin.done&&coin.d<=g.distance){
    if(coin.motif==='finish-runway'){finishCoins++;assert.ok(coin.collected,`${hz}Hz ${level.id} seed${seed} lead${lead} finish gold at${coin.d} arrived before landing`);}
    const elapsed=Math.max(0,Math.min(dt,(coin.d-previous)/g.speed)),lane=laneSpring(position,velocity,g.lane,elapsed).position;
    if(Math.abs(lane-coin.lane)<=COIN_LANE_RADIUS){alignedGround++;assert.ok(coin.collected,`${hz}Hz ${level.id} lead${lead} row${coin.row}: aligned ground gold passed beneath ${g.action} at ${g.actionTime}s, Rush ${g.rush}s`);}
   }
  }
  assert.equal(g.phase,'won');assert.equal(g.shieldsUsed,0);
 }
 assert.ok(rushes>100);assert.ok(alignedGround>10000);assert.equal(finishCoins,54*16);assert.ok(highestEntities<120);
 console.log(JSON.stringify({earnedRushCampaignStages:54,rushes,alignedGroundCoinsCollected:alignedGround,finishGoldCollected:finishCoins,maxLiveEntities:highestEntities}));
});

test('numeric arc gold still needs real lateral/vertical contact, while legacy launch-frame pickups remain valid',()=>{
 assert.equal(coinJumpHeight({jumpHeight:.9}),.9);assert.equal(coinJumpHeight({jumpHeight:NaN}),null);assert.equal(coinJumpHeight({high:true}),null);
 assert.equal(jumpArcHeight(0),0);assert.equal(jumpArcHeight(.33),1);assert.equal(jumpArcHeight(.66),0);
 assert.ok(coinTouchesAtHeight({jumpHeight:jumpArcHeight(.31),jumpOffset:0},'jump',.005));
 assert.equal(coinTouchesAtHeight({jumpHeight:jumpArcHeight(.31)},'',0),false);
 assert.equal(coinTouchesAtHeight({jumpHeight:jumpArcHeight(.31)},'jump',.65),false);
 for(const hz of [30,60,120])for(const lane of [1,1+COIN_LANE_RADIUS+.001]){
  const g=Object.assign(createGame(73),{entities:[{id:991,type:'coin',lane,d:.1,jumpHeight:jumpArcHeight(.31),jumpOffset:0}],nextRow:1e9,action:'jump',actionTime:.31});
  updateGame(g,emptyInput(),1/hz);assert.equal(g.coins,lane===1?1:0);
 }
});
