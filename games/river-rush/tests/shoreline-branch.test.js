import test from 'node:test';
import assert from 'node:assert/strict';
import {shorelineBranch,limbPoint,scenicTree,BRANCH_TREE_PARTS} from '../src/game/shoreline-branch.js';
import {riverHalfWidth,riverBankHeight,createCourseProfile} from '../src/game/river-course.js';
import {LEVELS} from '../src/game/levels.js';

const layouts=[[0],[2],[0,1],[1,2],[0,1,2],[1]];
const profiles=[0,137,98213,...LEVELS.map(l=>createCourseProfile(137,l.length,l.index))];
const scenarios=()=>profiles.flatMap(seed=>[110,580,1380,4872].flatMap(d=>layouts.flatMap(branchLanes=>[-1,1].map(branchSide=>({seed,d,e:{type:'branch',id:d+branchLanes.length,d,lane:branchLanes[0],branchLanes,branchSide}})))));
const radiusAt=(limb,t)=>limb.r+(limb.rEnd-limb.r)*t;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.d-b.d);
const close=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);

test('one-, two-, and three-lane limbs remain rooted and leave uncovered routes clear',()=>{
 for(const {seed,d,e} of scenarios()){
  const tree=shorelineBranch(e,d,seed);
  assert.ok(Math.abs(tree.root.x)>riverHalfWidth(d+tree.root.d,seed));
  assert.equal(tree.root.y,riverBankHeight(tree.root.x,d+tree.root.d,seed));
  assert.ok(tree.root.d>=1&&tree.root.d<=1.8,'main bank attachment stays near the crossing station');
  assert.equal(tree.span.width,e.branchLanes.length);assert.deepEqual(tree.span.lanes,e.branchLanes);
  assert.deepEqual(tree.contacts.map(p=>p.lane),e.branchLanes);
  assert.ok(tree.wood.length<=BRANCH_TREE_PARTS&&tree.leaves.length<=BRANCH_TREE_PARTS);
  for(const contact of tree.contacts){close(contact.x,(contact.lane-1)*3.8);assert.equal(contact.d,0);assert.ok(contact.y>2.6&&contact.y<3.1);}
  for(const limb of tree.wood)for(let i=0;i<=64;i++){
   const t=i/64,p=limbPoint(limb,t),r=radiusAt(limb,t);
   assert.ok([p.x,p.y,p.d,r].every(Number.isFinite)&&r>0);
   assert.ok(limb.rEnd>0&&limb.rEnd<=limb.r);
   if(Math.abs(p.x)<=5.7&&p.y-r<4.2){
    assert.ok(Math.max(-5.7,p.x-r)>=tree.span.minX-1e-6,'low wood crosses an uncovered route on the left');
    assert.ok(Math.min(5.7,p.x+r)<=tree.span.maxX+1e-6,'low wood crosses an uncovered route on the right');
   }
   if(limb.kind==='span')assert.ok(p.y-r>=2.02,'a ducked rider clears the substantial main shaft');
  }
 }
});

test('the main limb crosses the full marked span with gentle sag and substantial wood at every lane',()=>{
 for(const {seed,d,e} of scenarios()){
  const tree=shorelineBranch(e,d,seed),shaft=tree.wood.filter(l=>l.kind==='span'),connectors=tree.wood.filter(l=>l.kind==='connector');
  assert.equal(connectors.at(-1).b,shaft[0].a,'the river shaft is attached to the rooted bank connector');
  assert.ok(shaft.length>=6);
  for(let i=1;i<shaft.length;i++){assert.equal(shaft[i-1].b,shaft[i].a);assert.ok(shaft[i].r<=shaft[i-1].r);}
  let lo=Infinity,hi=-Infinity,previous;
  for(const limb of shaft)for(let i=0;i<=64;i++){
   const p=limbPoint(limb,i/64);lo=Math.min(lo,p.y);hi=Math.max(hi,p.y);
   assert.ok(Math.abs(p.d)<.15,'the primary crossing must not point diagonally downriver');
   if(previous&&Math.abs(p.x-previous.x)>1e-6){
    assert.ok((p.x-previous.x)*tree.side<0,'main wood grows from its bank across the river');
    assert.ok(Math.abs((p.y-previous.y)/(p.x-previous.x))<(e.branchLanes.length===1&&e.branchLanes[0]===1?1.7:.6),'main shaft must avoid the old steep dip');
   }
   previous=p;
  }
  assert.ok(hi-lo<.55&&hi-lo>.25,'the branch should have a shallow natural sag');
  for(const contact of tree.contacts){
   const joined=shaft.find(l=>distance(l.a,contact)<1e-6);
   assert.ok(joined,'every declared lane center lies on the connected supporting shaft');
   assert.ok(joined.r>=.4,'all covered lanes must have a visible woody cross section');
  }
  assert.equal(tree.tip.lane,e.lane,'reward lane does not replace full physical coverage');
 }
});

test('asymmetric diagonal offshoots have connected secondary branches and smaller leafy twigs',()=>{
 for(const {seed,d,e} of scenarios()){
  const tree=shorelineBranch(e,d,seed),shaft=tree.wood.filter(l=>l.kind==='span'),parents=new Set(shaft.flatMap(l=>[l.a,l.b]));
  const forks=tree.wood.filter(l=>l.kind==='fork'&&parents.has(l.a));
  assert.equal(forks.length,tree.span.width+2);
  const depths=new Set(),spacings=[];
  for(const [i,fork] of forks.entries()){
   assert.ok(fork.r>=.3,'secondary forks have substantial connected wood');
   assert.ok(Math.abs(fork.b.x-fork.a.x)>.45,'the first offshoot is diagonal, not an antenna');
   assert.ok(fork.b.y-fork.a.y>1&&fork.b.y-fork.a.y<1.5);
   const extension=tree.wood.find(l=>l.kind==='fork'&&l.a===fork.b);
   assert.ok(extension&&distance(fork.a,extension.b)>2);
   assert.ok(extension.b.y>5&&Math.abs(extension.b.d)>1.6);
   const twigs=tree.wood.filter(l=>l.kind==='twig'&&(l.a===fork.b||l.a===extension.b));
   assert.equal(twigs.length,2,'secondary wood branches into two smaller offshoots');
   for(const twig of twigs){assert.ok(twig.r<extension.r);assert.ok(tree.leaves.some(leaf=>leaf.p===twig.b),'small foliage is anchored to real twig ends');}
   assert.ok(tree.leaves.some(leaf=>leaf.p===extension.b));depths.add(Math.sign(extension.b.d-fork.a.d));
   if(i)spacings.push(Math.abs(fork.a.x-forks[i-1].a.x));
  }
  assert.ok(depths.has(-1)&&depths.has(1),'the connected limbs fan in both depth directions');
  assert.ok(Math.max(...spacings)-Math.min(...spacings)>.01,'fork spacing should not be a repeated comb');
 }
});

test('root angle and span anatomy are reproducible and independent of the representative reward lane',()=>{
 for(const {seed,d,e} of scenarios()){
  const tree=shorelineBranch(e,d,seed);assert.deepEqual(tree,shorelineBranch(e,d,seed));
  for(const lane of e.branchLanes){const alternative=shorelineBranch({...e,lane},d,seed);assert.deepEqual(alternative.root,tree.root);assert.deepEqual(alternative.meshFrame,tree.meshFrame);assert.deepEqual(alternative.wood,tree.wood);}
 }
 const sides=new Set();for(let id=1;id<=30;id++)sides.add(shorelineBranch({id,lane:1,d:100+id*45},100+id*45,137).side);
 assert.deepEqual([...sides].sort(),[-1,1],'legacy center fixtures can attach to either bank');
});

test('decorative trees remain outside the navigation corridor with bounded crowns',()=>{
 for(const seed of profiles)for(const d of [110,580,1380,4872])for(const side of [-1,1]){
  const tree=scenicTree({id:21,d,side},d,seed);
  assert.ok(tree.wood.length<=BRANCH_TREE_PARTS&&tree.leaves.length<=BRANCH_TREE_PARTS);
  for(const limb of tree.wood)for(let i=0;i<=64;i++){
   const t=i/64,p=limbPoint(limb,t);assert.ok(Math.abs(p.x)-radiusAt(limb,t)>5.7);
   assert.ok(limb.rEnd>0&&limb.rEnd<=limb.r);
  }
 }
});
