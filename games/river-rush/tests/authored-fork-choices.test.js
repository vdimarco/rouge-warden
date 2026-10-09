import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,queueAction,updateGame,timeToImpact,generateAhead,snapshot,hazardTouchesLane,HAZARD_LANE_RADIUS} from '../src/game/engine.js';
import {LEVELS} from '../src/game/levels.js';
import {riverFork,nextRiverFork,forkLaneCross,islandContains} from '../src/game/river-forks.js';
import {createAdventure,ADVENTURE_PHRASES,streamLanes,adventureRoute} from '../src/game/river-adventures.js';
import {worldEntityVisible} from '../src/game/world.js';
import {rewardChoiceCue} from '../src/game/adventure-cues.js';
const steer=(g,input,lane)=>{for(let n=0;n<Math.abs(lane-g.lane);n++)queueAction(input,lane>g.lane?'right':'left');};
function prepare(seed,index,boost=false,forkIndex=0){
 const g=createGame(seed,index);let fork=nextRiverFork(0,g.terrainProfile);for(let n=0;n<forkIndex;n++)fork=nextRiverFork(fork.end+1,g.terrainProfile);assert.ok(fork);
 g.distance=fork.start-140;g.time=500;g.nextRow=fork.start;g.entities=[];g.adventures=[];g.shield=false;g.rush=boost?1000:0;g.goal={kind:'coins',start:0,target:1e9};generateAhead(g);
 return{g,fork,packet:g.adventures.find(p=>p.id===fork.id)};
}
function play(seed,index,hz,mode,{delay=.288,boost=false,forkIndex=0}={}){
 const {g,fork,packet}=prepare(seed,index,boost,forkIndex),input=emptyInput(),safe=mode==='snatch'||mode==='sheltered',side=safe?fork.safeSide:fork.riskSide;
 const family=mode==='bank'?'wildlife-bank':mode==='snatch'?'boulder-snatch':mode==='detour'?'landing-detour':null,choice=packet.choices.find(p=>p.family===family),handled=new Set(),events=[];
 let last=0,pendingReturn=null,stashSeen=false,guardMargin=null;
 while(g.phase==='playing'&&g.distance<fork.end){
  const guard=g.entities.find(e=>!e.done&&e.adventureId===fork.id&&e.routeSide===side&&['rock','log','branch'].includes(e.type));
  const cache=g.entities.find(e=>!e.done&&e.type==='treasure'&&e.adventureId===fork.id&&e.routeSide===side);
  let target=guard?.adventureRouteLane??cache?.lane??(side<0?1:3);
  const stash=choice?g.entities.find(e=>!e.done&&e.type==='stash'&&e.choiceId===choice.id):null;
  if(stash&&timeToImpact(g,stash.d)<=.28)target=stash.lane;
  if(mode==='bank'&&guard?.guardId===choice.guardId)target=choice.alternativeLane;
  if(pendingReturn&&g.time<pendingReturn.at)target=choice.alternativeLane;
  steer(g,input,target);
  if(guard&&!safe&&!handled.has(guard.row)&&timeToImpact(g,guard.d)<=.31){
   const deliberatelyBanked=mode==='bank'&&guard.guardId===choice.guardId;
   const delayed=mode==='detour'&&guard.guardId===choice.guardId&&pendingReturn&&g.time<pendingReturn.at;
   if(!deliberatelyBanked&&!delayed){queueAction(input,guard.type==='log'?'jump':'duck');handled.add(guard.row);}
  }
  const before=g.entities.filter(e=>!e.done&&e.adventureId===fork.id);
  updateGame(g,input,1/hz);assert.equal(g.phase,'playing',`${seed}/${index} ${hz}Hz ${mode} delay${delay} Rush${boost} at${g.distance}: ${g.reason}`);assert.equal(g.shieldsUsed,0);
  for(const e of before)if(e.done&&e.type==='stash'&&e.collected){
   if(mode!=='bank')assert.equal(e.choiceId,choice?.id,'unselected offer collected');if(e.choiceId===choice?.id)stashSeen=true;
   assert.equal(adventureRoute(packet,side).collected,false,'local stash marked the final cache collected');assert.equal(adventureRoute(packet,side).earned,0);
   if(mode==='detour'||mode==='snatch')pendingReturn={at:g.time+delay};
  }
  for(const receipt of g.effects)if(receipt.id>last){last=receipt.id;events.push({...receipt});if(choice&&receipt.guardId===choice.guardId&&['perfect','smash'].includes(receipt.type))guardMargin={time:receipt.actionTime,height:receipt.playerHeight,action:receipt.action,remainingAfterStash:receipt.contactTime-(events.find(e=>e.type==='stash'&&e.choiceId===choice.id)?.contactTime??receipt.contactTime)};}
 }
 return{g,fork,packet,choice,events,stashSeen,guardMargin};
}

test('four complete phrases create real optional exposure and same-lane return geometry without random token positions',()=>{
 const phrases=new Set();let packets=0;
 for(let seed=1;seed<=40;seed++)for(const level of LEVELS){
  const {g,fork}=prepare(seed,level.index),packet=g.adventures[0];packets++;phrases.add(packet.phrase);
  assert.equal(packet.choices.length,3);assert.deepEqual(packet.choices.map(c=>c.family).sort(),['boulder-snatch','landing-detour','wildlife-bank']);
  const beats=packet.nodes.filter(n=>n.kind==='beat');assert.equal(beats.length,3);assert.ok(ADVENTURE_PHRASES.includes(packet.phrase));
  const bank=packet.choices.find(c=>c.family==='wildlife-bank'),bankGuard=beats.find(n=>n.guardId===bank.guardId);assert.ok(['crocodile','fish','bird'].includes(bankGuard.guard));assert.equal(bank.choiceD,bankGuard.d);assert.notEqual(bank.entryLane,bank.alternativeLane);
  const detour=packet.choices.find(c=>c.family==='landing-detour'),source=beats.find(n=>n.guardId===detour.sourceGuardId),returnGuard=beats.find(n=>n.guardId===detour.guardId);assert.equal(source.riskLane,returnGuard.riskLane);assert.ok(['crocodile','fish','bird'].includes(returnGuard.guard));assert.ok(detour.returnSeconds>=.46-1e-8);assert.ok((detour.choiceD-source.d)/(level.maxSpeed*1.32)>=.50-1e-8);
  const snatch=packet.choices.find(c=>c.family==='boulder-snatch');assert.ok(snatch.step===1||snatch.step===2);assert.equal(beats[snatch.step-1].safeLane,beats[snatch.step].safeLane,'coasting the prior clear line would collect optional exposure');assert.notEqual(snatch.alternativeLane,snatch.exitLane);assert.ok(snatch.returnSeconds>=.54-1e-8);
  for(const c of packet.choices){assert.ok(!islandContains(forkLaneCross(c.alternativeLane,c.choiceD,g.terrainProfile),c.choiceD,g.terrainProfile));assert.ok(Math.abs(c.entryLane-c.alternativeLane)===1);}
 }
 assert.deepEqual([...phrases].sort(),[...ADVENTURE_PHRASES].sort());console.log(JSON.stringify({authoredSeedMaps:packets,phrases:[...phrases],minimumDetourImpactReturnSeconds:.46,minimumBoulderImpactReturnSeconds:.54}));
});

test('bank versus guard gives mutually exclusive physical qualification and honest base or clean final treasure',()=>{
 let comparisons=0;
 for(const seed of [1,12,137])for(const level of LEVELS)for(const hz of [30,60,120]){
  const bank=play(seed,level.index,hz,'bank'),guard=play(seed,level.index,hz,'guard');comparisons++;
  const stash=bank.events.find(e=>e.type==='stash'&&e.choiceId===bank.choice.id);assert.ok(stash);assert.equal(stash.value,120);assert.equal(stash.choiceFamily,'wildlife-bank');assert.equal(bank.events.some(e=>e.type==='perfect'&&e.guardId===bank.choice.guardId),false);
  assert.equal(bank.events.find(e=>e.type==='treasure').value,200);assert.equal(guard.events.find(e=>e.type==='treasure').value,600);assert.equal(guard.events.some(e=>e.type==='stash'),false);
  const guardEvent=guard.events.find(e=>e.type==='perfect'&&e.guardId===bank.choice.guardId);assert.ok(guardEvent);
  const actualGuard=bank.packet.nodes.find(n=>n.guardId===bank.choice.guardId);assert.ok(Math.abs(forkLaneCross(stash.playerLane,stash.distance,bank.g.terrainProfile)-forkLaneCross(actualGuard.riskLane,stash.distance,bank.g.terrainProfile))>HAZARD_LANE_RADIUS*3.8);
  const centerGold=bank.events.find(e=>e.type==='coin'&&e.choiceId===bank.choice.id&&Math.abs(e.distance-bank.choice.choiceD)<1e-7);assert.equal(centerGold,undefined,'banked player also got the mutually exclusive contact-plane guard coin');
 }
 console.log(JSON.stringify({matchedBankGuardComparisons:comparisons,bankStash:120,bankMainCache:200,cleanGuardMainCache:600}));
});

test('taking and skipping detours and boulder snatches work with actual delayed reversals across maps, refresh rates and maximum future Rush',()=>{
 let detours=0,snatches=0,protectedRuns=0,minJumpTime=Infinity,minReturn=Infinity;
 for(const seed of [1,137])for(const level of LEVELS)for(const hz of [30,60,120])for(const delay of [.18,.234,.288])for(const boost of [false,true]){
  const detour=play(seed,level.index,hz,'detour',{delay,boost}),snatch=play(seed,level.index,hz,'snatch',{delay,boost});detours++;snatches++;
  assert.ok(detour.stashSeen);assert.ok(snatch.stashSeen);assert.equal(detour.events.find(e=>e.type==='stash').value,200);assert.equal(snatch.events.find(e=>e.type==='stash').value,120);
  const clear=detour.events.find(e=>e.guardId===detour.choice.guardId&&['perfect','smash'].includes(e.type));assert.ok(clear,'detour never physically met its advertised return guard');assert.equal(clear.action,detour.choice.action);if(clear.obstacle==='log'){assert.ok(clear.playerHeight>.28,'delayed jump had not reached clearance height');minJumpTime=Math.min(minJumpTime,clear.actionTime);}
  minReturn=Math.min(minReturn,detour.guardMargin.remainingAfterStash);
  assert.equal(detour.events.find(e=>e.type==='treasure').value,boost?200:600,'optional pickup alone invalidated clean entitlement');assert.equal(snatch.events.find(e=>e.type==='treasure').value,200);
  assert.equal(snatch.events.some(e=>e.guardId===snatch.choice.guardId&&['hit','smash','lose'].includes(e.type)),false,'snatch did not physically cut back before the boulder');
  if(boost)protectedRuns++;
 }
 for(const seed of [1,137])for(const level of LEVELS){const skip=play(seed,level.index,60,'guard'),clear=play(seed,level.index,60,'sheltered');assert.equal(skip.events.some(e=>e.type==='stash'),false);assert.equal(clear.events.some(e=>e.type==='stash'),false);assert.equal(skip.events.find(e=>e.type==='treasure').value,600);assert.equal(clear.events.find(e=>e.type==='treasure').value,200);}
 console.log(JSON.stringify({takenLandingDetours:detours,takenBoulderSnatches:snatches,protectedMaximumRushRuns:protectedRuns,inputDelayMs:[180,234,288],minimumObservedJumpTimeAtReturnGuard:minJumpTime,minimumObservedImpactReturnSeconds:minReturn}));
});

test('stash is a fixed score-only ground pickup, never a coin, power, adjacent attraction or main-cache claim',()=>{
 for(const hz of [30,60,120])for(const value of [120,200])for(const powered of [false,true]){
  const g=createGame(1),e={id:900,type:'stash',lane:2,d:.1,value,choiceId:'fixture',choiceFamily:'wildlife-bank',choiceRole:'bank',adventureId:'fixture',routeSide:-1,routeRole:'risk'};
  Object.assign(g,{entities:[e],nextRow:1e9,coins:11,streak:7,multiplier:1,lastCoin:0,charge:48,magnet:powered?8:0,rush:powered?4:0,goal:{kind:'coins',start:0,target:1e9}});updateGame(g,emptyInput(),1/hz);
  assert.equal(e.collected,true);assert.equal(g.bonus,value);assert.equal(g.coins,11);assert.equal(g.streak,7);assert.equal(g.multiplier,1);assert.equal(g.charge,48);assert.equal(g.effects.find(e=>e.type==='stash').value,value);assert.equal(worldEntityVisible(e,g.distance,180),false);
 }
 for(const hz of [30,60,120])for(const condition of ['adjacent','airborne','widening-gap']){
  const {g,fork}=prepare(137,0),e={id:900,type:'stash',lane:1,d:0,value:200};g.distance=(fork.splitStart+fork.splitEnd)/2;e.d=g.distance+.1;g.entities=[e];g.nextRow=1e9;
  g.visualLane=g.lane=condition==='adjacent'?0:condition==='widening-gap'?1.24:1;if(condition==='airborne'){g.action='jump';g.actionTime=.3;}
  updateGame(g,emptyInput(),1/hz);assert.equal(e.collected,undefined);assert.equal(g.bonus,0);assert.equal(g.effects.some(e=>e.type==='stash'),false);
 }
});

test('the upcoming bank alternative stays readable after a collected detour at the same return guard',()=>{
 let found=null;
 for(let seed=1;seed<=50&&!found;seed++)for(const level of LEVELS){const state=prepare(seed,level.index),bank=state.packet.choices.find(c=>c.family==='wildlife-bank'),detour=state.packet.choices.find(c=>c.family==='landing-detour');if(bank.guardId===detour.guardId){found={...state,bank,detour};break;}}
 assert.ok(found);const {g,packet,bank,detour}=found;g.distance=detour.choiceD+1;g.lane=g.visualLane=detour.alternativeLane;detour.collected=true;detour.earned=200;
 const choice=snapshot(g).rewardChoice;assert.equal(choice.id,bank.id);assert.equal(choice.returnFromChoiceId,detour.id);assert.equal(choice.returnFromValue,200);assert.equal(choice.guardId,detour.guardId);assert.equal(choice.baseValue,120);assert.equal(adventureRoute(packet,packet.riskSide).collected,false);
});

test('a physically banked stash reveals its following detour and keeps that detour return urgent without restoring the clean bonus',()=>{
 for(const hz of [30,60,120])for(const boost of [false,true]){
  const {g,packet}=prepare(1,0,boost),input=emptyInput(),bank=packet.choices.find(c=>c.family==='wildlife-bank'),detour=packet.choices.find(c=>c.family==='landing-detour');
  assert.equal(bank.step,0);assert.equal(detour.sourceGuardId,bank.guardId);assert.equal(detour.exitD,bank.exitD);assert.equal(detour.alternativeLane,bank.alternativeLane);
  steer(g,input,bank.alternativeLane);
  while(!bank.collected){updateGame(g,input,1/hz);assert.equal(g.phase,'playing');assert.ok(g.distance<=bank.choiceD+g.speed/hz);}
  const bankReceipt=g.effects.find(e=>e.type==='stash'&&e.choiceId===bank.id);assert.ok(bankReceipt);assert.equal(bankReceipt.value,120);
  const banked=snapshot(g),offer=rewardChoiceCue(banked);
  assert.ok(g.distance<bank.exitD,'the original bank return is still unfinished');assert.ok(g.distance<detour.choiceD,'the new decision must be readable before stash contact');
  assert.equal(banked.rewardChoice.id,detour.id);assert.equal(banked.rewardChoice.returnFromChoiceId,bank.id);assert.equal(banked.rewardChoice.returnFromValue,120);
  assert.ok(offer);assert.equal(offer.family,'landing-detour');assert.equal(offer.stashPoints,200);assert.equal(offer.stashDirection,'hold');
  assert.equal(offer.returnDirection,detour.exitLane<detour.alternativeLane?'left':'right');assert.equal(offer.cleanAtRisk,0);
  assert.equal(adventureRoute(packet,packet.riskSide).cleanEligible,false);assert.equal(adventureRoute(packet,packet.riskSide).cleanClears,0);
  assert.equal(g.effects.find(e=>e.id===bankReceipt.id),bankReceipt,'snapshot promotion must preserve the actual payout receipt');
  while(!detour.collected){updateGame(g,input,1/hz);assert.equal(g.phase,'playing');assert.ok(g.distance<=detour.choiceD+g.speed/hz);}
  assert.equal(g.effects.find(e=>e.type==='stash'&&e.choiceId===detour.id).value,200);
  const returning=snapshot(g);assert.equal(returning.rewardChoice.id,detour.id);assert.equal(returning.rewardChoice.collected,true);
  const heldUntil=g.time+.288;
  while(g.time<heldUntil||timeToImpact(g,detour.guardD)>1.25){updateGame(g,input,1/hz);assert.equal(g.phase,'playing');}
  steer(g,input,detour.exitLane);updateGame(g,input,1/hz);assert.equal(g.phase,'playing');
  const urgent=snapshot(g),returnCue=rewardChoiceCue(urgent);
  assert.equal(urgent.hint.guardId,detour.guardId);assert.ok(urgent.hint.in<=1.35,'the fixture must cover the urgent required return');
  assert.ok(returnCue,'the same-guard return remains visible beside its urgent action');assert.equal(returnCue.id,detour.id);assert.equal(returnCue.action,detour.action);
  assert.equal(returnCue.returnDirection,Math.abs(detour.exitLane-g.visualLane)<=.35?'hold':detour.exitLane<g.visualLane?'left':'right');assert.equal(returnCue.cleanAtRisk,0);
  assert.equal(rewardChoiceCue({...urgent,hint:{...urgent.hint,guardId:'unrelated-danger'}}),null,'an unrelated urgent hazard still takes priority');
  assert.equal(adventureRoute(packet,packet.riskSide).cleanEligible,false);assert.equal(g.shieldsUsed,0);
 }
});

test('the shortest later-fork jump return clears with 180–288ms delayed reversal at maximum future Rush',()=>{
 let shortest=null;
 for(let seed=1;seed<=40;seed++)for(const level of LEVELS){
  const g=createGame(seed,level.index);let fork=nextRiverFork(0,g.terrainProfile),forkIndex=0;
  while(fork){const packet=createAdventure(fork,level.maxSpeed*1.32,level.index),choice=packet.choices.find(c=>c.family==='landing-detour');
   if(choice.action==='jump'&&(!shortest||choice.returnSeconds<shortest.returnSeconds))shortest={seed,index:level.index,forkIndex,returnSeconds:choice.returnSeconds};
   fork=nextRiverFork(fork.end+1,g.terrainProfile);forkIndex++;
  }
 }
 assert.ok(shortest);assert.ok(shortest.returnSeconds<.50,'fixture does not cover the tightest authored jump return');let minimumJumpTime=Infinity,minimumJumpHeight=Infinity;
 for(const hz of [30,60,120])for(const delay of [.18,.234,.288])for(const boost of [false,true]){
  const run=play(shortest.seed,shortest.index,hz,'detour',{delay,boost,forkIndex:shortest.forkIndex}),guard=run.events.find(e=>e.guardId===run.choice.guardId&&['perfect','smash'].includes(e.type));
  assert.ok(run.stashSeen);assert.ok(guard);assert.equal(guard.action,'jump');assert.ok(guard.playerHeight>.28);minimumJumpTime=Math.min(minimumJumpTime,guard.actionTime);minimumJumpHeight=Math.min(minimumJumpHeight,guard.playerHeight);
  assert.equal(run.events.find(e=>e.type==='treasure').value,boost?200:600);
 }
 console.log(JSON.stringify({shortestLaterForkJumpReturn:shortest,standardJumpLaunchMargin:shortest.returnSeconds-.31,minimumActualJumpTimeAtImpact:minimumJumpTime,minimumActualJumpHeightAtImpact:minimumJumpHeight,inputDelayMs:[180,234,288]}));
});

test('whole finite maps support consciously taking every chosen-family stash, real delayed exits and naturally earned Rush',()=>{
 let stages=0,stashCount=0,cacheCount=0,rushes=0,maxEntities=0;
 for(const hz of [30,60,120])for(const level of LEVELS)for(const seed of [1,8])for(const useRush of [false,true])for(const strategy of ['detours','snatches']){
  const g=createGame(seed,level.index),input=emptyInput(),handled=new Set(),wanted=new Set(),paid=new Set();g.shield=false;let pending=null,last=0;
  while(g.phase==='playing'){
   const packet=g.adventures.find(p=>g.distance>=p.start-g.speed*.18&&g.distance<p.end),side=packet?(strategy==='detours'?packet.riskSide:packet.safeSide):null;
   const choice=packet?.choices.find(c=>c.family===(strategy==='detours'?'landing-detour':'boulder-snatch'));
   if(choice)wanted.add(choice.id);
   const ordinaryNext=g.entities.find(e=>!e.done&&e.type==='coin'&&e.adventureId===undefined&&e.primaryRoute!==false);
   const ownGuard=packet?g.entities.find(e=>!e.done&&e.adventureId===packet.id&&e.routeSide===side&&['rock','log','branch'].includes(e.type)):null;
   const ownCache=packet?g.entities.find(e=>!e.done&&e.type==='treasure'&&e.adventureId===packet.id&&e.routeSide===side):null;
   let target=g.lane;
   if(packet)target=ownGuard?.adventureRouteLane??ownCache?.lane??(side<0?1:3);
   else if(ordinaryNext&&timeToImpact(g,ordinaryNext.d)<.24)target=ordinaryNext.lane;
   const stash=choice?g.entities.find(e=>!e.done&&e.type==='stash'&&e.choiceId===choice.id):null;
   if(stash&&timeToImpact(g,stash.d)<=.28)target=stash.lane;
   if(pending&&g.time<pending.at)target=pending.alternativeLane;
   steer(g,input,target);
   const obstacles=g.entities.filter(e=>!e.done&&['rock','log','branch'].includes(e.type)),guard=ownGuard??(!packet?obstacles[0]:null);
   if(guard&&!handled.has(guard.row)&&timeToImpact(g,guard.d)<=.31){
    const delayed=pending&&guard.guardId===pending.guardId&&g.time<pending.at;
    const contact=packet?guard:obstacles.find(e=>e.row===guard.row&&hazardTouchesLane(e,ordinaryNext?.lane??g.lane));
    if(!delayed&&contact&&contact.type!=='rock'){queueAction(input,contact.type==='log'?'jump':'duck');handled.add(guard.row);}
   }
   if(useRush&&g.charge>=100&&!g.rush){queueAction(input,'rush');rushes++;}
   updateGame(g,input,1/hz);assert.notEqual(g.phase,'lost',`${hz}Hz ${level.id}/${seed} ${strategy} Rush${useRush} ${g.reason}`);assert.equal(g.shieldsUsed,0);
   for(const e of g.effects)if(e.id>last){last=e.id;if(e.type==='stash'){assert.equal(e.choiceFamily,strategy==='detours'?'landing-detour':'boulder-snatch','unselected-family stash was accidentally collected');paid.add(e.choiceId);stashCount++;pending={at:g.time+.288,alternativeLane:choice.alternativeLane,guardId:choice.guardId};}if(e.type==='treasure'){cacheCount++;assert.equal(e.routeRole,strategy==='detours'?'risk':'safe');}}
   maxEntities=Math.max(maxEntities,g.entities.length);
  }
  assert.equal(g.phase,'won');assert.equal(g.distance,level.length);assert.deepEqual([...paid].sort(),[...wanted].sort(),'a consciously selected stash was not physically reached');stages++;
 }
 assert.ok(stashCount>=stages*2);assert.ok(cacheCount>=stages*2);assert.ok(rushes>20);assert.ok(maxEntities<120);console.log(JSON.stringify({completeOptionalStashStages:stages,selectedStashesPhysicallyPaid:stashCount,mainCachesPhysicallyPaid:cacheCount,naturallyEarnedRushes:rushes,maxEntities,delayedExitMs:288}));
});
