import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,callFlock,toggleDive,birdPosition,distance,HOME} from '../../public/echo/crossing.js';
const advance=(r,seconds)=>{for(let t=0;t<seconds;t+=.01){step(r,.01);r.events.length=0;}};
const quiet=()=>{const r=createRun();r.rocks=[];r.boatTimer=999;r.eel.active=true;r.eel.stun=999;return r;};
const carry=(r,n)=>{r.flock=[];for(let i=0;i<n;i++){r.chicks[i].state='following';r.flock.push(i);}};
test('movement works on both axes; flock follows the path with delay',()=>{
 const r=quiet();carry(r,2);r.target={x:.8,y:.6};advance(r,.3);
 assert.ok(r.x>.5&&r.y>.28);const b=birdPosition(r,2);assert.equal(b.x,.5);assert.equal(b.y,.28);
 advance(r,.8);assert.ok(birdPosition(r,2).y>.28);
});
test('surface pickups join once; underwater pickups cannot rescue chicks',()=>{
 const r=quiet();r.chicks[0].x=r.x;r.chicks[0].y=r.y;toggleDive(r);step(r,.01);assert.equal(r.flock.length,0);
 toggleDive(r);step(r,.01);assert.deepEqual(r.flock,[0]);step(r,.01);assert.deepEqual(r.flock,[0]);
});
test('nest banks a group, heals, and rewards larger risky deliveries',()=>{
 const r=quiet();carry(r,3);r.x=HOME.x;r.y=HOME.y;r.target={...HOME};r.hearts=2;advance(r,.7);
 assert.equal(r.saved,3);assert.equal(r.flock.length,0);assert.equal(r.score,900);assert.equal(r.hearts,3);assert.equal(r.trips,1);
 assert.ok(r.chicks.slice(0,3).every(c=>c.state==='saved'));advance(r,1);assert.equal(r.score,900);
});
test('diving has limited breath, forced surfacing, and a recovery lock',()=>{
 const r=quiet();assert.equal(toggleDive(r),true);advance(r,3.01);
 assert.equal(r.diving,false);assert.equal(r.exhausted,true);assert.equal(toggleDive(r),false);
 advance(r,1.6);assert.equal(r.exhausted,false);assert.equal(toggleDive(r),true);
});
test('rocks block and hurt at the surface, but a dive passes underneath',()=>{
 const r=quiet();r.rocks=[{x:.5,y:.35}];r.target={x:.5,y:.5};advance(r,.5);assert.equal(r.hearts,2);assert.ok(r.y<.32);
 toggleDive(r);advance(r,1.2);assert.ok(r.y>.45);assert.equal(r.hearts,2);
});
test('honk stuns a nearby eel, gathers chicks, and cannot be spammed or used submerged',()=>{
 const r=quiet();r.eel.x=r.x+.1;r.eel.y=r.y;r.chicks[0].x=r.x+.17;r.chicks[0].y=r.y;
 assert.equal(callFlock(r),true);assert.equal(r.eel.stun,2.4);assert.equal(callFlock(r),false);advance(r,.8);assert.ok(r.flock.includes(0));
 advance(r,7);toggleDive(r);assert.equal(callFlock(r),false);
});
test('eel hit scatters recoverable chicks and grants damage grace',()=>{
 const r=quiet();r.y=.5;r.target={x:r.x,y:r.y};r.history=[{t:0,x:r.x,y:r.y,angle:0}];carry(r,3);r.eel.stun=0;r.eel.x=r.x;r.eel.y=r.y;r.eel.aim={x:r.x,y:r.y};step(r,.01);
 assert.equal(r.hearts,2);assert.equal(r.flock.length,1);assert.equal(r.chicks.filter(c=>c.state==='waiting').length,7);
 step(r,.01);assert.equal(r.hearts,2);assert.ok(r.chicks[2].lock>0);
});
test('diving breaks eel targeting; nest protects the family',()=>{
 const r=quiet();r.y=.5;r.target={x:r.x,y:r.y};r.eel.stun=0;r.eel.x=.7;r.eel.y=.65;r.eel.aim={x:.6,y:.6};r.eel.timer=2;toggleDive(r);step(r,.01);
 assert.deepEqual(r.eel.aim,{x:.6,y:.6});
 r.diving=false;r.x=HOME.x;r.y=HOME.y;r.target={...HOME};r.eel.x=r.x;r.eel.y=r.y;step(r,.01);assert.equal(r.hearts,3);
});
test('submerged snacks add points and reduce honk cooldown only once',()=>{
 const r=quiet();r.fish=[{x:r.x,y:r.y,cooldown:0}];r.cooldown=5;toggleDive(r);step(r,.01);
 assert.equal(r.score,25);assert.ok(r.cooldown<3.01);step(r,.01);assert.equal(r.score,25);
});
test('all eight delivered wins; exhaustion loses; ended runs cannot change',()=>{
 const r=quiet();carry(r,8);r.x=HOME.x;r.y=HOME.y;r.target={...HOME};advance(r,.7);assert.equal(r.won,true);assert.equal(r.saved,8);
 const score=r.score;advance(r,1);assert.equal(r.score,score);assert.equal(callFlock(r),false);assert.equal(toggleDive(r),false);
 const tired=quiet();tired.hearts=1;tired.rocks=[{x:tired.x,y:tired.y}];step(tired,.01);assert.equal(tired.ended,true);assert.equal(tired.won,false);
});
test('map seeds preserve eight recoverable chicks and bounded movement',()=>{
 for(const seed of [1,7,42,1000]){const r=quiet();const map=createRun(seed);assert.equal(map.chicks.length,8);assert.ok(map.chicks.every(c=>c.x>=.1&&c.x<=.9));r.target={x:99,y:-99};advance(r,8);assert.ok(r.x<=.9&&r.y>=.19);assert.ok(distance(r,HOME)>=0);}
});
test('boats warn before moving and hit surface birds, not submerged birds',()=>{
 const r=quiet();r.y=.5;r.target={x:r.x,y:r.y};r.boats=[{x:r.x,y:r.y,direction:1,age:0}];step(r,.01);assert.equal(r.hearts,3);
 r.boats[0].age=1.6;step(r,.01);assert.equal(r.hearts,2);
 r.invincible=0;toggleDive(r);r.boats[0].x=r.x;step(r,.01);assert.equal(r.hearts,2);
});
test('eel locks its lunge direction during the warning instead of tracking an unavoidable hit',()=>{
 const r=quiet();r.y=.5;r.target={x:r.x,y:r.y};r.eel.stun=0;r.eel.x=.65;r.eel.y=.5;r.eel.timer=0;step(r,.01);
 assert.equal(r.eel.phase,'windup');const aim={...r.eel.aim};r.target={x:.25,y:.7};advance(r,.4);assert.deepEqual(r.eel.aim,aim);assert.equal(r.hearts,3);
});
test('a full rescue is achievable using movement, dives, and honks with all hazards enabled',()=>{
 const r=createRun(42);let targetId=null;
 for(let i=0;i<10000&&!r.ended;i++){
   if(r.flock.length){targetId=null;r.target={...HOME};}
   else{if(targetId===null||r.chicks[targetId].state!=='waiting')targetId=r.chicks.filter(c=>c.state==='waiting').sort((a,b)=>distance(r,a)-distance(r,b))[0]?.id??null;if(targetId!==null)r.target={x:r.chicks[targetId].x,y:r.chicks[targetId].y};}
   const rock=r.rocks.some(o=>distance(r,o)<.15),enemy=distance(r,r.eel)<.22;
   if(enemy&&r.cooldown===0&&!r.diving)callFlock(r);
   if((rock||enemy)&&r.breath>1.3&&!r.diving&&!r.exhausted)toggleDive(r);
   if(r.diving&&!rock&&!enemy&&distance(r,r.target)<.12)toggleDive(r);
   step(r,.01);r.events.length=0;
   assert.equal(r.chicks.filter(c=>c.state==='waiting').length+r.flock.length+r.saved,8);
 }
 assert.equal(r.won,true);assert.equal(r.saved,8);assert.ok(r.hearts>0);assert.ok(r.elapsed<100);
});
