import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceAt, floatTarget, createFloat, advanceFloat, WAVES } from '../src/game/hydrodynamics.js';

test('buoyancy probes sample the same continuous directional wave surface',()=>{
 for(let d=0;d<1500;d+=17.7){const x=Math.sin(d)*4,t=d/42,s=surfaceAt(x,d,t),epsilon=.0001;
  assert.ok(Math.abs(s.height)<=WAVES.reduce((n,w)=>n+w.amplitude,0)+1e-10);
  assert.ok(Math.abs((surfaceAt(x+epsilon,d,t).height-surfaceAt(x-epsilon,d,t).height)/(2*epsilon)-s.dx)<1e-6);
  const target=floatTarget(x,d,t);
  const mean=[surfaceAt(x-1.05,d,t),surfaceAt(x+1.05,d,t),surfaceAt(x,d+1.45,t),surfaceAt(x,d-1.45,t)].reduce((n,s)=>n+s.height,0)/4+.12;
  assert.equal(target.height,mean);
  assert.ok(Math.abs(surfaceAt(x,d+epsilon,t).height-s.height)<.0001);
 }
});
test('raft remains stable at 30, 60 and 120 Hz under long runs and steering reversals',()=>{
 const run=hz=>{const g={time:0,distance:0,visualLane:1,laneVelocity:0,effects:[]},s=createFloat(g);let peak=0;
  for(let i=0;i<hz*60;i++){g.time=(i+1)/hz;g.distance=g.time*72;g.visualLane=1+Math.sin(g.time*2);g.laneVelocity=Math.cos(g.time*2)*20;advanceFloat(s,g);peak=Math.max(peak,Math.abs(s.roll));assert.ok(Number.isFinite(s.height));assert.ok(Math.abs(s.height)<.5);assert.ok(Math.abs(s.pitch)<=.13);assert.ok(Math.abs(s.roll)<=.23);}
  return {height:s.height,pitch:s.pitch,roll:s.roll,peak};};
 const reference=run(120);for(const hz of [30,60]){const actual=run(hz);assert.ok(Math.abs(actual.height-reference.height)<.03);assert.ok(Math.abs(actual.roll-reference.roll)<.02);}
});
test('landing impulse is applied once, settles, and paused state freezes exactly',()=>{
 const g={time:0,distance:0,visualLane:1,laneVelocity:0,effects:[]},impact=createFloat(g),control=createFloat(g);
 g.effects=[{id:1,type:'land',time:0}];advanceFloat(impact,g);assert.equal(impact.heaveVelocity,-2.2);const saved={...impact};advanceFloat(impact,g);assert.deepEqual(impact,saved);
 let maximum=0;for(let i=1;i<=120;i++){g.time=i/60;advanceFloat(impact,g);advanceFloat(control,{...g,effects:[]});maximum=Math.max(maximum,Math.abs(impact.height-control.height));}
 assert.ok(maximum>.025);assert.ok(Math.abs(impact.height-control.height)<.001);
 advanceFloat(impact,g,true);assert.equal(impact.height,.12);assert.equal(impact.pitch,0);assert.equal(impact.roll,0);assert.equal(impact.heaveVelocity,0);
});
