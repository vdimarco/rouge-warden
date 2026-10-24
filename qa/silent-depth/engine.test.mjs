import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, command, step, fire, fireStatus, selectContact, intercept, distance, bearing, angleDiff, wrap} from '../../public/silent-depth/engine.js';

function advance(g,seconds){for(let t=0;t<seconds;t+=.25)step(g,Math.min(.25,seconds-t));}
function underway(){const g=createGame();command(g,'start');command(g,'station','scope');return g;}

test('bearings wrap correctly across north',()=>{
  assert.equal(wrap(-5),355);assert.equal(angleDiff(2,358),4);
  assert.equal(bearing({x:0,z:0},{x:1,z:0}),90);
});
test('intercept leads a moving target and rejects an unreachable one',()=>{
  const sub={x:0,z:0},target={x:700,z:1200,heading:270,speed:6};
  const aim=intercept(sub,target);
  assert.ok(aim.x<target.x);assert.ok(aim.time>0);
  assert.ok(Math.abs(distance(sub,aim)-23*aim.time)<.001);
  assert.equal(intercept(sub,{x:0,z:1000,heading:0,speed:70}),null);
});
test('briefing and pause freeze the complete simulation',()=>{
  const g=createGame();advance(g,20);assert.equal(g.time,0);
  command(g,'start');advance(g,3);command(g,'pause');
  const snapshot=JSON.stringify(g);advance(g,30);assert.equal(JSON.stringify(g),snapshot);
  command(g,'pause');advance(g,1);assert.ok(g.time>3);
});
test('solution is earned through observation; submerged fire is blocked',()=>{
  const g=underway();assert.equal(fire(g),false);
  advance(g,13);assert.ok(g.solution>=75);assert.equal(fireStatus(g),'');
  g.sub.depth=40;assert.equal(fire(g),false);assert.match(fireStatus(g),/depth/);
  g.sub.depth=12;selectContact(g,2);assert.equal(g.solution,0);
  assert.equal(selectContact(g,999),false);
});
test('launch spends ammunition, reloads a tube and hits a moving merchant',()=>{
  const g=underway();advance(g,13);assert.equal(fire(g),true);
  assert.equal(g.ammo,7);assert.ok(g.tubes[0]>0);assert.equal(g.torpedoes.length,1);
  advance(g,85);assert.equal(g.ships[0].sunk,true);assert.equal(g.sunk,1);assert.equal(g.tonnage,4800);assert.equal(g.tubes[0],0);
});
test('torpedoes run straight and can miss a target that changes course',()=>{
  const g=underway();g.ships=g.ships.slice(0,1);advance(g,13);fire(g);
  const course=g.torpedoes[0].heading;g.ships[0].heading=90;
  advance(g,20);assert.equal(g.torpedoes[0].heading,course);
  advance(g,230);assert.equal(g.ships[0].sunk,false);assert.equal(g.torpedoes.length,0);
});
test('tube cooldown and empty ammunition block firing',()=>{
  const g=underway();advance(g,13);
  for(let i=0;i<4;i++)assert.equal(fire(g),true);
  assert.equal(fire(g),false);assert.match(fireStatus(g),/reloading/);
  advance(g,39);assert.equal(fire(g),true);
  g.ammo=0;assert.equal(fire(g),false);
});
test('escort pursues a detected position and depth charges damage the boat',()=>{
  const g=underway(),e=g.ships.find(s=>s.type==='escort');
  e.x=0;e.z=20;e.cooldown=0;g.alert=70;g.lastKnown={x:0,z:0};
  advance(g,4);assert.equal(e.speed,19);assert.ok(g.sub.hull<100);assert.ok(g.log.some(l=>l.text.includes('Depth charge blast')));
});
test('silent deep running reduces detection; surfacing replenishes resources',()=>{
  const g=underway();g.sub.depth=80;g.sub.orderedDepth=80;g.alert=80;
  advance(g,10);assert.ok(g.alert<60);
  g.sub.depth=0;g.sub.orderedDepth=0;g.sub.air=60;g.sub.battery=60;
  advance(g,10);assert.ok(g.sub.air>60);assert.ok(g.sub.battery>60);
});
test('a complete two-merchant attack and quiet escape is winnable',()=>{
  const g=underway();advance(g,13);assert.equal(fire(g),true);
  selectContact(g,2);advance(g,13);assert.equal(fire(g),true);
  command(g,'depth',80);command(g,'speed',3);
  for(let i=0;i<350&&g.phase==='playing';i++)advance(g,1);
  assert.equal(g.phase,'won',g.log.map(e=>e.text).join('\n'));
  assert.equal(g.sunk,2);assert.equal(g.tonnage,11000);assert.ok(g.sub.hull>0);assert.ok(g.escape>=40);
});
test('all five patrol variations can be won with the basic attack',()=>{
  for(let seed=0;seed<5;seed++){
    const g=createGame(seed);command(g,'start');command(g,'station','scope');advance(g,13);fire(g);selectContact(g,2);advance(g,13);fire(g);command(g,'depth',80);
    for(let t=0;t<400&&g.phase==='playing';t++)advance(g,1);
    assert.equal(g.phase,'won',`Patrol ${seed}: ${g.result}`);
  }
});
test('hull loss, exhausted torpedoes and patrol deadline end the game',()=>{
  for(const cause of ['hull','ammo','time']){
    const g=underway();if(cause==='hull')g.sub.hull=0;if(cause==='ammo')g.ammo=0;if(cause==='time')g.time=1079.9;
    advance(g,1);assert.equal(g.phase,'lost');const time=g.time;advance(g,10);assert.equal(g.time,time);
  }
});
test('invalid timing and unsupported control values do not poison state',()=>{
  const g=underway();for(const t of [NaN,Infinity,-1,0])step(g,t);assert.equal(g.time,0);
  command(g,'speed',Infinity);command(g,'depth',-80);command(g,'course',NaN);
  assert.equal(g.sub.orderedSpeed,3);assert.equal(g.sub.orderedDepth,12);assert.equal(g.sub.orderedHeading,0);
});


test('control room preserves orders and a lowered scope stops observation',()=>{
  const g=underway();advance(g,13);const solution=g.solution;
  command(g,'course',90);command(g,'station','command');command(g,'periscope',false);advance(g,2);
  assert.equal(g.station,'command');assert.equal(g.sub.orderedHeading,90);assert.ok(g.sub.heading>0);assert.ok(g.solution<solution);
  command(g,'station','scope');assert.equal(g.periscopeRaised,true);advance(g,3);assert.ok(g.solution>solution-4);
});
test('torpedo control fires the individually selected tube',()=>{
  const g=underway();advance(g,13);command(g,'station','torpedo');command(g,'tube',2);
  assert.equal(fire(g),true);assert.ok(g.tubes[2]>0);assert.equal(g.tubes[0],0);assert.equal(g.ammo,7);
  command(g,'tube',2);assert.equal(fire(g),false);assert.match(fireStatus(g),/Tube 3/);
  command(g,'tube',9);assert.equal(g.armedTube,2);
});
