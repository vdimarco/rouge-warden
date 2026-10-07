import test from 'node:test';
import assert from 'node:assert/strict';
import {riverCenter,riverTangent,riverHalfWidth,riverElevation,riverGrade,rapidAt,rapidDerivative,riverPoint,shoalAt} from '../src/game/river-course.js';
import {surfaceAt,floatTarget} from '../src/game/hydrodynamics.js';

test('seeded river stays wide, descends downstream and has continuous chute boundaries',()=>{
 for(const seed of [0,3,137,7123,249]){
  let minWidth=Infinity,maxWidth=0,minGrade=0,maxRapid=0;
  for(let d=-200;d<3000;d+=.71){
   const width=riverHalfWidth(d,seed)*2,grade=riverGrade(d,seed);
   assert.ok(width>21.1&&width<44.5);assert.ok(grade<=-.0219);
   assert.ok(riverElevation(d+1,seed)<riverElevation(d,seed));
   assert.ok(rapidAt(d,seed)>=.12&&rapidAt(d,seed)<=1);
   minWidth=Math.min(minWidth,width);maxWidth=Math.max(maxWidth,width);minGrade=Math.min(minGrade,grade);maxRapid=Math.max(maxRapid,rapidAt(d,seed));
  }
  assert.ok(maxWidth-minWidth>8);assert.ok(minGrade<-.18);assert.equal(maxRapid,1);
  for(let cell=-2;cell<30;cell++)for(const profile of [riverElevation,riverCenter,riverHalfWidth,rapidAt]){
   assert.ok(Math.abs(profile(cell*130-1e-5,seed)-profile(cell*130+1e-5,seed))<1e-4);
  }
 }
 assert.notEqual(riverCenter(100,3),riverCenter(100,137));
});

test('course and whitewater derivatives agree with finite differences through pools and chutes',()=>{
 const e=1e-4;
 for(let d=0;d<1800;d+=3.79){
  for(const [profile,derivative] of [[riverCenter,riverTangent],[riverElevation,riverGrade],[rapidAt,rapidDerivative]]){
   assert.ok(Math.abs((profile(d+e,7123)-profile(d-e,7123))/(2*e)-derivative(d,7123))<1e-6);
  }
  const s=surfaceAt(2,d,9,false,7123);
  assert.ok(Math.abs((surfaceAt(2,d+e,9,false,7123).height-surfaceAt(2,d-e,9,false,7123).height)/(2*e)-s.dz)<1e-6);
 }
});

test('floating course preserves lane spacing, follows downhill bends and places shoals outside hazards',()=>{
 for(const origin of [0,55,130,795,1000000]){
  const zero=riverPoint(origin,origin,0,7123);assert.equal(Math.hypot(zero.x,zero.y,zero.z),0);
  const p=riverPoint(origin,origin+100,0,7123);assert.ok(p.y< -2);assert.equal(p.z,-100);
  const left=riverPoint(origin,origin+20,-3.8,7123),right=riverPoint(origin,origin+20,3.8,7123);
  assert.ok(Math.abs(right.x-left.x-7.6)<1e-10);assert.equal(right.y,left.y);
  for(let n=Math.floor(origin/34);n<Math.floor(origin/34)+9;n++){
   const rock=shoalAt(n,7123);assert.ok(Math.abs(rock.x)-rock.size*2*1.18>5.5);
  }
 }
 const pool=floatTarget(0,0,0,false,7123),chute=floatTarget(0,67,0,false,7123);
 assert.ok(chute.pitch<pool.pitch);assert.deepEqual(floatTarget(0,67,0,true,7123),{height:.12,pitch:0,roll:0});
});
