import test from 'node:test';
import assert from 'node:assert/strict';
import {districtAt,scenerySlots,recycleZ} from '../src/game/districts.js';

test('world stretches introduce new silhouettes without popping existing landmarks',()=>{
  assert.deepEqual([0,600,1200,1800].map(d=>districtAt(d).name),['CANOPY TRAIL','CASCADE CANYON','SUN TEMPLE HARBOR','CANOPY TRAIL']);
  const forest=scenerySlots(200),falls=scenerySlots(800),harbor=scenerySlots(1400);
  assert.ok(forest.every(s=>s.kind==='canopy'));assert.ok(falls.length<forest.length);assert.ok(harbor.filter(s=>s.kind==='harbor').length>=4);
  for(const d of [0,590,600,1199,1200,1000000]){
    const a=scenerySlots(d),b=scenerySlots(d+.5);assert.ok(a.length<=20);
    for(const item of a){const same=b.find(s=>s.n===item.n&&s.side===item.side);if(!same)continue;
      assert.equal(same.kind,item.kind);assert.equal(same.district,item.district);assert.equal(same.size,item.size);assert.equal(same.z,item.z+.5);
    }
  }
});
test('recycled banks and terrain travel toward the camera at obstacle speed',()=>{
 for(const [offset,period,origin] of [[66,286,24],[128,384,32],[55,320,32]])for(const d of [0,200,380,1000000]){
   const z=recycleZ(offset,d,period,origin),next=recycleZ(offset,d+.5,period,origin);
   assert.ok(z<=origin&&z>origin-period);
   if(z<origin-.5)assert.ok(Math.abs(next-z-.5)<1e-8);else assert.ok(next<origin-period+1);
 }
});
