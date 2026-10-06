import test from 'node:test';
import assert from 'node:assert/strict';
import {shorelineBranch,limbPoint,scenicTree} from '../src/game/shoreline-branch.js';
import {riverHalfWidth,riverBankHeight} from '../src/game/river-course.js';

test('duck limbs stay rooted on changing shorelines and only dip into their hazard lane',()=>{
  for(const seed of [0,7,137,250,98213])for(const d of [110,580,1380,4872])for(const lane of [0,1,2]){
    const e={id:Math.floor(d)+lane,lane,d},tree=shorelineBranch(e,d,seed);
    assert.ok(Math.abs(tree.root.x)>riverHalfWidth(d+tree.root.d,seed));
    assert.equal(tree.root.y,riverBankHeight(tree.root.x,d+tree.root.d,seed));
    assert.equal(tree.tip.x,(lane-1)*3.8);assert.equal(tree.tip.d,0);assert.equal(tree.tip.y,2.42);
    assert.ok(tree.wood.length<=32&&tree.leaves.length<=32);
    for(const limb of tree.wood)for(let i=0;i<=16;i++){
      const t=i/16,{x,y}=limbPoint(limb,t);
      assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&limb.r>0);
      // Root wood is beyond the navigable corridor. Inside it, wood below a
      // standing rider must be confined to the existing hazard's lane.
      if(Math.abs(x)<=5.7&&y-limb.r<4.2)assert.ok(Math.abs(x-tree.lane)+limb.r<1.9,`low wood crosses safe route: lane ${lane}, x ${x}, y ${y}`);
    }
  }
});

test('shoreline morphology is reproducible and centre-lane trees use both banks',()=>{
  const sides=new Set();
  for(let id=1;id<=30;id++){
    const e={id,lane:1,d:100+id*45};
    assert.deepEqual(shorelineBranch(e,e.d,137),shorelineBranch(e,e.d,137));
    sides.add(shorelineBranch(e,e.d,137).side);
  }
  assert.deepEqual([...sides].sort(),[-1,1]);
});

test('decorative trees remain outside the navigation corridor with bounded crowns',()=>{
 for(const seed of [0,137,98213])for(const d of [110,580,1380,4872])for(const side of [-1,1]){
  const tree=scenicTree({id:21,d,side},d,seed);
  assert.ok(tree.wood.length<=32&&tree.leaves.length<=32);
  for(const limb of tree.wood)for(let i=0;i<=32;i++){
   const p=limbPoint(limb,i/32);assert.ok(Math.abs(p.x)-limb.r>5.7);
   assert.ok(limb.rEnd>0&&limb.rEnd<=limb.r);
  }
 }
});
