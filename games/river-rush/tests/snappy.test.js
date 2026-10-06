import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,emptyInput,applyAction,updateGame,jumpHeight,timeToImpact,JUMP_SECONDS,DUCK_SECONDS,speedAt} from '../src/game/engine.js';
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
 for(const t of [0,60,200]){const g=clean();g.time=t;g.rush=.1;g.speed=speedAt(t)*1.32;const d=g.distance+g.speed*.6,predicted=timeToImpact(g,d);assert.ok(predicted>.6);let elapsed=0;while(g.distance<d){updateGame(g,emptyInput(),1/240);elapsed+=1/240;}assert.ok(Math.abs(elapsed-predicted)<.009);}
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
