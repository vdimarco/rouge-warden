import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,updateGame} from '../src/game/engine.js';
import {unplayedEffects,advanceWipeout} from '../src/game/run-feedback.js';

test('every touched coin survives another event in the same frame; missed side coins are silent',()=>{
 const g=createGame(73),input=emptyInput();
 Object.assign(g,{entities:[{id:901,type:'coin',lane:1,d:1},{id:902,type:'coin',lane:1,d:1.2},{id:903,type:'coin',lane:0,d:1.3}],nextRow:1e9,goal:{kind:'coins',start:0,target:2}});
 const before=g.eventId;updateGame(g,input,.05);
 assert.equal(g.event,'goal');assert.equal(g.coins,2);
 const cues=unplayedEffects(g,before);
 assert.deepEqual(cues.map(e=>e.type),['coin','coin','goal']);
 assert.deepEqual(cues.filter(e=>e.type==='coin').map(e=>e.entityId),[901,902]);
 assert.deepEqual(unplayedEffects(g,g.eventId),[]);
});

test('the wipeout clock is bounded, holds on pause, and never touches frozen contact state',()=>{
 for(const hz of [30,60,120]){
  const g=createGame(17);Object.assign(g,{shield:false,entities:[{id:990,type:'rock',lane:1,d:1}],nextRow:1e9});
  updateGame(g,emptyInput(),.05);assert.equal(g.phase,'lost');
  const frozen={time:g.time,distance:g.distance,lane:g.visualLane,score:g.score};
  let elapsed=0;for(let frame=0;frame<hz;frame++)elapsed=advanceWipeout(elapsed,1/hz);
  assert.equal(elapsed,.6);assert.equal(advanceWipeout(.2,0),.2);
  assert.deepEqual({time:g.time,distance:g.distance,lane:g.visualLane,score:g.score},frozen);
 }
 assert.equal(advanceWipeout(0,10),.6);assert.equal(advanceWipeout(.2,NaN),.2);
 // A slow graphics frame must not stretch the sound-synchronized beat.
 assert.equal(advanceWipeout(.5,.1),.6);
});
