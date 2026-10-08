import test from 'node:test';
import assert from 'node:assert/strict';
import {encounterProjection,projection} from '../src/game/render.js';
import {encounterMotion,entityPose} from '../src/game/moving-encounters.js';

const layouts=[[390,844],[360,640],[1440,900],[844,390]];
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} differs from ${expected}`);
const enemy=(kind,lane=1,seed=1,map=0)=>({id:7,type:kind==='bird'?'branch':'log',enemy:kind,lane,d:500,motion:encounterMotion(lane,500,120,kind,seed,map)});

test('fallback wildlife bodies and water-plane contact guides follow shared physical poses on every layout',()=>{
 for(const [width,height] of layouts)for(const kind of ['crocodile','bird','fish'])for(const lane of [0,1,2]){
  const e=enemy(kind,lane),distances=[e.motion.startD,(e.motion.startD+e.d)/2,e.d-1,e.d,e.d+10];
  for(const distance of distances){
   const p=encounterProjection(e,{distance},width,height),pose=entityPose(e,distance),surface=projection(width,height,pose.lane,e.d-distance),contact=projection(width,height,pose.contactLane,e.d-distance);
   close(p.x,surface.x);close(p.y,surface.y);close(p.lane,pose.lane);
   close(p.destination.x,contact.x);close(p.destination.y,contact.y);
   assert.equal(p.action,kind==='bird'?'duck':'jump');
   assert.ok(Number.isFinite(p.bodyY));
   // Bird/fish center heights are their agreed 3D gameplay envelopes. The
   // moving lift must not move the shadow or warning ring off the river.
   const baseline=kind==='bird'?2.33:kind==='fish'?.25:0;
   close((p.y-p.bodyY)/p.unit,baseline+pose.lift);
   if(distance<=e.d)assert.ok(p.destination.y>=p.horizon&&p.destination.y<=p.foot+1e-9);
  }
 }
});

test('bird approach visibly descends from either shoreline to a high duck encounter',()=>{
 for(const [width,height] of layouts)for(const seed of [0,1]){
  const e=enemy('bird',1,seed),start=encounterProjection(e,{distance:e.motion.startD},width,height),hit=encounterProjection(e,{distance:e.d},width,height);
  assert.ok(start.lane<0||start.lane>2,'bird starts beyond a bank');
  close((start.y-start.bodyY)/start.unit,5.03);
  close((hit.y-hit.bodyY)/hit.unit,2.33);
  close(hit.x,hit.destination.x);assert.equal(hit.action,'duck');
 }
});

test('fish leap rises above a stable surface cue and returns to the water after the jump encounter',()=>{
 for(const [width,height] of layouts){
  const e=enemy('fish'),takeoff=encounterProjection(e,{distance:e.motion.leapStartD},width,height),apex=encounterProjection(e,{distance:e.d},width,height),landing=encounterProjection(e,{distance:e.motion.leapEndD},width,height);
  close((takeoff.y-takeoff.bodyY)/takeoff.unit,.25);
  close((apex.y-apex.bodyY)/apex.unit,.97);
  close((landing.y-landing.bodyY)/landing.unit,.25);
  close(apex.leapProgress,.5);assert.equal(apex.action,'jump');
 }
});

test('weaving crocodile marker predicts the crossing lane while its body reverses repeatedly',()=>{
 for(const [width,height] of layouts){
  const e=enemy('crocodile',1,1,2),points=[];
  for(let distance=e.motion.startD;distance<=e.d;distance+=2){
   const p=encounterProjection(e,{distance},width,height);
   close(p.destination.x,width/2);points.push(p.lane);
  }
  const differences=points.slice(1).map((lane,i)=>Math.sign(lane-points[i]));
  const reversals=differences.slice(1).filter((sign,i)=>sign&&differences[i]&&sign!==differences[i]).length;
  assert.ok(reversals>=4,'a crocodile must weave more than one simple lane glide');
  assert.ok(points.some(lane=>lane<.1)&&points.some(lane=>lane>1.9),'weave must traverse the full river width');
  const hit=encounterProjection(e,{distance:e.d},width,height);close(hit.x,hit.destination.x);assert.ok(Math.abs(hit.lateralSlope)>.01,'center-lane crocodile is still swimming at impact');
 }
});

test('paused and reduced presentation cannot change essential wildlife trajectories',()=>{
 for(const kind of ['crocodile','bird','fish']){
  const e=enemy(kind),distance=e.d-40;
  const first=encounterProjection(e,{distance,time:1},390,844),paused=encounterProjection(e,{distance,time:60,phase:'paused',reducedMotion:true},390,844);
  assert.deepEqual(paused,first,'essential pose is controlled solely by course distance');
  assert.notDeepEqual(encounterProjection(e,{distance:distance+5},390,844),first);
 }
});
