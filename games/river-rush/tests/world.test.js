import test from 'node:test';
import assert from 'node:assert/strict';
import {bankScenery,rapids,laneSpring,duckCompression} from '../src/game/world.js';
import {createMotion,advanceMotion} from '../src/game/motion.js';

test('bank props approach with course distance, stay outside playable lanes and never accumulate',()=>{
  for(const distance of [0,100,1000000]){
    const a=bankScenery(distance,180),b=bankScenery(distance+1,180);
    assert.ok(a.length<=30);
    for(const item of a){
      assert.ok(Math.abs(item.lane-1)/3-.27*item.size/2>.5);
      const same=b.find(e=>e.id===item.id);if(same)assert.ok(Math.abs(same.z-(item.z-1))<1e-8);
    }
    assert.deepEqual(bankScenery(distance,180),a);
  }
});
test('whitewater progresses continuously between obstacle rows and wraps outside the visible course',()=>{
  for(const distance of [0,123,1000000]){
    const a=rapids(distance,180),b=rapids(distance+.5,180);
    assert.ok(a.length<=36);assert.ok(a.some(e=>e.z<15));
    for(const patch of a.filter(e=>e.z>0&&e.z<130))assert.ok(b.some(e=>Math.abs(e.z-(patch.z-.5))<1e-8));
  }
});
test('steering preserves position and velocity under reversal and is independent of refresh rate',()=>{
  const whole=laneSpring(1,0,2,.08);assert.ok(whole.position>1.78&&whole.position<2);
  for(const hz of [30,60,120]){
    let p=1,v=0;
    for(let i=0;i<Math.ceil(hz*.15);i++){const next=laneSpring(p,v,2,1/hz);p=next.position;v=next.velocity;}
    assert.ok(p>1.95&&p<2);
  }
  const first=laneSpring(1,0,2,1/60);assert.ok(first.position>1.1&&first.position<1.15);
  const reverse=laneSpring(first.position,first.velocity,0,0);assert.equal(reverse.position,first.position);assert.equal(reverse.velocity,first.velocity);
  const small=laneSpring(first.position,first.velocity,0,.00001);assert.ok(Math.abs(small.position-first.position)<.001);
  const half=laneSpring(1,0,2,.04),twice=laneSpring(half.position,half.velocity,2,.04);assert.ok(Math.abs(twice.position-whole.position)<1e-12);
});
test('action silhouette compresses continuously and locks the existing paddle pose in the air',()=>{
  assert.equal(duckCompression('duck',0),0);assert.ok(duckCompression('duck',1/60)>.2);
  assert.equal(duckCompression('duck',.3),1);assert.ok(duckCompression('duck',.59)<.12);assert.equal(duckCompression('jump',.3),0);
  const g={time:0,distance:22,action:'',effects:[]},m=createMotion(g);
  g.action='jump';g.time=.1;g.distance=25;advanceMotion(m,g);assert.equal(m.paddleDistance,22);
  const frozen=structuredClone(m);advanceMotion(m,g);assert.deepEqual(m,frozen);
  g.action='';advanceMotion(m,g);assert.equal(m.paddleDistance,25);
});
