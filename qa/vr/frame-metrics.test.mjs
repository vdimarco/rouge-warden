import assert from 'node:assert/strict';
import {createFrameMetrics} from '../../public/vr/js/frame-metrics.js';
const m=createFrameMetrics();
assert.equal(m.report().fps,null);
m.frame(0,1,true);m.input(5);m.frame(10,15,true);m.frame(40,42,true);
assert.equal(m.report().fps,50); // elapsed-time FPS, not mean(100, 33.3)
assert.equal(m.report().p95Ms,30);
assert.equal(m.report().inputSubmitP95Ms,10);
m.frame(2040,2041,true);assert.equal(m.report().over50,1);
assert.equal(m.report().p99Ms,2000); // long gameplay stalls count
m.frame(2050,2051,false);m.frame(9000,9001,true);
assert.equal(m.report().frames,3); // hidden/pause gap excluded
m.reset();m.frame(0,0,true);
for(let i=1;i<=700;i++){m.input(i*10-2);m.frame(i*10,i*10+1,true);}
assert.equal(m.report().frames,600);assert.equal(m.report().inputs,120);
assert.equal(m.report().fps,100);assert.equal(m.report().inputSubmitP95Ms,3);
m.reset();m.input(1);m.frame(2,3,false);m.frame(4,5,true);
assert.equal(m.report().inputs,0);assert.equal(m.report().fps,null);
console.log('PASS frame metrics: elapsed FPS, percentiles, stalls, inactive gaps, bounds, reset');
