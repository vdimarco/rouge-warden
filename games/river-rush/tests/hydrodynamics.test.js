import test from 'node:test';
import assert from 'node:assert/strict';
import {riverElevation,createCourseProfile} from '../src/game/river-course.js';
import { surfaceAt, floatTarget, createFloat, advanceFloat, WAVES,currentDistance,CURRENT_FLOW_SPEED } from '../src/game/hydrodynamics.js';

test('buoyancy probes sample the same continuous directional wave surface',()=>{
 for(const seed of [137,509,7319])for(let d=0;d<=10800;d+=37.7){const x=Math.sin(d)*4,t=d/72,s=surfaceAt(x,d,t,false,seed),epsilon=.0001;
  assert.ok(Math.abs(s.height)<=WAVES.reduce((n,w)=>n+w.amplitude,0)*1.8+.24+1e-10);
  assert.ok(Math.abs((surfaceAt(x+epsilon,d,t,false,seed).height-surfaceAt(x-epsilon,d,t,false,seed).height)/(2*epsilon)-s.dx)<1e-6);
  const target=floatTarget(x,d,t,false,seed);
  const mean=[surfaceAt(x-1.05,d,t,false,seed),surfaceAt(x+1.05,d,t,false,seed),surfaceAt(x,d+1.45,t,false,seed),surfaceAt(x,d-1.45,t,false,seed)].reduce((n,s)=>n+s.height,0)/4+.12;
  const bed=(riverElevation(d+1.45,seed)+riverElevation(d-1.45,seed)-2*riverElevation(d,seed))/4;
  assert.ok(Math.abs(target.height-mean-bed)<1e-12);
  assert.ok(Math.abs((surfaceAt(x,d+epsilon,t,false,seed).height-surfaceAt(x,d-epsilon,t,false,seed).height)/(2*epsilon)-s.dz)<1e-6);
  assert.ok(Math.abs(surfaceAt(x,d+epsilon,t,false,seed).height-s.height)<.0001);
 }
});
test('raft remains stable at 30, 60 and 120 Hz under long runs and steering reversals',()=>{
 const run=(hz,speed)=>{const g={time:0,distance:0,visualLane:1,laneVelocity:0,effects:[],seed:509},s=createFloat(g);let peak=0;
  for(let i=0;i<hz*120;i++){g.time=(i+1)/hz;g.distance=g.time*speed;g.visualLane=1+Math.sin(g.time*2);g.laneVelocity=Math.cos(g.time*2)*20;advanceFloat(s,g);peak=Math.max(peak,Math.abs(s.roll));assert.ok(Number.isFinite(s.height));assert.ok(Math.abs(s.height)<.85);assert.ok(s.pitch>=-.29&&s.pitch<=.18);assert.ok(Math.abs(s.roll)<=.25);}
  return {height:s.height,pitch:s.pitch,roll:s.roll,peak};};
 for(const speed of [52,68,80,92]){const reference=run(120,speed);for(const hz of [30,60]){const actual=run(hz,speed);assert.ok(Math.abs(actual.height-reference.height)<.03,`${hz}Hz height at ${speed}`);assert.ok(Math.abs(actual.roll-reference.roll)<.02,`${hz}Hz roll at ${speed}`);}}
});
test('current advects downstream while a faster raft overtakes it, and reduced water stays still',()=>{
 for(const time of [0,1,37,150]){
  const phase=currentDistance(900,time);
  assert.ok(Math.abs(currentDistance(900+CURRENT_FLOW_SPEED*.25,time+.25)-phase)<1e-10,'a current parcel retains its phase as it travels downstream');
  for(const speed of [52,68,80,92])assert.ok(currentDistance(900+speed*.25,time+.25)>phase,'the raft overtakes the slower downstream current');
  assert.equal(currentDistance(900,time,true),900);
  assert.deepEqual(surfaceAt(3.8,900,time,true),{height:0,dx:0,dz:0});
  assert.deepEqual(floatTarget(3.8,900,time,true),{height:.12,pitch:0,roll:0});
 }
});
test('landing impulse is applied once, settles, and paused state freezes exactly',()=>{
 const g={time:0,distance:0,visualLane:1,laneVelocity:0,effects:[]},impact=createFloat(g),control=createFloat(g);
 g.effects=[{id:1,type:'land',time:0}];advanceFloat(impact,g);assert.equal(impact.heaveVelocity,-2.2);const saved={...impact};advanceFloat(impact,g);assert.deepEqual(impact,saved);
 let maximum=0;for(let i=1;i<=120;i++){g.time=i/60;advanceFloat(impact,g);advanceFloat(control,{...g,effects:[]});maximum=Math.max(maximum,Math.abs(impact.height-control.height));}
 assert.ok(maximum>.025);assert.ok(Math.abs(impact.height-control.height)<.001);
 advanceFloat(impact,g,true);assert.equal(impact.height,.12);assert.equal(impact.pitch,0);assert.equal(impact.roll,0);assert.equal(impact.heaveVelocity,0);
});

test('profiled buoyancy follows each full escalating map at 30, 60 and 120 Hz without global state',()=>{
 const courses=[[0,4200,68],[1,5400,80],[2,6600,92]].map(([index,length,speed])=>({profile:createCourseProfile(7319,length,index),length,speed}));
 const run=({profile,length,speed},hz)=>{
  const g={seed:7319,time:0,distance:0,visualLane:1,laneVelocity:0,effects:[]},state=createFloat(g,profile);
  assert.equal(state.course,profile);let peak=0;
  for(let i=0;i<Math.ceil(length/speed*hz);i++){
   g.time=Math.min((i+1)/hz,length/speed);g.distance=g.time*speed;g.visualLane=1+Math.sin(g.time*2);g.laneVelocity=Math.cos(g.time*2)*20;
   advanceFloat(state,g);peak=Math.max(peak,Math.abs(state.height));
   assert.ok(Number.isFinite(state.height)&&Math.abs(state.height)<.85);assert.ok(state.pitch>=-.29&&state.pitch<=.18);assert.ok(Math.abs(state.roll)<=.25);
  }
  const frozen={...state};advanceFloat(state,g);assert.deepEqual(state,frozen);
  const actual={height:state.height,roll:state.roll,peak};advanceFloat(state,g,true);assert.equal(state.height,.12);assert.equal(state.pitch,0);assert.equal(state.roll,0);
  return actual;
 };
 for(const course of courses){const reference=run(course,120);for(const hz of [30,60]){const actual=run(course,hz);assert.ok(Math.abs(actual.height-reference.height)<.03);assert.ok(Math.abs(actual.roll-reference.roll)<.02);}}
 // Interleaving two maps cannot change an earlier map's deterministic probes.
 const before=surfaceAt(3.8,3000,60,false,courses[0].profile);surfaceAt(3.8,3000,60,false,courses[2].profile);assert.deepEqual(surfaceAt(3.8,3000,60,false,courses[0].profile),before);
});
