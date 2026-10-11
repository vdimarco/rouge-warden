import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,queueAction,updateGame,speedAt} from '../src/game/engine.js';
import {impactFeedback,impactParticle,FATAL_IMPACT_DURATION,IMPACT_SPRAY_CAPACITY} from '../src/game/impact-feedback.js';
import {CENTER_LANE} from '../src/game/lanes.js';

function contact(shield=false){
 const g=Object.assign(createGame(73),{time:1000,entities:[],nextRow:1e9,shield,goal:{kind:'tricks',start:0,target:1e9}});
 g.entities=[{id:991,type:'rock',lane:CENTER_LANE,d:speedAt(g.time,0)*.005}];
 updateGame(g,emptyInput(),.05);return g;
}

test('physical shield contact visibly recoils without locking the controls',()=>{
 const g=contact(true),hit=g.effects.find(e=>e.type==='hit'),feedback=impactFeedback(g);
 assert.equal(g.phase,'playing');assert.equal(g.shield,false);assert.equal(feedback.type,'hit');assert.equal(feedback.eventId,hit.id);
 assert.ok(feedback.active);assert.ok(Math.abs(feedback.recoil)>.5);assert.ok(Math.abs(feedback.pitch)>.12);assert.ok(feedback.brace>.7);assert.ok(feedback.shieldPulse>.7);
 assert.equal(feedback.splashParticles+feedback.shieldShards,IMPACT_SPRAY_CAPACITY);
 const input=emptyInput();queueAction(input,'right');updateGame(g,input,.05);
 assert.equal(g.lane,CENTER_LANE+1);assert.ok(g.visualLane>CENTER_LANE);assert.equal(g.phase,'playing');
 for(let i=0;i<12;i++)updateGame(g,emptyInput(),.05);
 const recovered=impactFeedback(g);assert.equal(recovered.active,false);assert.equal(recovered.cameraShake,0);assert.ok(Math.abs(recovered.recoil)<.02);
});

test('fatal contact has a distinct .60 second wipeout while all simulation fields remain fixed',()=>{
 const g=contact(),before=JSON.stringify(g),samples=[0,.08,.2,.4,.59].map(t=>impactFeedback(g,false,t));
 assert.equal(g.phase,'lost');assert.equal(FATAL_IMPACT_DURATION,.60);assert.ok(samples.every(s=>s.fatal&&s.active));
 assert.ok(samples[0].recoil>.7);assert.ok(Math.abs(samples.at(-1).roll)>.5);assert.ok(samples[0].brace>.9);
 assert.ok(samples[0].cameraShake>samples[3].cameraShake*50);assert.notEqual(samples[0].recoil,samples[2].recoil);
 assert.equal(impactFeedback(g,false,.60).active,false);
 for(let i=0;i<40;i++){impactFeedback(g,false,.2);updateGame(g,emptyInput(),.05);}
 assert.equal(JSON.stringify(g),before);assert.deepEqual(impactFeedback(g,false,.2),samples[2]);
});

test('reduced motion retains a readable static contact without optional shake or particles',()=>{
 for(const shield of [false,true]){
  const g=contact(shield),sample=impactFeedback(g,true,.12);
  assert.ok(sample.active);assert.ok(sample.flash>0);assert.ok(sample.brace>0);
  for(const field of ['recoil','pitch','roll','shakeX','shakeY','cameraShake','splashParticles','shieldShards'])assert.equal(sample[field],0,field);
  assert.deepEqual(impactFeedback(g,true,.12),sample);
 }
});

test('pickup and later reward events do not hide a contact; particle positions reuse a bounded pool',()=>{
 const g=contact(true),hit=g.effects.find(e=>e.type==='hit');
 g.effects.push({type:'coin',id:hit.id+1,time:g.time,lane:1},{type:'goal',id:hit.id+2,time:g.time});
 const impact=impactFeedback(g),point={};assert.equal(impact.eventId,hit.id);
 g.effects.push({type:'smash',id:hit.id+3,time:g.time,contactTime:g.time,lane:1});
 assert.equal(impactFeedback(g).type,'smash');assert.ok(impactFeedback(g).shieldPulse>.7);assert.equal(impactFeedback(g).shieldShards,16);
 for(const elapsed of [0,.1,.3,.54]){
  const sampled=impactFeedback({...g,time:hit.contactTime+elapsed});
  assert.ok(sampled.splashParticles+sampled.shieldShards<=IMPACT_SPRAY_CAPACITY);
  for(let i=0;i<sampled.splashParticles+sampled.shieldShards;i++){
   assert.equal(impactParticle(i,sampled,point),point);
   assert.ok([point.x,point.y,point.z].every(Number.isFinite));assert.ok(Math.abs(point.x)<7);assert.ok(Math.abs(point.z)<5);
  }
 }
 const clean=createGame(73);assert.equal(impactFeedback(clean).active,false);assert.equal(impactFeedback(clean).recoil,0);
});
