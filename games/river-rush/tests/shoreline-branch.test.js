import test from 'node:test';
import assert from 'node:assert/strict';
import {shorelineBranch,limbPoint,scenicTree} from '../src/game/shoreline-branch.js';
import {riverHalfWidth,riverBankHeight} from '../src/game/river-course.js';

const scenarios=()=>[0,7,137,250,98213].flatMap(seed=>
 [110,580,1380,4872].flatMap(d=>[0,1,2].map(lane=>({seed,d,lane,id:Math.floor(d)+lane}))));
const radiusAt=(limb,t)=>limb.r+(limb.rEnd-limb.r)*t;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.d-b.d);

test('duck limbs stay rooted on changing shorelines and only dip into their hazard lane',()=>{
  for(const {seed,d,lane,id} of scenarios()){
    const tree=shorelineBranch({id,lane,d},d,seed);
    assert.ok(Math.abs(tree.root.x)>riverHalfWidth(d+tree.root.d,seed));
    assert.equal(tree.root.y,riverBankHeight(tree.root.x,d+tree.root.d,seed));
    assert.equal(tree.tip.x,(lane-1)*3.8);assert.equal(tree.tip.d,0);assert.equal(tree.tip.y,2.42);
    assert.ok(tree.wood.length<=32&&tree.leaves.length<=32);
    for(const limb of tree.wood)for(let i=0;i<=128;i++){
      const t=i/128,{x,y,d:depth}=limbPoint(limb,t),r=radiusAt(limb,t);
      assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(depth)&&r>0);
      assert.ok(limb.rEnd>0&&limb.rEnd<=limb.r);
      // Root wood is beyond the navigable corridor. Inside it, wood below a
      // standing rider must be confined to the existing hazard's lane.
      if(Math.abs(x)<=5.7&&y-r<4.2)assert.ok(Math.abs(x-tree.lane)+r<1.9,`low wood crosses safe route: seed ${seed}, course ${d}, lane ${lane}, x ${x}, y ${y}, r ${r}`);
    }
  }
});

test('duck boughs are substantial connected limbs with multiple leafy forks',()=>{
 for(const {seed,d,lane,id} of scenarios()){
  const tree=shorelineBranch({id,lane,d},d,seed),bough=tree.wood.filter(limb=>limb.kind==='bough');
  assert.ok(bough.length>0);
  const contact=bough.find(limb=>limb.b===tree.tip);
  assert.ok(contact,'the hazard contact must be part of the structural bough');
  assert.ok(contact.rEnd>=.3,'the contact must read as a woody limb rather than a twig');
  assert.ok(bough[0].r>=contact.rEnd*1.5,'the limb needs a substantial tapered attachment to the tree');
  for(let i=1;i<bough.length;i++){
   assert.equal(bough[i-1].b,bough[i].a,'the primary bough must be connected');
   assert.ok(bough[i].r<=bough[i-1].r,'the bough must taper toward the river');
  }
  const boughNodes=new Set(bough.flatMap(limb=>[limb.a,limb.b]));
  const forks=tree.wood.filter(limb=>limb.kind==='fork'&&boughNodes.has(limb.a));
  assert.ok(forks.length>=3,'several visible forks must grow from the main limb');
  const depths=new Set();
  for(const fork of forks){
   assert.ok(fork.r>=.2,'forks must be substantial wood, not decorative hairs');
   const extension=tree.wood.find(limb=>limb.kind==='fork'&&limb.a===fork.b);
   assert.ok(extension,'forks need connected secondary limbs');
   assert.ok(distance(fork.a,extension.b)>=2,'forks must extend visibly beyond the main limb');
   assert.ok(extension.b.y>fork.a.y,'secondary limbs must open the crown above the bough');
   assert.ok(tree.leaves.some(leaf=>distance(leaf.p,extension.b)<.01),'fork ends must support foliage');
   depths.add(Math.sign(extension.b.d-fork.a.d));
  }
  assert.ok(depths.has(-1)&&depths.has(1),'forks must fan into different depths');
 }
});

test('low boughs descend through the contact instead of curling into an upturned hook',()=>{
 for(const {seed,d,lane,id} of scenarios()){
  const tree=shorelineBranch({id,lane,d},d,seed),bough=tree.wood.filter(limb=>limb.kind==='bough');
  let previous=null;
  for(const limb of bough)for(let i=0;i<=64;i++){
   const p=limbPoint(limb,i/64);
   if(p.y<=5.2){
    if(previous){
     assert.ok(p.y<=previous.y+1e-8,'the low limb must continue descending');
     assert.ok((p.x-previous.x)*tree.side<=1e-8,'the low limb must continue into the river');
    }
    previous=p;
   }
  }
  const end=bough.at(-1).b;
  assert.ok(end.y<tree.tip.y,'the terminal limb must end below the contact');
  assert.ok((end.x-tree.tip.x)*tree.side<0,'the terminal limb must extend beyond the contact');
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
  for(const limb of tree.wood)for(let i=0;i<=64;i++){
   const t=i/64,p=limbPoint(limb,t);assert.ok(Math.abs(p.x)-radiusAt(limb,t)>5.7);
   assert.ok(limb.rEnd>0&&limb.rEnd<=limb.r);
  }
 }
});
