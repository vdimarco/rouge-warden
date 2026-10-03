import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,callFlock,toggleDive,birdPosition,distance,danger,lakeNumber,lakeSeed,shareLine,HOME,ROCK,GAP} from '../../public/echo/crossing.js';
const advance=(r,seconds)=>{for(let t=0;t<seconds;t+=.01){step(r,.01);r.events.length=0;}};
const quiet=()=>{const r=createRun();r.rocks=[];r.boatTimer=999;r.eel.active=true;r.eel.stun=999;return r;};
const carry=(r,n)=>{r.flock=[];for(let i=0;i<n;i++){r.chicks[i].state='following';r.flock.push(i);}};
const lunge=(e,at)=>{e.stun=0;e.phase='lunge';e.timer=.5;e.x=at.x;e.y=at.y;e.aim={x:at.x,y:at.y};};
test('movement works on both axes; flock follows the path with delay',()=>{
 const r=quiet();carry(r,2);r.target={x:.8,y:.6};advance(r,.3);
 assert.ok(r.x>.5&&r.y>.28);const b=birdPosition(r,2);assert.equal(b.x,.5);assert.equal(b.y,.28);
 advance(r,.8);assert.ok(birdPosition(r,2).y>.28);
});
test('the line keeps its spacing when the loon honks or stops, so the loon stays in sight',()=>{
 const r=quiet();carry(r,3);r.target={x:.5,y:.75};advance(r,1.2);assert.equal(callFlock(r),true);advance(r,.6);
 const gaps=()=>[1,2,3].map(i=>distance(birdPosition(r,i-1),birdPosition(r,i)));
 assert.ok(r.call>0,'the honk is still on');assert.ok(gaps().every(g=>g>GAP*.95),`gaps during a honk: ${gaps().map(g=>g.toFixed(3))}`);
 r.target={x:r.x,y:r.y};advance(r,3);assert.ok(gaps().every(g=>g>GAP*.95),`gaps at rest: ${gaps().map(g=>g.toFixed(3))}`);
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
test('rocks block at the surface and do no damage; a dive passes straight under',()=>{
 const r=quiet();r.rocks=[{x:.5,y:.35}];r.target={x:.5,y:.5};let closest=1,bonks=0;
 for(let t=0;t<2;t+=.01){step(r,.01);closest=Math.min(closest,distance(r,r.rocks[0]));bonks+=r.events.filter(e=>e.kind==='bonk').length;r.events.length=0;}
 assert.equal(r.hearts,3);assert.ok(closest>ROCK-1e-9,'the loon never goes into the rock');assert.equal(bonks,1,'one soft bonk for one touch');assert.ok(r.y>.45,'the loon slides round the rock to its target');
 const d=quiet();d.rocks=[{x:.5,y:.35}];d.target={x:.5,y:.5};toggleDive(d);advance(d,1.2);
 assert.equal(d.x,.5,'a dive goes straight under the rock');assert.ok(d.y>.45);assert.equal(d.hearts,3);
});
test('a target behind a rock for 7 s leaves 3 hearts and the loon past the rock',()=>{
 const r=quiet();r.rocks=[{x:.34,y:.47}];r.x=.2;r.y=.47;r.target={x:.5,y:.47};advance(r,7);
 assert.equal(r.hearts,3);assert.ok(r.x>.34+ROCK,'the loon is past the rock');assert.ok(distance(r,{x:.5,y:.47})<.01,'the loon reaches the target');
});
test('a target inside a rock stops the loon at the rim; surfacing in a rock pushes the loon out',()=>{
 const r=quiet();r.rocks=[{x:.5,y:.45}];r.target={x:.5,y:.46};advance(r,3);
 assert.ok(Math.abs(distance(r,r.rocks[0])-ROCK)<1e-6,'the loon waits at the rim');assert.ok(distance(r.target,r.rocks[0])>ROCK-1e-9,'the target moves out of the rock');assert.equal(r.hearts,3);
 const d=quiet();d.rocks=[{x:.5,y:.45}];toggleDive(d);d.x=.5;d.y=.45;d.target={x:.5,y:.45};step(d,.01);assert.ok(distance(d,d.rocks[0])<ROCK,'under water the loon can be below the rock');
 toggleDive(d);step(d,.01);assert.ok(distance(d,d.rocks[0])>ROCK-1e-9,'the loon comes up at the rim');assert.equal(d.hearts,3);
});
test('a honk or a hit never leaves a chick inside a rock',()=>{
 const r=quiet();r.rocks=[{x:.5,y:.45}];r.y=.36;r.target={x:r.x,y:r.y};r.chicks[0].x=.5;r.chicks[0].y=.53;callFlock(r);advance(r,1);
 assert.ok(distance(r.chicks[0],r.rocks[0])>ROCK-1e-9,'a honk pulls the chick only to the rim');
 const h=quiet();h.rocks=[{x:.5,y:.45}];h.x=.41;h.y=.38;h.target={x:h.x,y:h.y};carry(h,2);lunge(h.eel,h);step(h,.01);
 assert.equal(h.hearts,2);assert.ok(h.chicks.slice(0,2).every(c=>c.state==='waiting'&&distance(c,h.rocks[0])>ROCK-1e-9),'scattered chicks land outside the rock');
});
test('honk stuns a nearby eel, gathers chicks, and cannot be spammed or used submerged',()=>{
 const r=quiet();r.eel.x=r.x+.1;r.eel.y=r.y;r.chicks[0].x=r.x+.17;r.chicks[0].y=r.y;
 assert.equal(callFlock(r),true);assert.equal(r.eel.stun,2.4);assert.equal(callFlock(r),false);advance(r,.8);assert.ok(r.flock.includes(0));
 advance(r,7);toggleDive(r);assert.equal(callFlock(r),false);
});
test('an eel lunge costs energy, scatters recoverable chicks, and grants damage grace',()=>{
 const r=quiet();r.y=.5;r.target={x:r.x,y:r.y};r.trail=[{x:r.x,y:r.y,angle:0,d:0}];carry(r,3);lunge(r.eel,r);step(r,.01);
 assert.equal(r.hearts,2);assert.equal(r.flock.length,1);assert.equal(r.chicks.filter(c=>c.state==='waiting').length,7);
 step(r,.01);assert.equal(r.hearts,2);assert.ok(r.chicks[2].lock>0);
});
test('a hunting eel that touches the line takes one chick and costs no energy',()=>{
 const r=quiet();r.x=.3;r.y=.5;r.target={x:.8,y:.5};advance(r,1.5);carry(r,3);
 const tail=birdPosition(r,3);r.eel.stun=0;r.eel.timer=9;r.eel.x=tail.x;r.eel.y=tail.y;r.eel.aim={...tail};step(r,.01);
 assert.equal(r.hearts,3,'a nip costs no energy');assert.deepEqual(r.flock,[0,1],'the eel takes the chick it touches');assert.ok(r.events.some(e=>e.kind==='nip'));
 assert.equal(r.chicks[2].state,'waiting');assert.ok(r.chicks[2].lock>0);assert.ok(r.eel.stun>0,'the eel rests after a nip');
 const loon=quiet();loon.y=.5;loon.target={x:loon.x,y:loon.y};loon.eel.stun=0;loon.eel.timer=9;loon.eel.x=loon.x;loon.eel.y=loon.y;loon.eel.aim={x:loon.x,y:loon.y};advance(loon,.5);
 assert.equal(loon.hearts,3,'a hunting eel cannot hurt the loon; only a warned lunge can');
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
test('a full nest hatches the next clutch; only zero energy ends the run; ended runs cannot change',()=>{
 const r=quiet();const first=r.chicks.map(c=>[c.x,c.y]);carry(r,8);r.x=HOME.x;r.y=HOME.y;r.target={...HOME};r.hearts=1;
 for(let t=0;t<.7;t+=.01)step(r,.01);
 assert.equal(r.ended,false,'a full nest does not end the run');assert.equal(r.saved,8);assert.equal(r.clutch,2);assert.equal(r.home,0);
 assert.equal(r.score,6400,'the bank bonus stays 100 × 8²');assert.equal(r.hearts,3,'a full nest restores all energy');assert.ok(r.events.some(e=>e.kind==='clutch'&&e.clutch===2));
 assert.equal(r.chicks.length,8);assert.ok(r.chicks.every(c=>c.state==='waiting'));assert.notDeepEqual(r.chicks.map(c=>[c.x,c.y]),first,'the next clutch hatches at new spots');
 carry(r,5);r.x=HOME.x;r.y=HOME.y;r.target={...HOME};advance(r,.7);assert.equal(r.score,6400+2500,'clutch 2 keeps the n² bonus');assert.equal(r.home,5);
 const tired=quiet();tired.hearts=1;tired.y=.5;tired.target={x:tired.x,y:tired.y};tired.boats=[{x:tired.x,y:tired.y,direction:1,age:1.6}];step(tired,.01);
 assert.equal(tired.ended,true);assert.ok(tired.events.some(e=>e.kind==='end'&&e.cause==='boat'));
 const score=tired.score;advance(tired,1);assert.equal(tired.score,score);assert.equal(callFlock(tired),false);assert.equal(toggleDive(tired),false);
});
test('each clutch raises the danger, a second eel joins at clutch 3, and every strike keeps its warning',()=>{
 const r=quiet(),levels=[danger(r)];
 for(let k=2;k<=4;k++){carry(r,8);r.x=HOME.x;r.y=HOME.y;r.target={...HOME};advance(r,.7);assert.equal(r.clutch,k);levels.push(danger(r));if(k===2)assert.equal(r.eels.length,1);}
 for(let k=1;k<levels.length;k++){const a=levels[k-1],b=levels[k];assert.ok(b.hunt>a.hunt&&b.rest<a.rest&&b.lunge>a.lunge&&b.boatGap<a.boatGap,`clutch ${k+1} is more dangerous than clutch ${k}`);}
 assert.equal(levels[1].lanes,3,'boats use a third lane from clutch 2');assert.ok(levels[3].pairs>0,'boats come in pairs from clutch 4');
 assert.equal(r.eels.length,2,'clutch 3 brings a second eel');assert.ok(r.eels[1].active&&r.eels[1].stun>0,'the new eel wakes up slowly');
 for(let clutch=1;clutch<=60;clutch++)assert.ok(danger({clutch}).windup>=.3,`clutch ${clutch}: a strike comes at least 0.3 s after its warning`);
 assert.ok(danger({clutch:60}).eels<=6,'at most six eels');
});
test('the eels take turns, so two strikes never come at once',()=>{
 const r=quiet();r.y=.5;r.target={x:r.x,y:r.y};r.eel.stun=0;r.eel.timer=0;r.eel.x=.62;r.eel.y=.5;
 r.eels.push({...r.eel,x:.38,y:.5,aim:{x:.5,y:.5},trail:[]});let most=0;
 for(let t=0;t<4;t+=.01){step(r,.01);r.events.length=0;most=Math.max(most,r.eels.filter(e=>e.phase!=='hunt').length);r.invincible=1;}
 assert.equal(most,1,'only one eel winds up or lunges at a time');
});
test('map seeds preserve eight recoverable chicks and bounded movement',()=>{
 for(const seed of [1,7,42,1000]){const r=quiet();const map=createRun(seed);assert.equal(map.chicks.length,8);assert.ok(map.chicks.every(c=>c.x>=.1&&c.x<=.9));r.target={x:99,y:-99};advance(r,8);assert.ok(r.x<=.9&&r.y>=.19);assert.ok(distance(r,HOME)>=0);}
});
const lakeOf=r=>JSON.stringify({rocks:r.rocks,fish:r.fish,lanes:r.lanes,chicks:r.chicks.map(c=>[c.x,c.y])});
const fillNest=r=>{carry(r,8);r.x=HOME.x;r.y=HOME.y;r.target={...HOME};r.eels.forEach(e=>{e.active=false;e.stun=1e9;});r.boatTimer=1e9;advance(r,.7);};
test('the same seed gives the same lake: rocks, fish, boat lanes and chick spots',()=>{
 for(const seed of [lakeSeed(1),lakeSeed(276),7]){
  const a=createRun(seed),b=createRun(seed);assert.equal(lakeOf(a),lakeOf(b));
  fillNest(a);fillNest(b);assert.equal(a.clutch,2);assert.equal(lakeOf(a),lakeOf(b),'the next clutch hatches at the same spots');
 }
 const play=seed=>{const r=createRun(seed);for(let i=0;i<4000;i++){if(i%300===0)r.target={x:.2+(i%7)*.1,y:.3+(i%5)*.1};step(r,.01);r.events.length=0;}
  return JSON.stringify({x:r.x,y:r.y,boats:r.boats,eels:r.eels.map(e=>[e.x,e.y,e.phase]),hearts:r.hearts});};
 assert.equal(play(lakeSeed(5)),play(lakeSeed(5)),'the same seed and the same moves give the same run, boats and eels too');
 const lakes=new Set(),rocks=new Set();for(let n=1;n<=100;n++){const r=createRun(lakeSeed(n));lakes.add(lakeOf(r));rocks.add(r.rocks.length);}
 assert.equal(lakes.size,100,'each of 100 days has its own lake');assert.deepEqual([...rocks].sort(),[2,3,4],'a lake has two to four rocks');
});
test('across 100 seeds every chick is reachable and none sits in a rock',()=>{
 const reach=(seed,spot)=>{const s=createRun(seed);s.eel.stun=1e9;s.boatTimer=1e9;s.chicks.forEach(c=>c.state='saved');s.x=HOME.x;s.y=HOME.y;s.target={x:spot.x,y:spot.y};
  for(let t=0;t<8;t+=.02){step(s,.02);s.events.length=0;if(distance(s,spot)<.065)return true;}return false;};
 for(let n=1;n<=100;n++){
  const seed=lakeSeed(n),r=createRun(seed);
  assert.ok(r.rocks.length>=2&&r.rocks.length<=4,`lake ${n}: two to four rocks`);
  assert.ok(r.fish.length===6&&r.fish.every(f=>r.rocks.every(k=>distance(f,k)>ROCK)),`lake ${n}: six fish, none in a rock`);
  assert.ok(r.lanes.length===3&&[...r.lanes].sort().every((y,i,a)=>!i||y-a[i-1]>.09),`lake ${n}: three boat lanes, well apart`);
  for(let clutch=1;clutch<=3;clutch++){
   assert.equal(r.clutch,clutch);assert.equal(r.chicks.length,8);
   for(const c of r.chicks){
    assert.ok(r.rocks.every(k=>distance(c,k)>ROCK+.04),`lake ${n}, clutch ${clutch}: chick ${c.id} sits clear of every rock`);
    assert.ok(c.x>=.1&&c.x<=.9&&c.y>=.19&&c.y<=.82,`lake ${n}, clutch ${clutch}: chick ${c.id} is in the swim area`);
    assert.ok(reach(seed,c),`lake ${n}, clutch ${clutch}: the loon swims from the nest to chick ${c.id}`);
   }
   fillNest(r);
  }
 }
});
test('lake numbers count days from 1 January 2026, and the share line reads well',()=>{
 assert.equal(lakeNumber('2026-01-01'),1);assert.equal(lakeNumber('2026-10-03'),276);assert.equal(lakeNumber('2027-01-01'),366);assert.equal(lakeNumber('not a day'),1);
 assert.notEqual(lakeSeed(276),lakeSeed(277));
 const r=quiet();r.clutch=3;r.saved=21;r.elapsed=134.6;assert.equal(shareLine(r,278),'Lake #278 · 3 clutches · 21 home · 2:14');
 r.clutch=1;r.saved=5;r.elapsed=59.9;assert.equal(shareLine(r,9),'Lake #9 · 1 clutch · 5 home · 0:59');
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
test('the first clutch can be brought home using movement, dives, and honks with all hazards enabled',()=>{
 const r=createRun(42);let targetId=null;
 for(let i=0;i<10000&&!r.ended&&r.clutch===1;i++){
   if(r.flock.length){targetId=null;r.target={...HOME};}
   else{if(targetId===null||r.chicks[targetId].state!=='waiting')targetId=r.chicks.filter(c=>c.state==='waiting').sort((a,b)=>distance(r,a)-distance(r,b))[0]?.id??null;if(targetId!==null)r.target={x:r.chicks[targetId].x,y:r.chicks[targetId].y};}
   const rock=r.rocks.some(o=>distance(r,o)<.15),enemy=distance(r,r.eel)<.22;
   if(enemy&&r.cooldown===0&&!r.diving)callFlock(r);
   if((rock||enemy)&&r.breath>1.3&&!r.diving&&!r.exhausted)toggleDive(r);
   if(r.diving&&!rock&&!enemy&&distance(r,r.target)<.12)toggleDive(r);
   step(r,.01);r.events.length=0;
   assert.equal(r.chicks.filter(c=>c.state==='waiting').length+r.flock.length+r.home,8);
 }
 assert.equal(r.clutch,2);assert.equal(r.saved,8);assert.ok(r.hearts>0);assert.ok(r.elapsed<100);
});
