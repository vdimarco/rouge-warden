import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,queueAction,updateGame,timeToImpact} from '../src/game/engine.js';
test('delayed-input player survives varied escalating courses with a legal action route',()=>{
  let tricks=0,powers=0,highestEntities=0,totalDistance=0;
  for(let seed=1;seed<=40;seed++){
    const g=createGame(seed),input=emptyInput();g.shield=false;
    let pending=null,handled=new Set(),maxEntities=0;
    for(let frame=0;frame<240*60;frame++){
      const obstacles=g.entities.filter(e=>!e.done&&['rock','log','branch'].includes(e.type)&&e.lane===g.lane);
      const next=obstacles[0];
      if(next&&!handled.has(next.id)&&timeToImpact(g,next.d)<.62&&!pending){
        const row=g.entities.filter(e=>e.row===next.row&&['rock','log','branch'].includes(e.type));
        const safe=[0,1,2].find(l=>!row.some(e=>e.lane===l));
        pending={id:next.id,at:g.time+.18+(seed%7)*.018,actions:next.type==='rock'?Array.from({length:Math.abs(safe-g.lane)},()=>safe>g.lane?'right':'left'):[next.type==='log'?'jump':'duck']};
      }
      if(pending&&g.time>=pending.at){pending.actions.forEach(a=>queueAction(input,a));handled.add(pending.id);pending=null;}
      if(g.charge>=100&&!g.rush){queueAction(input,'rush');powers++;}
      updateGame(g,input,1/60);maxEntities=Math.max(maxEntities,g.entities.length);
      assert.equal(g.phase,'playing',`seed ${seed}, time ${g.time.toFixed(2)}: ${g.reason}`);
      if(handled.size>20)handled=new Set([...handled].slice(-10));
    }
    assert.ok(g.jumps+g.ducks>50,`insufficient choices: ${g.jumps+g.ducks}`);
    assert.ok(maxEntities<180,`unbounded ${maxEntities}`);
    tricks+=g.jumps+g.ducks;totalDistance+=g.distance;highestEntities=Math.max(highestEntities,maxEntities);
  }
  console.log(JSON.stringify({seeds:40,secondsPerRun:240,reactionDelayMs:'180–288',tricks,rushes:powers,maxEntities:highestEntities,totalDistance:Math.floor(totalDistance)}));
});
test('doing nothing reliably ends a run quickly, retry creates clean state',()=>{const g=createGame(7);for(let i=0;i<20*60;i++)updateGame(g,emptyInput(),1/60);assert.equal(g.phase,'lost');assert.ok(g.time<12);assert.ok(g.score>0);const retry=createGame(8);assert.equal(retry.distance,0);assert.equal(retry.coins,0);assert.equal(retry.action,'');assert.equal(retry.charge,0);assert.equal(retry.shield,true);});
