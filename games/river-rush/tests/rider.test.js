import test from 'node:test';
import assert from 'node:assert/strict';
import {riderPose} from '../src/game/rider.js';
import {createGame,applyAction,updateGame,emptyInput} from '../src/game/engine.js';
test('chained real inputs select distinct downstream action art immediately',()=>{
 const g=Object.assign(createGame(1),{entities:[],nextRow:1e9});
 applyAction(g,'jump');assert.deepEqual(riderPose(g),{name:'jump',index:4,direction:'downstream'});
 applyAction(g,'duck');assert.deepEqual(riderPose(g),{name:'duck',index:8,direction:'downstream'});
 for(let i=0;i<40;i++)updateGame(g,emptyInput(),1/60);
 assert.equal(riderPose(g).name,'paddle');assert.ok([0,1,3].includes(riderPose(g).index));
});
test('pose cadence freezes with simulation and reduced motion retains duck anatomy',()=>{
 const g={distance:42,action:'duck'};const frozen=riderPose(g);
 assert.deepEqual(riderPose(g,true),frozen);
 for(let i=0;i<100;i++)assert.deepEqual(riderPose(g),frozen);
 g.action='';assert.equal(riderPose(g,true).index,0);
 const ride=Array.from({length:120},(_,i)=>riderPose({action:'',distance:i}).index);
 assert.deepEqual([...new Set(ride)].sort(),[0,1,3]);
});
