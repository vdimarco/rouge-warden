import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,applyAction,updateGame,jumpHeight,timeToImpact,JUMP_SECONDS,DUCK_SECONDS,speedAt,COIN_LANE_RADIUS,restartLevel} from '../src/game/engine.js';
import {createMotion,advanceMotion,paddleSample} from '../src/game/motion.js';
import {readSwipe} from '../src/game/input.js';
import {renderDpr,foamDepth,riverRate} from '../src/game/quality.js';
const clean=()=>Object.assign(createGame(1),{entities:[],nextRow:1e9});
test('lane responds immediately and settles within 150ms at 30, 60 and 120Hz',()=>{
 for(const hz of [30,60,120]){const g=clean();applyAction(g,'right');assert.equal(g.lane,2);for(let i=0;i<Math.ceil(hz*.15);i++)updateGame(g,emptyInput(),1/hz);assert.ok(Math.abs(g.visualLane-2)<.05);}
});
test('short actions begin visibly on first update, cancel immediately, expire and buffer near landing',()=>{
 const g=clean();applyAction(g,'jump');updateGame(g,emptyInput(),1/60);assert.ok(jumpHeight(g)>.09);const m=advanceMotion(createMotion(g),g);assert.deepEqual(m.weights,[0,1,0]);
 applyAction(g,'duck');advanceMotion(m,g);assert.deepEqual(m.weights,[0,0,1]);assert.equal(g.actionTime,0);
 for(let i=0;i<Math.ceil(DUCK_SECONDS*60)+1;i++)updateGame(g,emptyInput(),1/60);assert.equal(g.action,'');
 applyAction(g,'jump');for(let i=0;i<Math.floor((JUMP_SECONDS-.1)*60);i++)updateGame(g,emptyInput(),1/60);applyAction(g,'jump');for(let i=0;i<10;i++)updateGame(g,emptyInput(),1/60);assert.equal(g.action,'jump');assert.ok(g.actionTime<.15);
});
test('impact forecast accounts for speed changes when Rush ends, including cap speed',()=>{
 for(const index of [0,1,2])for(const t of [0,60,200]){const g=Object.assign(createGame(1,index),{entities:[],nextRow:1e9,time:t,rush:.1,speed:speedAt(t,index)*1.32});const d=g.distance+g.speed*.6,predicted=timeToImpact(g,d);assert.ok(predicted>.6);let elapsed=0;while(g.distance<d){updateGame(g,emptyInput(),1/240);elapsed+=1/240;}assert.ok(Math.abs(elapsed-predicted)<.009,`map ${index}, ${t}s forecast differs by ${elapsed-predicted}`);}
});
test('swipes respond at 26px, chain a deliberate lane step, lock axis and consume vertical actions once',()=>{
 const p={x:0,y:0};assert.equal(readSwipe(p,25,0),null);const first=readSwipe(p,26,0);assert.equal(first.action,'right');assert.equal(readSwipe(first.next,70,120),null);const second=readSwipe(first.next,82,120);assert.equal(second.action,'right');const up=readSwipe(p,0,-26);assert.equal(up.action,'jump');assert.equal(up.next,null);assert.equal(readSwipe(null,0,-60),null);
});
test('forward foam approaches like hazards and paddle interpolation remains continuous at wrap',()=>{
 const z=foamDepth(1,0,140);assert.ok(Math.abs(foamDepth(1,10,140)-(z-10))<1e-9);assert.ok(foamDepth(0,1,140)>138);
 const a=paddleSample(19.99),b=paddleSample(20);assert.equal(a.index,7);assert.equal(a.next,0);assert.ok(a.blend>.99);assert.equal(b.index,0);assert.equal(b.blend,0);assert.equal(paddleSample(123,true).index,0);
});
test('render budget covers retina and large screens; Rush raises river speed within a bound',()=>{
 for(const [w,h,dpr]of [[390,844,2],[1536,1024,2],[3840,2160,2]]){const ratio=renderDpr(w,h,dpr);assert.ok(w*h*ratio*ratio<=1200001);assert.ok(ratio<=dpr);}
 assert.ok(riverRate(55.44)>riverRate(42));assert.ok(riverRate(999)<=1.25);
});

test('a jump tapped on the collision frame clears a log and its raised coin without spending protection',()=>{
 const g=clean();g.entities=[{id:101,type:'coin',lane:1,d:.2,high:true},{id:102,type:'log',lane:1,d:.2}];applyAction(g,'jump');updateGame(g,emptyInput(),1/60);
 assert.ok(jumpHeight(g)<.28);assert.equal(g.phase,'playing');assert.equal(g.shield,true);assert.equal(g.jumps,1);assert.equal(g.coins,1);
 const rock=clean();rock.shield=false;rock.entities=[{id:103,type:'rock',lane:1,d:.2}];applyAction(rock,'jump');updateGame(rock,emptyInput(),1/60);assert.equal(rock.phase,'lost');
});

// Constant cap speed makes the longitudinal crossing identical at every
// refresh rate, so these cases measure steering/height rather than integration.
const coinRun=(hz,{lane=1,target=1,position=1,velocity=0,at=.02,action='',actionTime=0,high=false,magnet=0,rush=0}={})=>{
 const g=Object.assign(clean(),{time:1000,lane:target,visualLane:position,laneVelocity:velocity,action,actionTime,magnet,rush,goal:{kind:'tricks',start:0,target:1e9}});
 const coin={id:601,type:'coin',lane,d:speedAt(g.time)*(rush?1.32:1)*at,high,done:false};g.entities=[coin];
 const before=g.eventId;for(let elapsed=0;elapsed<at+.002;elapsed+=1/hz)updateGame(g,emptyInput(),1/hz);
 return{g,coin,events:g.effects.filter(e=>e.id>before&&e.type==='coin')};
};

test('ordinary coins need tight visible center overlap at the crossing, at 30/60/120 Hz',()=>{
 assert.equal(COIN_LANE_RADIUS,.25);
 for(const hz of [30,60,120]){
  for(const setup of [{lane:2},{lane:2,target:2,at:.025},{position:1.30,target:1,at:.0005}]){
   const {g,coin,events}=coinRun(hz,setup);
   assert.equal(g.coins,0,`${hz} Hz awarded an adjacent coin`);assert.equal(g.bonus,0);assert.equal(g.charge,0);assert.equal(g.streak,0);
   assert.equal(coin.done,true);assert.notEqual(coin.collected,true);assert.equal(events.length,0,'a miss emitted pickup feedback');
   assert.ok(g.entities.includes(coin),'a missed coin disappeared before the normal behind limit');
  }
  const {g,coin,events}=coinRun(hz,{lane:2,target:2,at:.15});
  assert.equal(g.coins,1,`${hz} Hz missed a real arrival`);assert.equal(coin.collected,true);assert.equal(events.length,1);assert.equal(events[0].attracted,false);
  assert.ok(Math.abs(events[0].playerLane-2)<COIN_LANE_RADIUS);
  const crossing=coinRun(hz,{lane:1,target:2,at:.003});
  assert.equal(crossing.g.coins,1,'the raft crossed a coin in the lane it was leaving');assert.equal(crossing.coin.collected,true);
 }
});

test('steering reversal preserves the same swept coin result across refresh rates',()=>{
 for(const hz of [30,60,120]){
  const g=Object.assign(clean(),{time:1000});applyAction(g,'right');
  for(let elapsed=0;elapsed<.09;){const dt=Math.min(1/hz,.09-elapsed);updateGame(g,emptyInput(),dt);elapsed+=dt;}
  const reversal={position:g.visualLane,velocity:g.laneVelocity,lane:2,target:1};
  const early=coinRun(hz,{...reversal,at:.005});
  assert.equal(early.g.coins,1,`${hz} Hz failed the still-overlapping reversal`);assert.equal(early.coin.collected,true);
  const late=coinRun(hz,{...reversal,at:.08});
  assert.equal(late.g.coins,0,`${hz} Hz collected after steering away`);assert.equal(late.events.length,0);assert.notEqual(late.coin.collected,true);
 }
});

test('raised coins use jump height at their crossing and retain the timely launch reward',()=>{
 for(const hz of [30,60,120]){
  for(const setup of [{high:true},{high:true,action:'duck',actionTime:.2},{high:true,action:'jump',actionTime:.65}]){
   const result=coinRun(hz,setup);assert.equal(result.g.coins,0,`${hz} Hz awarded a raised coin without a jump`);assert.equal(result.events.length,0);
  }
  for(const setup of [{high:true,action:'jump',at:.005},{high:true,action:'jump',actionTime:.3}]){
   const result=coinRun(hz,setup);assert.equal(result.g.coins,1);assert.equal(result.coin.collected,true);
  }
 }
});

test('a nearly expired buffered jump agrees with the rendered launch on a raised-coin crossing',()=>{
 const g=Object.assign(clean(),{time:1000,action:'jump',actionTime:JUMP_SECONDS-.03,buffered:'jump',bufferTime:.01});
 const coin={id:710,type:'coin',lane:1,d:speedAt(g.time)*.04,high:true,done:false};g.entities=[coin];
 updateGame(g,emptyInput(),.05);
 assert.equal(g.action,'jump');assert.equal(g.actionTime,0);assert.equal(g.coins,1);assert.equal(coin.collected,true);
 assert.equal(g.effects.filter(e=>e.type==='coin').length,1);
});

test('magnet and Rush are explicit pickup exceptions, expire at crossing and reset on retry',()=>{
 for(const hz of [30,60,120])for(const power of ['magnet','rush']){
  const active=coinRun(hz,{lane:0,high:true,[power]:.01,at:.005});
  assert.equal(active.g.coins,1);assert.equal(active.coin.collected,true);assert.equal(active.events[0].attracted,true);
  if(power==='rush')assert.equal(active.g.charge,0,'a pickup during the final Rush frame recharged Rush');
  const expired=coinRun(hz,{lane:0,high:true,[power]:.01,at:.02});assert.equal(expired.g.coins,0);assert.equal(expired.events.length,0);
  const retry=restartLevel(active.g);assert.equal(retry.magnet,0);assert.equal(retry.rush,0);assert.equal(retry.coins,0);assert.ok(retry.entities.every(e=>!e.done&&!e.collected));
 }
});

test('a missed coin passes once and leaves normally without awarding later lane changes',()=>{
 const {g,coin}=coinRun(60,{lane:2});applyAction(g,'right');
 for(let i=0;i<20;i++)updateGame(g,emptyInput(),1/60);
 assert.equal(g.coins,0);assert.notEqual(coin.collected,true);assert.equal(g.entities.includes(coin),false);
 assert.equal(g.effects.some(e=>e.type==='coin'),false);
});
