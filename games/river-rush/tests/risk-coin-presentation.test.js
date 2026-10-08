import test from 'node:test';
import assert from 'node:assert/strict';
import {coinAppearance,coinWorldHeight,coinPixelLift,coinFlightPixelLift} from '../src/game/coin-presentation.js';
import {projection,fallbackRiderWidth} from '../src/game/render.js';
import {LANES} from '../src/game/lanes.js';

test('a richer appearance promises the actual denomination rather than a route label or multiplied payout',()=>{
 const plain=coinAppearance({}),safe=coinAppearance({coinValue:10,routeRole:'safe'});
 assert.equal(plain.premium,false);assert.equal(safe.premium,false);
 assert.equal(coinAppearance({coinValue:10,routeRole:'risk',value:100}).premium,false,'streak score and route metadata alone cannot promise double coin value');
 const premium=coinAppearance({coinValue:20,routeRole:'risk'});
 assert.equal(premium.premium,true);assert.notEqual(premium.color,plain.color);assert.notEqual(premium.rimColor,premium.color);
 assert.ok(premium.scale>plain.scale&&premium.rimScale>plain.rimScale,'shape and raised rim also distinguish value without relying on color or animation');
});

test('premium appearance leaves the same physical jump arc and score-flight registration',()=>{
 for(const arcHeight of [null,0,.24,.7,1])for(const high of [false,true]){
  const ordinary={high,...(arcHeight===null?{}:{jumpHeight:arcHeight})},premium={...ordinary,coinValue:20};
  assert.equal(coinWorldHeight(premium),coinWorldHeight(ordinary));
  for(const width of [90,150,245])for(const perspective of [.15,.6,1]){
   assert.equal(coinPixelLift(premium,width,perspective),coinPixelLift(ordinary,width,perspective));
   assert.equal(coinFlightPixelLift(premium,width),coinFlightPixelLift(ordinary,width));
  }
 }
});

test('larger guarded medals remain separated within their five-lane footprint on supported screens',()=>{
 const style=coinAppearance({coinValue:20});
 for(const [width,height] of [[390,844],[360,640],[1365,900],[844,390]])for(const depth of [0,30,110])for(const lane of LANES){
  const p=projection(width,height,lane,depth),size=fallbackRiderWidth(width,height)*.28*p.scale*style.scale;
  assert.ok(size<p.laneSpacing*.5,'a premium silhouette cannot visually reach an adjacent lane');
  assert.ok(p.x-size/2>0&&p.x+size/2<width,'outer-lane medals remain on screen');
 }
});
