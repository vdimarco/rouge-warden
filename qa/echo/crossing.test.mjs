import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun, step, callFlock, birdPosition, LENGTH} from '../../public/echo/crossing.js';
const advance = (r, seconds) => { for(let t=0;t<seconds;t+=.01) step(r,.01); };
const isolated = () => { const r=createRun(); r.next=100; return r; };
test('rescue joins the flock once and followers echo older turns', () => {
  const r=isolated(); r.objects=[{type:'chick',x:.5,y:.51}]; step(r,.01);
  assert.equal(r.chicks,1); assert.equal(r.rescued,1); assert.equal(r.objects.length,0);
  r.target=.85; advance(r,.2);
  assert.ok(r.x>.7); assert.equal(birdPosition(r,1).x,.5);
  advance(r,.5); assert.ok(birdPosition(r,1).x>.7);
});
test('CALL gathers the flock, braces wakes, and enforces recharge', () => {
  const r=isolated(); r.chicks=4;
  assert.equal(callFlock(r),true); assert.equal(callFlock(r),false);
  advance(r,.5); assert.ok(birdPosition(r,4).y<.65);
  r.objects=[{type:'wake',y:.515,gap:.1}]; step(r,.01); assert.equal(r.hearts,3);
  advance(r,8); assert.equal(callFlock(r),true);
});
test('wake gaps are safe; exposed parent takes one hit, with grace time', () => {
  const r=isolated(); r.objects=[{type:'wake',y:.515,gap:.5}]; step(r,.01); assert.equal(r.hearts,3);
  r.objects=[{type:'wake',y:.515,gap:.1}]; step(r,.01); assert.equal(r.hearts,2);
  step(r,.01); assert.equal(r.hearts,2);
});
test('tail collision loses a chick; CALL does not make rocks harmless', () => {
  const r=isolated(); r.chicks=2;
  r.objects=[{type:'rock',x:.5,y:birdPosition(r,2).y}]; step(r,.01);
  assert.equal(r.chicks,1); assert.equal(r.lost,1); assert.equal(r.hearts,3);
  r.invincible=0; callFlock(r); r.objects=[{type:'rock',x:.5,y:.52}]; step(r,.01); assert.equal(r.hearts,2);
});
test('crossing ends at home; exhausted parent ends at shore; ended runs stay frozen', () => {
  const r=isolated(); r.chicks=5; r.elapsed=LENGTH-.01; step(r,.02);
  assert.equal(r.won,true); assert.equal(r.ended,true); assert.equal(r.chicks,5);
  const elapsed=r.elapsed; step(r,1); assert.equal(r.elapsed,elapsed); assert.equal(callFlock(r),false);
  const tired=isolated(); tired.hearts=1; tired.objects=[{type:'rock',x:.5,y:.52}]; step(tired,.01);
  assert.equal(tired.ended,true); assert.equal(tired.won,false);
});
test('the whole route stays finite; doing nothing does not win', () => {
  const r=createRun();
  for(let i=0;i<8000&&!r.ended;i++) {
    step(r,.01); r.events.length=0;
    assert.ok(Number.isFinite(r.x)); assert.ok(r.chicks>=0&&r.chicks<=8);
  }
  assert.equal(r.ended,true); assert.equal(r.won,false);
});
test('a learned route can bring all eight chicks home without taking damage', () => {
  const plan=[[0,.5],[6,.28],[11,.32],[14.8,.72],[17.5,.3],[22,.7],[25,.68],[30,.72],[35.8,.25],[41,.36],[45.8,.72],[51,.68],[55.8,.3],[61.8,.65],[64.8,.48]];
  const r=createRun(); let n=0, nextCall=13;
  for(let i=0;i<8000&&!r.ended;i++) {
    while(n+1<plan.length&&r.elapsed>=plan[n+1][0]) n++;
    r.target=plan[n][1];
    if(r.elapsed>=nextCall&&r.cooldown===0) { callFlock(r); nextCall+=8.1; }
    step(r,.01); r.events.length=0;
  }
  assert.equal(r.won,true); assert.equal(r.rescued,8); assert.equal(r.chicks,8);
  assert.equal(r.lost,0); assert.equal(r.hearts,3);
});
