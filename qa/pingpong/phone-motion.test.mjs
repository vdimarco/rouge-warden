import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhoneTravel, phoneAcceleration, headingDelta, mapAxes, createSwingDetector} from '../../public/pingpong/motion.js';

test('gravity-free push and pull move depth in opposite directions with a level grip',()=>{
  for(const dir of [-1,1]){
    const travel=createPhoneTravel(); let out;
    for(let i=0;i<12;i++){
      travel.sample({x:0,y:0,z:-dir*5},0,90,i/60);
      out=travel.step(1/60,i/60);
    }
    assert.ok(out.z*dir>0.12,JSON.stringify(out));
    assert.equal(out.x,0);
  }
});
test('physical screen-right movement maps consistently in all four rotations',()=>{
  const cases=[[0,{x:5,y:0,z:0}],[90,{x:0,y:5,z:0}],[180,{x:-5,y:0,z:0}],[270,{x:0,y:-5,z:0}]];
  for(const [angle,a] of cases){const out=phoneAcceleration(a,angle,90);assert.ok(Math.abs(out.x-5)<1e-8);assert.ok(Math.abs(out.z)<1e-8);}
  assert.deepEqual(mapAxes(10,4,90),{beta:-4,gamma:10});
  assert.deepEqual(mapAxes(10,4,270),{beta:4,gamma:-10});
});
test('forward movement works with both a flat and an upright grip',()=>{
  assert.ok(phoneAcceleration({x:0,y:5,z:0},0,0).z>4.9);
  assert.ok(phoneAcceleration({x:0,y:0,z:-5},0,90).z>4.9);
});
test('missing values, noise, stale data and recenter do not create drift',()=>{
  const t=createPhoneTravel();
  t.sample({x:null,y:null,z:null},0,90,0);assert.deepEqual(t.step(0.05,0),{x:0,z:0});
  t.sample({x:0.1,y:0,z:0.1},0,90,0);assert.deepEqual(t.step(0.05,0),{x:0,z:0});
  t.sample({x:8,y:0,z:-8},0,90,0);
  for(let i=0;i<10;i++)t.step(1/60,i/60);
  let out;for(let i=10;i<360;i++)out=t.step(1/60,i/60);
  assert.ok(Math.abs(out.x)<0.001 && Math.abs(out.z)<0.001,JSON.stringify(out));
  t.sample({x:8,y:0,z:-8},0,90,8);t.step(0.05,8);t.reset();assert.deepEqual(t.step(0.05,8),{x:0,z:0});
});
test('sustained sensor spikes stay inside safe table travel',()=>{
  const t=createPhoneTravel();let out;
  for(let i=0;i<600;i++){t.sample({x:1000,y:0,z:-1000},0,90,i/60);out=t.step(1/60,i/60);assert.ok(out.x<=0.45 && out.z<=0.48);}
});
test('heading crosses north smoothly and a straight physical stroke can trigger a hit',()=>{
  assert.equal(headingDelta(1,359),2);assert.equal(headingDelta(359,1),-2);assert.equal(headingDelta(null,0),0);
  const d=createSwingDetector();let swing;
  for(let i=0;i<30;i++){const s=d.push({alpha:0,beta:0,linearSpeed:500},i/60);if(s)swing=s;}
  assert.ok(swing && swing.degPerSec>=500);
});
