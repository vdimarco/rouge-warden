import assert from 'node:assert/strict';
import { createMatch, player, step } from '../../public/tidebreak/sim.js';
import { near } from './open-ground.mjs';

function setup(hero=2) {
  const s=createMatch(hero,49),p=player(s),foe=s.units.find(e=>e.kind==='hero'&&e.team===1);
  Object.assign(p,near(2400,2800),{level:6,skillRanks:[1,1,1,1],mana:2000,maxMana:2000});
  Object.assign(foe,{x:p.x+100,y:p.y,hp:10000,maxHp:10000,stun:100,nextShop:Infinity});
  s.units=[p,foe];s.nextWave=s.objectiveAt=Infinity;s.campTimers=[Infinity,Infinity];
  return {s,p,foe};
}

{
  const {s,p}=setup();p.cd[1]=.005;
  step(s,{cast:1,aim:{x:1,y:0},attack:false},.01);
  assert.deepEqual(p.lastCastRequest,{slot:1,at:s.time,outcome:'accepted'},'a cooldown that expires this step accepts the actual press');
  assert(p.cd[1]>1,'the accepted spell starts its full cooldown');
}
{
  const {s,p}=setup();p.cd[1]=.1;
  step(s,{cast:1,attack:false},.01);
  assert.equal(p.lastCastRequest.outcome,'rejected','a spell still on cooldown records rejection');assert.equal(p.queuedCast,undefined);
}
{
  const {s,p}=setup();p.recoveryUntil=.1;
  step(s,{cast:1,aim:{x:1,y:0},attack:false},.01);
  assert.equal(p.lastCastRequest.outcome,'queued','a buffered player press is distinct from rejection');assert.equal(p.queuedCast.slot,1);
  const recorded=p.lastCastRequest;
  for(let i=0;i<15;i++)step(s,{attack:false},.01);
  assert(p.cd[1]>1,'the queued spell eventually casts');assert.equal(p.lastCastRequest,recorded,'internal queue resolution does not create another player-request event');
}
for(const control of ['stun','fear','taunt']) {
  const {s,p,foe}=setup();
  if(control==='taunt'){p.tauntUntil=1;p.tauntBy=foe.id;}
  else p[control]=1;
  step(s,{cast:1,attack:false},.01);
  assert.deepEqual(p.lastCastRequest,{slot:1,at:s.time,outcome:'rejected'},`${control} skipping the input path still records the rejected press`);assert.equal(p.cd[1],0);
}
{
  const {s,p}=setup(3);
  p.travel={x:p.x,y:p.y,start:0,duration:1,length:80,angle:0,strength:1,hitIds:[]};
  step(s,{cast:3,aim:{x:1,y:0},attack:false},.01);
  assert.equal(p.lastCastRequest.outcome,'accepted','a player cast during a moving hero mechanic records the real early-path outcome');assert(p.cd[3]>0);
}
{
  const {s,p}=setup();step(s,{autopilot:true,cast:1,attack:false},.01);
  assert.equal(p.lastCastRequest,undefined,'bot and autopilot actions do not become player-request events');
}
console.log('PASS: actual cast requests track same-step cooldown acceptance, rejection, buffering, control skips and movement casts without recording internal or bot casts.');
