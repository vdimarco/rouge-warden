import test from 'node:test';
import assert from 'node:assert/strict';
import {strokeAt,balanceAt,actionBlend} from '../src/game/stroke.js';
import {createFrameBudget,sampleFrameBudget} from '../src/game/quality.js';
test('stroke traces continuous drive/recovery at 30, 60 and 120 Hz without pose quantization',()=>{
 for(const hz of [30,60,120]){
   const frames=Array.from({length:hz},(_,i)=>strokeAt(i/hz*42));
   assert.equal(new Set(frames.map(f=>f.blade.join())).size,hz);
   let maxStep=0;for(let i=1;i<frames.length;i++)maxStep=Math.max(maxStep,Math.hypot(...frames[i].blade.map((v,k)=>v-frames[i-1].blade[k])));
   assert.ok(maxStep<.25);assert.ok(frames.every(f=>f.blade[0]<-1.8));
 }
 const start=strokeAt(0),end=strokeAt(Math.PI*2/.13);
 assert.ok(Math.hypot(...start.blade.map((v,k)=>v-end.blade[k]))<1e-10);
});
test('pose blend is refresh-rate independent and reduced motion has a frozen stroke',()=>{
 for(const hz of [30,60,120]){
   let blend=0;for(let i=0;i<hz/10;i++)blend=actionBlend(blend,1,1/hz);
   assert.ok(Math.abs(blend-(1-Math.exp(-4.6)))<1e-10);
 }
 assert.deepEqual(strokeAt(0,true),strokeAt(1000,true));
 assert.equal(balanceAt({lane:2,visualLane:1,laneVelocity:10},true),0);
 const left=balanceAt({lane:0,visualLane:1,laneVelocity:-8}),right=balanceAt({lane:2,visualLane:1,laneVelocity:8});
 assert.ok(Math.abs(left+right)<1e-10);assert.ok(Math.abs(left)<.18);
});
test('frame budget ignores pauses, backs off sustained slow frames and restores detail cautiously',()=>{
 const b=createFrameBudget();for(let i=0;i<200;i++)sampleFrameBudget(b,1200);
 assert.equal(b.scale,1);assert.equal(b.warm,0);
 for(let i=0;i<60;i++)sampleFrameBudget(b,30);
 assert.equal(b.scale,.9);assert.equal(b.meanMs,30);
 for(let i=0;i<210;i++)sampleFrameBudget(b,16.67);
 assert.ok(b.scale>.9&&b.scale<=1);
 for(let i=0;i<1000;i++)sampleFrameBudget(b,40);
 assert.equal(b.scale,.55);
 const severe=createFrameBudget();for(let i=0;i<60;i++)sampleFrameBudget(severe,200);
 assert.equal(severe.scale,.9);
});
