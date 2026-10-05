import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotion,advanceMotion,paddleFrame,landingPulse,impactPulse,pickupProgress} from '../src/game/motion.js';
import {createGame,emptyInput,applyAction,updateGame} from '../src/game/engine.js';
const state=()=>({time:0,coins:0,action:'',effects:[]});
test('pose blending, paddling and effects freeze with simulation time',()=>{
 const g=state(),m=createMotion(g);g.action='jump';g.time=.04;g.effects=[{type:'land',time:.02,id:1}];advanceMotion(m,g);
 const before=structuredClone(m),frame=paddleFrame(g.time),pulse=landingPulse(m,g.time);
 for(let i=0;i<100;i++)advanceMotion(m,g);
 assert.deepEqual(m,before);assert.equal(paddleFrame(g.time),frame);assert.equal(landingPulse(m,g.time),pulse);assert.ok(m.weights[1]>.7);assert.equal(m.bursts.length,1);
});
test('coin flights retain the source lane and expire; repeated events are never duplicated',()=>{
 const g=state(),m=createMotion(g);g.effects=[{type:'coin',time:0,id:1,lane:0,playerLane:2,attracted:true}];advanceMotion(m,g);advanceMotion(m,g);
 assert.equal(m.pickups.length,1);assert.equal(m.pickups[0].lane,0);assert.equal(m.pickups[0].playerLane,2);assert.equal(pickupProgress(m.pickups[0],.31),.5);
 g.time=.7;advanceMotion(m,g);assert.equal(m.pickups.length,0);
});
test('presentation buffers stay bounded under many pickups and impacts',()=>{
 const g=state(),m=createMotion(g);g.effects=Array.from({length:200},(_,i)=>({id:i+1,type:i%2?'coin':'hit',time:0}));advanceMotion(m,g);
 assert.equal(m.pickups.length,18);assert.equal(m.bursts.length,12);g.time=1;advanceMotion(m,g);assert.deepEqual(m.pickups,[]);assert.deepEqual(m.bursts,[]);
});
test('live reduced motion chooses exact poses and clears optional particles',()=>{
 const g=state(),m=createMotion(g);g.time=.02;g.action='duck';g.effects=[{type:'coin',time:0,id:1},{type:'hit',time:0,id:2}];advanceMotion(m,g);advanceMotion(m,g,true);
 assert.deepEqual(m.weights,[0,0,1]);assert.deepEqual(m.pickups,[]);assert.deepEqual(m.bursts,[]);assert.equal(paddleFrame(100,true),0);assert.equal(impactPulse(m,.02,true),0);assert.equal(landingPulse(m,.02,true),0);
});
test('each completed jump emits one landing without scoring or changing the action window',()=>{
 const g=Object.assign(createGame(1),{entities:[],nextRow:1e9});applyAction(g,'jump');
 for(let i=0;i<53;i++)updateGame(g,emptyInput(),1/60);
 assert.equal(g.action,'');assert.equal(g.effects.filter(e=>e.type==='land').length,1);assert.equal(g.bonus,0);assert.equal(g.coins,0);
 for(let i=0;i<6;i++)updateGame(g,emptyInput(),1/60);assert.equal(g.effects.filter(e=>e.type==='land').length,1);
});
