import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,queueAction,updateGame,timeToImpact,nextLevel,restartLevel,snapshot} from '../src/game/engine.js';
import {LEVELS,FINISH_RUNWAY} from '../src/game/levels.js';

test('40 delayed-input players clear all three varied maps unshielded, with and without Rush',()=>{
 let tricks=0,powers=0,highestEntities=0,totalDistance=0,stages=0;
 for(const useRush of [false,true])for(let seed=1;seed<=40;seed++){
  let g=createGame(seed),input=emptyInput();
  const campaignScores=[];
  for(const level of LEVELS){
   g.shield=false;
   let pending=null,handled=new Set(),maxEntities=0,lastHazard=0;
   for(let frame=0;frame<70*60&&g.phase==='playing';frame++){
    const obstacles=g.entities.filter(e=>!e.done&&['rock','log','branch'].includes(e.type));
    for(const e of obstacles){lastHazard=Math.max(lastHazard,e.d);assert.ok(e.d<level.length-FINISH_RUNWAY);}
    const next=obstacles.find(e=>e.lane===g.lane);
    if(next&&!handled.has(next.id)&&timeToImpact(g,next.d)<.62&&!pending){
     const row=obstacles.filter(e=>e.row===next.row);
     const safe=[0,1,2].find(l=>!row.some(e=>e.lane===l));
     assert.ok(next.type!=='rock'||safe!==undefined,'a rock row has no route');
     pending={id:next.id,at:g.time+.18+(seed%7)*.018,actions:next.type==='rock'?Array.from({length:Math.abs(safe-g.lane)},()=>safe>g.lane?'right':'left'):[next.type==='log'?'jump':'duck']};
    }
    if(pending&&g.time>=pending.at){pending.actions.forEach(a=>queueAction(input,a));handled.add(pending.id);pending=null;}
    if(useRush&&g.charge>=100&&!g.rush){queueAction(input,'rush');powers++;}
    updateGame(g,input,1/60);maxEntities=Math.max(maxEntities,g.entities.length);
    assert.notEqual(g.phase,'lost',`seed ${seed}, map ${level.id}, time ${g.time.toFixed(2)}, Rush ${useRush}: ${g.reason}`);
    assert.equal(g.shieldsUsed,0,'the route needed a shield rescue');
    if(handled.size>20)handled=new Set([...handled].slice(-10));
   }
   assert.equal(g.phase,'won',`seed ${seed}, map ${level.id} did not end`);
   assert.equal(g.distance,level.length);assert.ok(lastHazard<level.length-FINISH_RUNWAY);
   assert.ok(g.jumps+g.ducks>=5,`insufficient action choices: ${g.jumps+g.ducks}`);
   assert.equal(new Set(g.patternsSeen.filter(p=>p!=='tutorial')).size,6);
   assert.ok(maxEntities<120,`unbounded active entities: ${maxEntities}`);
   const s=snapshot(g);assert.equal(s.campaign.levelsCleared,level.index+1);
   campaignScores.push(s.campaign.score);
   tricks+=g.jumps+g.ducks;totalDistance+=g.distance;highestEntities=Math.max(highestEntities,maxEntities);stages++;
   if(!level.index)assert.ok(g.time<35,'intro map is excessively long');
   if(level.index<2){const previous=s.campaign;g=nextLevel(g);assert.deepEqual(snapshot(g).campaign,previous);}
  }
  const completed=snapshot(g).campaign;
  assert.equal(completed.distance,5400);
  assert.ok(Number.isSafeInteger(completed.score)&&completed.score>0&&completed.score<=1000000,'a genuine finished campaign exceeds the public score range');
  assert.ok(Number.isSafeInteger(completed.coins)&&completed.coins<=5000,'a genuine finished campaign exceeds the public coin range');
  assert.equal(nextLevel(g),null);
  assert.ok(campaignScores[1]>campaignScores[0]&&campaignScores[2]>campaignScores[1]);
 }
 console.log(JSON.stringify({seeds:40,campaigns:80,stages,reactionDelayMs:'180–288',tricks,rushes:powers,maxEntities:highestEntities,totalDistance}));
});

test('doing nothing reliably wipes out before a finish, and retry repeats the same course cleanly',()=>{
 const g=createGame(7);for(let i=0;i<20*60;i++)updateGame(g,emptyInput(),1/60);
 assert.equal(g.phase,'lost');assert.ok(g.time<12);assert.ok(g.score>0);assert.equal(snapshot(g).campaign.levelsCleared,0);
 const retry=restartLevel(g);
 assert.equal(retry.campaignSeed,7);assert.equal(retry.seed,g.seed);assert.equal(retry.distance,0);assert.equal(retry.coins,0);assert.equal(retry.action,'');assert.equal(retry.charge,0);assert.equal(retry.shield,true);
 assert.deepEqual(retry.entities,createGame(7).entities);
});
