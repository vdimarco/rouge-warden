import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,queueAction,updateGame,timeToImpact,hazardTouchesLane,snapshot} from '../src/game/engine.js';
import {LEVELS} from '../src/game/levels.js';
import {LANES} from '../src/game/lanes.js';
import {chooseGuardedRoute,linkDecisionExit} from '../src/game/risk-reward.js';
const hazard=e=>['log','branch','rock'].includes(e.type);
const steer=(g,input,lane)=>{for(let n=0;n<Math.abs(lane-g.lane);n++)queueAction(input,lane>g.lane?'right':'left');};

test('guarded coins double real points without increasing token, streak or charge advancement',()=>{
 for(const hz of [30,60,120])for(const boosted of [false,true])for(const streak of [0,7,15,31]){
  const receipts=[];
  for(const coinValue of [10,20]){
   const g=Object.assign(createGame(1),{entities:[{id:991,type:'coin',lane:2,d:.1,coinValue,decisionId:'fixture',routeRole:coinValue===20?'risk':'safe',riskAction:'duck'}],
    nextRow:1e9,streak,lastCoin:0,magnet:boosted?8:0,shield:false});
   updateGame(g,emptyInput(),1/hz);const receipt=g.effects.find(e=>e.type==='coin');assert.ok(receipt);
   assert.equal(g.coins,1);assert.equal(g.streak,streak+1);assert.equal(g.charge,2);
   assert.equal(receipt.coinValue,coinValue);assert.equal(receipt.decisionId,'fixture');assert.equal(receipt.routeRole,coinValue===20?'risk':'safe');
   assert.equal(receipt.value,coinValue*Math.min(5,1+Math.floor((streak+1)/8))*(boosted?2:1));receipts.push(receipt.value);
  }
  assert.equal(receipts[1],receipts[0]*2);
 }
 for(const lane of [1,2.251]){
  const g=Object.assign(createGame(1),{entities:[{id:991,type:'coin',lane,d:.1,coinValue:20}],nextRow:1e9,magnet:8,rush:4});
  updateGame(g,emptyInput(),1/30);assert.equal(g.coins,0,'premium gold or a boost changed lateral contact');
 }
});

test('the planner uses actual guard coverage and later deep choices have physical entry and return widths',()=>{
 const common={seed:3,row:10,previousLane:3,safe:3,coinLane:3,recovery:false,terrain:{type:'narrows',phase:'active'},lastDecisionRow:0,touches:hazardTouchesLane,
  hazards:[{type:'branch',lane:1,branchLanes:[0,1,2]}]};
 const early=chooseGuardedRoute({...common,levelIndex:0,intensity:.2}),late=chooseGuardedRoute({...common,levelIndex:2,intensity:.8});
 assert.equal(early.safeLane,3);assert.equal(early.riskLane,2);assert.equal(early.entryWidth,1);
 assert.equal(late.safeLane,3);assert.equal(late.riskLane,1);assert.equal(late.entryWidth,2);
 linkDecisionExit(late,{lane:4,d:100});assert.equal(late.exitLane,4);assert.equal(late.exitWidth,3);assert.equal(late.variant,'deep-cutback');
 assert.equal(chooseGuardedRoute({...common,levelIndex:2,intensity:.8,hazards:[{type:'branch',lane:1,branchLanes:[0,1,2],fullRiver:true}]}),null);
 assert.equal(chooseGuardedRoute({...common,levelIndex:2,intensity:.8,recovery:true}),null,'a quiet recovery acquired an unnecessary guard');
 assert.equal(chooseGuardedRoute({...common,levelIndex:2,intensity:.8,terrain:{type:'wave-train',phase:'active',comboAvailable:true}}),null);
});

function course(seed,index){
 const g=createGame(seed,index),items=new Map(),decisions=new Map();
 while(g.phase==='playing'){
  for(const e of g.entities)items.set(e.id,{...e});for(const p of g.decisions)decisions.set(p.id,{...p});
  g.entities=[];updateGame(g,emptyInput(),.05);
 }
 return {items:[...items.values()],decisions:[...decisions.values()]};
}

test('seeded decisions offer modest safe water versus guarded gold with honest next-station exits',()=>{
 let choices=0,deepEntries=0,deepExits=0;const actions=new Set(),enemies=new Set(),widths=[[],[]],entries=[[],[]],exits=[[],[]],perMap=[0,0,0],guardKinds={},variants={};
 for(let seed=1;seed<=12;seed++)for(const level of LEVELS){
  const {items,decisions}=course(seed,level.index);assert.ok(decisions.length>=3,`${level.id} seed${seed} lacks repeated choices`);
  const arcRows=[...new Set(items.filter(e=>e.type==='coin'&&Number.isFinite(e.jumpHeight)).map(e=>e.row))];
  let previousJump=null;
  for(const row of arcRows){
   const guard=items.find(e=>e.row===row&&e.type==='log');assert.ok(guard);
   if(previousJump!==null)assert.ok(guard.d-previousJump>=level.maxSpeed*1.32*.90-1e-6,'final replanning compressed two jump reward stations');
   previousJump=guard.d;
  }
  for(const p of decisions){
   const coins=items.filter(e=>e.decisionId===p.id&&e.type==='coin'),safe=coins.filter(e=>e.routeRole==='safe'),risk=coins.filter(e=>e.routeRole==='risk'),guards=items.filter(e=>e.row===p.row&&hazard(e));
   assert.equal(safe.length,3);assert.equal(risk.length,5);assert.equal(p.safeBasePoints,30);assert.equal(p.riskBasePoints,100);
   assert.ok(safe.every(e=>e.coinValue===10&&e.primaryRoute&&!guards.some(h=>hazardTouchesLane(h,e.lane))));
   assert.ok(risk.every(e=>e.coinValue===20&&!e.primaryRoute&&e.riskAction===p.action&&e.riskEnemy===p.enemy));
   const guard=guards.find(h=>hazardTouchesLane(h,p.riskLane));assert.ok(guard);assert.equal(guard.type,p.action==='jump'?'log':'branch');assert.equal(guard.enemy??null,p.enemy);
   assert.equal(new Set(risk.map(e=>e.lane)).size,1);assert.ok(Math.abs(p.safeLane-p.riskLane)>=1);
   assert.ok(risk.every(e=>p.action==='jump'?Number.isFinite(e.jumpHeight):!Number.isFinite(e.jumpHeight)));
   assert.ok(!guards.some(e=>e.fullRiver));assert.ok(p.row>=7);
   if(p.exitLane!==null){
    const exit=items.find(e=>e.type==='coin'&&e.primaryRoute&&e.row===p.row+1);assert.ok(exit);assert.equal(exit.lane,p.exitLane);assert.equal(exit.d,p.exitD);
    const window=(exit.d-Math.max(...risk.map(e=>e.d)))/(level.maxSpeed*1.32);
    assert.ok(window>=.24,`${level.id} ${p.id} has only${window}s to return to actual primary gold`);
   }
   actions.add(p.action);if(p.enemy)enemies.add(p.enemy);choices++;perMap[level.index]++;
   const kind=p.enemy??(p.action==='jump'?'log':'native branch');guardKinds[kind]=(guardKinds[kind]??0)+1;variants[p.variant]=(variants[p.variant]??0)+1;
   if(p.entryWidth>=2)deepEntries++;if(p.exitWidth>=2)deepExits++;
   const bucket=level.index===0&&p.d<level.length*.4?0:1;
   widths[bucket].push(Math.abs(p.riskLane-p.safeLane));entries[bucket].push(p.entryWidth);if(p.exitWidth!==undefined)exits[bucket].push(p.exitWidth);
  }
 }
 assert.deepEqual([...actions].sort(),['duck','jump']);assert.deepEqual([...enemies].sort(),['bird','crocodile','fish']);
 const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
 assert.ok(mean(widths[1])>mean(widths[0])+.2,'later routes label difficulty without changing the real lateral choice');
 assert.ok(deepEntries>100);assert.ok(deepExits>100);
 console.log(JSON.stringify({seededMaps:36,choices,perMap,guardKinds,variants,deepEntries,deepExits,earlyChoiceWidth:mean(widths[0]),laterChoiceWidth:mean(widths[1]),
  earlyEntryWidth:mean(entries[0]),laterEntryWidth:mean(entries[1]),earlyExitWidth:mean(exits[0]),laterExitWidth:mean(exits[1]),actions:[...actions],enemies:[...enemies]}));
});

function matchedStation(action,index=0){
 const g=createGame(1,index);
 while(g.phase==='playing'){
  const packet=g.decisions.find(p=>p.action===action&&g.entities.some(e=>e.decisionId===p.id&&hazard(e)));
  if(packet){
   const state=structuredClone(g);state.entities=state.entities.filter(e=>e.row===packet.row);state.nextRow=1e9;
   state.shield=false;state.bonus=0;state.coins=0;state.streak=0;state.multiplier=1;state.charge=0;state.effects=[];
   state.goal={kind:'coins',start:0,target:1e9};return {state,packet:{...packet}};
  }
  g.entities=[];updateGame(g,emptyInput(),.05);
 }
 assert.fail(`no natural${action} decision`);
}

function clearStation(fixture,route,{boost=false,protection=null,performAction=true}={}){
 const g=structuredClone(fixture.state),p=fixture.packet,input=emptyInput(),events=[],lane=route==='risk'?p.riskLane:p.safeLane;
 g.lane=g.visualLane=lane;g.laneVelocity=0;g.magnet=boost?100:0;g.shield=protection==='shield';g.rush=protection==='rush'?100:0;
 // A protected fixture is only used to check the absence of skill rewards;
 // its Rush deliberately changes arrival speed, so it does not claim all arc
 // coins are reachable on a pre-authored unboosted arc at the new start state.
 let acted=false,lastEvent=0;
 while(g.phase==='playing'&&g.distance<=p.endD+.01){
  if(route==='risk'&&performAction&&!acted&&timeToImpact(g,p.d)<=.31){queueAction(input,p.action);acted=true;}
  updateGame(g,input,1/60);for(const e of g.effects)if(e.id>lastEvent){events.push({...e});lastEvent=Math.max(lastEvent,e.id);}
 }
 return {g,events,coins:g.entities.filter(e=>e.type==='coin')};
}

test('matched natural jump and duck choices produce actual 30 versus 200 base payouts and protection cannot earn skill',()=>{
 let compared=0;
 for(const action of ['jump','duck'])for(const index of [0,1,2])for(const boost of [false,true]){
  const fixture=matchedStation(action,index),safe=clearStation(fixture,'safe',{boost}),risk=clearStation(fixture,'risk',{boost});
  assert.equal(safe.g.phase,'playing');assert.equal(risk.g.phase,'playing');assert.equal(safe.g.coins,3);assert.equal(risk.g.coins,5);
  assert.equal(safe.g.bonus,30*(boost?2:1));assert.equal(risk.g.bonus,100*(boost?2:1)+100);
  assert.equal(safe.events.filter(e=>e.type==='perfect').length,0);assert.equal(risk.events.filter(e=>e.type==='perfect').length,1);
  assert.ok(safe.coins.filter(e=>e.routeRole==='risk').every(e=>!e.collected));assert.ok(risk.coins.filter(e=>e.routeRole==='safe').every(e=>!e.collected));
  const receipt=risk.events.find(e=>e.type==='perfect');assert.equal(receipt.decisionId,fixture.packet.id);assert.equal(receipt.row,fixture.packet.row);compared++;
  if(!boost)for(const protection of ['shield','rush']){
   const protectedRun=clearStation(fixture,'risk',{protection,performAction:false});assert.equal(protectedRun.g.phase,'playing');
   assert.equal(protectedRun.events.filter(e=>e.type==='perfect').length,0);assert.equal(protectedRun.g.jumps+protectedRun.g.ducks,0);
   assert.ok(protectedRun.events.some(e=>e.type===(protection==='shield'?'hit':'smash')));
  }
  if(!boost){const wrong=clearStation(fixture,'risk',{performAction:false});assert.equal(wrong.g.phase,'lost');}
 }
 console.log(JSON.stringify({matchedNaturalStations:compared,safeBasePayout:30,guardedBaseCoinPayout:100,unprotectedSkillPayout:100,protectedSkillPayout:0}));
});

test('a player can take front duck gold then physically bail, receiving only contacted coins and no perfect award',()=>{
 const fixture=matchedStation('duck'),p=fixture.packet,g=structuredClone(fixture.state),input=emptyInput();
 assert.equal(Math.abs(p.riskLane-p.safeLane),1);g.lane=g.visualLane=p.riskLane;g.laneVelocity=0;
 const tracked=[...g.entities],events=[];let bailed=false,lastEvent=0;
 while(g.phase==='playing'&&g.distance<=p.endD+.01){
  if(!bailed&&g.coins>0){steer(g,input,p.safeLane);bailed=true;}
  updateGame(g,input,1/120);for(const e of g.effects)if(e.id>lastEvent){events.push({...e});lastEvent=Math.max(lastEvent,e.id);}
 }
 assert.ok(bailed);assert.equal(g.phase,'playing');assert.equal(g.shieldsUsed,0);assert.equal(g.ducks,0);
 const touchedRisk=tracked.filter(e=>e.routeRole==='risk'&&e.collected),touchedSafe=tracked.filter(e=>e.routeRole==='safe'&&e.collected);
 assert.ok(touchedRisk.length>0&&touchedRisk.length<5);assert.ok(touchedSafe.length<3);
 assert.equal(events.filter(e=>e.type==='perfect').length,0);assert.equal(g.bonus,touchedRisk.length*20+touchedSafe.length*10);
 assert.ok(g.bonus<200,'an early exit received the full guarded reward');
 console.log(JSON.stringify({partialDuckAbort:{premiumTouched:touchedRisk.length,ordinaryTouched:touchedSafe.length,actualPoints:g.bonus,skillPoints:0,shieldUsed:false}}));
});

function play(seed,index,hz,lead,strategy,useRush){
 const g=createGame(seed,index),input=emptyInput(),handled=new Set(),startedAbort=new Set();g.shield=false;
 let contacts=0,riskContacts=0,decisionCoins=0,missedAlternatives=0,maxEntities=0,maxVisibleCoins=0,aborts=0;
 while(g.phase==='playing'){
  const packetById=new Map(g.decisions.map(p=>[p.id,p]));
  const selected=e=>e.type==='coin'&&!e.done&&(e.decisionId?(strategy==='risk'?e.routeRole==='risk':e.routeRole==='safe'):e.primaryRoute!==false);
  const next=g.entities.find(selected),p=next?.decisionId?packetById.get(next.decisionId):null;
  if(p&&strategy==='abort'&&!startedAbort.has(p.id)&&timeToImpact(g,p.d)<1.2&&timeToImpact(g,p.d)>.7){steer(g,input,p.riskLane);startedAbort.add(p.id);aborts++;}
  if(next&&timeToImpact(g,next.d)<(p&&strategy==='abort'?.45:.24)&&g.lane!==next.lane)steer(g,input,next.lane);
  const obstacles=g.entities.filter(e=>!e.done&&hazard(e)),first=obstacles[0];
  if(first&&!handled.has(first.row)&&timeToImpact(g,first.d)<=lead){
   const row=obstacles.filter(e=>e.row===first.row),contact=row.find(e=>hazardTouchesLane(e,next?.lane??g.lane));
   if(contact&&contact.type!=='rock')queueAction(input,contact.type==='log'?'jump':'duck');handled.add(first.row);
  }
  if(useRush&&g.charge>=100&&!g.rush)queueAction(input,'rush');
  const before=g.entities.filter(e=>!e.done&&e.type==='coin');updateGame(g,input,1/hz);
  assert.notEqual(g.phase,'lost',`${hz}Hz ${LEVELS[index].id} seed${seed} lead${lead} ${strategy} Rush${useRush}: ${g.reason}`);
  for(const e of before)if(e.done){
   if(selected({...e,done:false})){
    assert.ok(e.collected,`${hz}Hz ${LEVELS[index].id} seed${seed} lead${lead} ${strategy} Rush${useRush} misses selected${e.routeRole??e.coinPattern} row${e.row} lane${e.lane}`);
    contacts++;if(e.decisionId){decisionCoins++;if(e.routeRole==='risk')riskContacts++;}
   }else if(e.decisionId){assert.ok(!e.collected,'the untaken route was collected');missedAlternatives++;}
  }
  maxEntities=Math.max(maxEntities,g.entities.length);maxVisibleCoins=Math.max(maxVisibleCoins,g.entities.filter(e=>!e.collected&&e.type==='coin'&&e.d>=g.distance&&e.d-g.distance<=180).length);
 }
 assert.equal(g.phase,'won');assert.equal(g.shieldsUsed,0);assert.ok(decisionCoins>0);assert.ok(missedAlternatives>0);
 if(strategy==='risk')assert.ok(riskContacts>=15);if(strategy==='abort')assert.ok(aborts>=3);
 return {contacts,riskContacts,decisionCoins,missedAlternatives,maxEntities,maxVisibleCoins,aborts};
}

test('safe, committed and aborted choices all finish and collect only their intended route at 30/60/120 Hz and earned Rush',()=>{
 const totals={stages:0,contacts:0,riskContacts:0,decisionCoins:0,missedAlternatives:0,maxEntities:0,maxVisibleCoins:0,aborts:0};
 for(const hz of [30,60,120])for(const level of LEVELS)for(const lead of [.22,.42])for(const strategy of ['safe','risk','abort'])for(const useRush of [false,true])for(const seed of [1,7]){
  const run=play(seed,level.index,hz,lead,strategy,useRush);totals.stages++;
  for(const [key,value]of Object.entries(run))if(key.startsWith('max'))totals[key]=Math.max(totals[key],value);else totals[key]+=value;
 }
 assert.ok(totals.maxVisibleCoins<=64);assert.ok(totals.maxEntities<120);assert.ok(totals.aborts>100);
 console.log(JSON.stringify({...totals,refreshRates:[30,60,120],jumpLeads:[.22,.42],strategies:['safe','risk','abort']}));
});
