import {laneToX,PLAYABLE_HALF_WIDTH} from '../src/game/lanes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {shorelineBranch,limbPoint,scenicTree,BRANCH_TREE_PARTS} from '../src/game/shoreline-branch.js';
import {riverHalfWidth,riverBankHeight,createCourseProfile} from '../src/game/river-course.js';
import {LEVELS} from '../src/game/levels.js';
const layouts=[[0],[4],[0,1],[3,4],[0,1,2],[2,3,4],[1],[2],[3]];
const profiles=[0,137,98213,...LEVELS.map(l=>createCourseProfile(137,l.length,l.index))];
const scenarios=()=>profiles.flatMap(seed=>[110,580,1380,4872].flatMap(d=>layouts.flatMap(branchLanes=>[-1,1].map(branchSide=>({seed,d,e:{type:'branch',id:d+branchLanes.length,d,lane:branchLanes[0],branchLanes,branchSide}})))));
const radiusAt=(limb,t)=>limb.r+(limb.rEnd-limb.r)*t;
const close=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);

test('natural trees have grounded roots, a joined trunk collar and exact one/two/three-lane contacts',()=>{
 for(const {seed,d,e} of scenarios()){
  const tree=shorelineBranch(e,d,seed);
  assert.ok(Math.abs(tree.root.x)>riverHalfWidth(d+tree.root.d,seed));
  assert.equal(tree.root.y,riverBankHeight(tree.root.x,d+tree.root.d,seed));
  assert.equal(tree.anatomy,'rooted-recursive-oak');
  assert.equal(tree.span.width,e.branchLanes.length);assert.deepEqual(tree.span.lanes,e.branchLanes);
  assert.deepEqual(tree.contacts.map(p=>p.lane),e.branchLanes);
  assert.ok(tree.wood.length<=BRANCH_TREE_PARTS&&tree.leaves.length<=BRANCH_TREE_PARTS);
  const trunks=tree.wood.filter(p=>p.kind==='trunk'),arms=tree.wood.filter(p=>p.kind==='arm'),shaft=tree.wood.filter(p=>p.kind==='span');
  assert.equal(trunks[0].a,tree.root);assert.equal(trunks[0].b,trunks[1].a);
  assert.equal(trunks.at(-1).b,arms[0].a);assert.equal(arms[0].b,arms[1].a);assert.equal(arms.at(-1).b,shaft[0].a);
  assert.ok(tree.wood.filter(p=>p.kind==='root').every(p=>p.b===trunks[0].b));
  for(const contact of tree.contacts){
   close(contact.x,laneToX(contact.lane));assert.ok(Math.abs(contact.d)<.5);assert.ok(contact.y>2.75&&contact.y<3.5);
   assert.ok(shaft.some(p=>p.a.x===contact.x||p.b.x===contact.x),'covered lanes have a physical vertex of the continuous limb');
  }
 }
});

test('crooked main limbs clear a ducked rider and keep low wood out of uncovered routes',()=>{
 for(const {seed,d,e} of scenarios()){
  const tree=shorelineBranch(e,d,seed),shaft=tree.wood.filter(p=>p.kind==='span');let minY=Infinity,maxY=-Infinity,minD=Infinity,maxD=-Infinity;
  for(const limb of tree.wood)for(let i=0;i<=64;i++){
   const t=i/64,p=limbPoint(limb,t),r=radiusAt(limb,t);
   assert.ok([p.x,p.y,p.d,r].every(Number.isFinite)&&r>0);assert.ok(limb.rEnd>0&&limb.rEnd<=limb.r);
   if(limb.kind==='span'){assert.ok(p.y-r>=2.02,'a ducked rider clears the entire natural primary limb');minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);minD=Math.min(minD,p.d);maxD=Math.max(maxD,p.d);}
   if(Math.abs(p.x)<=PLAYABLE_HALF_WIDTH&&p.y-r<3.5&&Math.abs(p.d)<1.25){
    assert.ok(Math.max(-PLAYABLE_HALF_WIDTH,p.x-r)>=tree.span.minX-.1,`low wood enters left clear lane: ${JSON.stringify({p,r,span:tree.span,kind:limb.kind})}`);
    assert.ok(Math.min(PLAYABLE_HALF_WIDTH,p.x+r)<=tree.span.maxX+.1,`low wood enters right clear lane: ${JSON.stringify({p,r,span:tree.span,kind:limb.kind})}`);
   }
  }
  for(let i=1;i<shaft.length;i++)assert.equal(shaft[i-1].b,shaft[i].a);
  assert.ok(maxY-minY>.2,'the branch has naturally changing height');assert.ok(maxD-minD>.25,'the branch bends in depth rather than lying on a flat rail');
 }
});

test('recursive connected forks have varied directions and foliage follows real branches',()=>{
 const counts=new Set(),directions=new Set();
 for(const {seed,d,e} of scenarios()){
  const tree=shorelineBranch(e,d,seed),shaft=tree.wood.filter(l=>l.kind==='span'),parents=new Set(shaft.flatMap(l=>[l.a,l.b]));
  const forks=tree.wood.filter(l=>l.kind==='fork'&&parents.has(l.a));counts.add(forks.length);
  assert.ok(forks.length>=3&&forks.length<=5);
  for(const fork of forks){
   const extension=tree.wood.find(l=>l.kind==='fork'&&l.a===fork.b);assert.ok(extension,'major limbs have a connected secondary limb');
   assert.ok(Math.abs(fork.b.d-fork.a.d)>=.8,'major limbs spread sideways into depth');
   assert.ok(fork.r>=.16&&extension.r<fork.r);
   assert.ok(tree.wood.filter(l=>l.kind==='twig'&&(l.a===fork.b||l.a===extension.b)).length>=2,'secondary limbs have recursive twigs');
   directions.add(Math.sign(extension.b.d-fork.a.d));
  }
  const ends=new Set(tree.wood.map(p=>p.b));
  assert.ok(tree.leaves.filter(l=>!ends.has(l.p)).length>tree.leaves.length*.8,'foliage spreads along woody stems rather than only at spherical tips');
 }
 assert.ok(counts.size>1,'fork count varies by tree instead of being tied to lane width');assert.ok(directions.has(-1)&&directions.has(1));
});

test('natural anatomy is reproducible and independent of reward lane',()=>{
 for(const {seed,d,e} of scenarios()){
  const tree=shorelineBranch(e,d,seed);assert.deepEqual(tree,shorelineBranch(e,d,seed));
  for(const lane of e.branchLanes){const alternate=shorelineBranch({...e,lane},d,seed);assert.deepEqual(alternate.root,tree.root);assert.deepEqual(alternate.wood,tree.wood);assert.equal(alternate.nativeReach,tree.nativeReach);}
 }
});

test('decorative trees remain outside the corridor with bounded resources',()=>{
 for(const seed of profiles)for(const d of [110,580,1380,4872])for(const side of [-1,1]){
  const tree=scenicTree({id:21,d,side},d,seed);assert.ok(tree.wood.length<=BRANCH_TREE_PARTS&&tree.leaves.length<=BRANCH_TREE_PARTS);
  for(const limb of tree.wood)for(let i=0;i<=64;i++){const t=i/64,p=limbPoint(limb,t);assert.ok(Math.abs(p.x)-radiusAt(limb,t)>PLAYABLE_HALF_WIDTH);assert.ok(limb.rEnd>0&&limb.rEnd<=limb.r);}
 }
});
